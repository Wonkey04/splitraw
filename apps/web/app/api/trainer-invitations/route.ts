import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Primer route handler del proyecto. El resto de la app le pega a Supabase
// directo desde el cliente, pero acá no se puede: mandar el mail necesita la
// API key de Resend, que no puede viajar al browser. Así que la creación de
// la invitación + el envío del mail viven server-side, y el cliente solo
// llama a este endpoint con su access token.
export const runtime = "nodejs";

const INVITE_TTL_MINUTES = 30;

interface InvitePayload {
  name?: unknown;
  email?: unknown;
  branchId?: unknown;
}

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return bad("Falta configurar Supabase en el servidor.", 500);
  }
  if (!resendApiKey) {
    return bad(
      "Falta configurar RESEND_API_KEY en el servidor. La invitación no se creó.",
      500
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    return bad("Falta tu sesión. Volvé a loguearte.", 401);
  }

  let payload: InvitePayload;
  try {
    payload = (await request.json()) as InvitePayload;
  } catch {
    return bad("Body inválido.", 400);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const branchId = typeof payload.branchId === "string" ? payload.branchId : "";

  if (!name) return bad("El nombre del entrenador es obligatorio.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("El email no es válido.", 400);
  if (!branchId) return bad("Elegí una sucursal.", 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Quién está llamando. getUser(jwt) valida la firma del token: no
  //    alcanza con mandar cualquier user id en el body.
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const caller = userData?.user;
  if (userError || !caller) {
    return bad("Tu sesión expiró, volvé a loguearte.", 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("organization_id, role")
    .eq("id", caller.id)
    .single();

  if (profileError || !profile) {
    return bad("No se encontró tu perfil.", 403);
  }
  if (profile.role !== "GYM_OWNER" && profile.role !== "ADMIN") {
    return bad("Solo el dueño del gimnasio puede invitar entrenadores.", 403);
  }

  // 2. La sucursal tiene que ser de SU organización (si no, un owner podría
  //    invitar gente a la sucursal de otro gimnasio pasando otro branch_id).
  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id, name, organization_id")
    .eq("id", branchId)
    .single();

  if (branchError || !branch || branch.organization_id !== profile.organization_id) {
    return bad("La sucursal elegida no pertenece a tu gimnasio.", 400);
  }

  const { data: organization } = await admin
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .single();

  const gymName = organization?.name ?? "Tu gimnasio";

  const expiresAt = new Date(Date.now() + INVITE_TTL_MINUTES * 60 * 1000).toISOString();

  const { data: invitation, error: insertError } = await admin
    .from("trainer_invitations")
    .insert({
      email,
      name,
      organization_id: profile.organization_id,
      branch_id: branch.id,
      invited_by: caller.id,
      expires_at: expiresAt,
    })
    .select("id, token, email, name, expires_at")
    .single();

  if (insertError || !invitation) {
    // El trigger de límite de plan (0016) levanta P0001 con el mensaje ya
    // escrito para el dueño ("Límite del plan free alcanzado: hasta 3
    // entrenadores..."). Se pasa tal cual, con 409, en vez de envolverlo en
    // un 500 genérico: no es un fallo del servidor, es una respuesta.
    //
    // OJO: este insert usa la service_role key, que se saltea la RLS pero NO
    // los triggers. Por eso el cupo se respeta igual desde acá.
    if (insertError?.code === "P0001") {
      return bad(insertError.message, 409);
    }
    return bad("No se pudo crear la invitación: " + (insertError?.message ?? "error desconocido"), 500);
  }

  // 3. Mail. El link apunta a la app pública, no al host interno.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const link = `${appUrl}/accept-invite?token=${invitation.token}`;

  const emailSent = await sendInviteEmail({
    apiKey: resendApiKey,
    to: email,
    gymName,
    trainerName: name,
    branchName: branch.name,
    link,
  });

  if (!emailSent.ok) {
    // El brief pide no dejar la invitación "colgada" sin feedback: si el mail
    // no salió, el token no le sirve a nadie, así que se borra y el owner ve
    // el error real en pantalla.
    await admin.from("trainer_invitations").delete().eq("id", invitation.id);
    return bad("No se pudo enviar el mail de invitación: " + emailSent.error, 502);
  }

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      expires_at: invitation.expires_at,
    },
  });
}

interface SendInviteArgs {
  apiKey: string;
  to: string;
  gymName: string;
  trainerName: string;
  branchName: string;
  link: string;
}

async function sendInviteEmail({
  apiKey,
  to,
  gymName,
  trainerName,
  branchName,
  link,
}: SendInviteArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  // Se le pega a la API de Resend con fetch en vez de sumar el SDK: es un
  // solo POST y evita una dependencia más en el bundle del server.
  const from = process.env.RESEND_FROM_EMAIL ?? "SplitRaw <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${gymName} te invitó como entrenador`,
        text:
          `Hola ${trainerName},\n\n` +
          `${gymName} te invitó como entrenador en la sucursal ${branchName}.\n\n` +
          `Este link expira en ${INVITE_TTL_MINUTES} minutos:\n${link}\n`,
        html:
          `<div style="font-family: Inter, Arial, sans-serif; color: #1A202C; font-size: 14px; line-height: 1.5;">` +
          `<p>Hola ${escapeHtml(trainerName)},</p>` +
          `<p><strong>${escapeHtml(gymName)}</strong> te invitó como entrenador en la sucursal ${escapeHtml(branchName)}.</p>` +
          `<p>Este link expira en ${INVITE_TTL_MINUTES} minutos:</p>` +
          `<p><a href="${link}" style="color: #1E3A8A;">Aceptar invitación</a></p>` +
          `<p style="color: #6B7280; font-size: 12px;">Si no esperabas este mail, ignoralo.</p>` +
          `</div>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `Resend respondió ${response.status}. ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "error de red" };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
