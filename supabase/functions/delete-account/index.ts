// Edge Function: borrado de la propia cuenta.
//
// Deploy:  supabase functions deploy delete-account
//
// Por qué una Edge Function y no una RPC ni una llamada desde el cliente:
// borrar de `auth.users` requiere la service_role key, y esa key NUNCA puede
// viajar al cliente (mismo problema que ya se resolvió así con Resend en
// /api/trainer-invitations). Acá la key vive en el runtime de Supabase.
//
// Quién puede borrar qué: SOLO su propia cuenta. El id no se recibe por
// parámetro — se saca del token del que llama. Un body con el uid de otro no
// tendría ningún efecto porque no se lee.
//
// Qué NO hace, a propósito: no borra cuentas de GYM_OWNER. Un owner puede
// ser el único de una organización con datos de otra gente adentro (socios,
// rutinas, entrenadores); qué pasa con todo eso es una decisión de producto
// que todavía no está tomada. Se corta explícito y con mensaje, en vez de
// borrar a medias.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "La función no está configurada." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Necesitás una sesión." }, 401);
  }

  // Paso 1: quién llama. Se valida el token con el cliente ANON, no con el
  // service role: es la única forma de que el token mande y no el body.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    return json({ error: "Tu sesión no es válida. Volvé a loguearte." }, 401);
  }

  const userId = user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Paso 2: el rol decide qué se borra. Sale de la base, no del cliente.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, role, organization_id")
    .eq("id", userId)
    .maybeSingle();

  const role = (profile?.role as string | undefined) ?? "MEMBER";

  if (role === "GYM_OWNER" || role === "ADMIN") {
    return json(
      {
        error:
          "Las cuentas de dueño todavía no se pueden eliminar desde la app: la organización y los datos de tus alumnos dependen de ella. Escribinos y lo resolvemos a mano.",
      },
      409
    );
  }

  if (role === "TRAINER") {
    // Decisión tomada con el dueño del producto: las rutinas que creó el
    // entrenador QUEDAN en el gimnasio. Nadie se queda sin rutina porque su
    // entrenador se dio de baja.
    //
    // Por qué se reasignan en vez de dejarse como están: `created_by` y
    // `assigned_by` apuntan al usuario de auth; borrarlo con filas que lo
    // referencian falla por FK. Pasarlas al dueño del gimnasio mantiene la
    // rutina viva, la deja con un responsable real y no toca el esquema.
    const { data: owner } = await admin
      .from("user_profiles")
      .select("id")
      .eq("organization_id", profile?.organization_id)
      .in("role", ["GYM_OWNER", "ADMIN"])
      .limit(1)
      .maybeSingle();

    if (!owner) {
      return json(
        { error: "No encontramos al dueño del gimnasio para transferirle tus rutinas." },
        409
      );
    }

    const { error: templatesError } = await admin
      .from("routine_templates")
      .update({ created_by: owner.id })
      .eq("created_by", userId);

    if (templatesError) {
      return json({ error: "No se pudieron transferir tus rutinas: " + templatesError.message }, 500);
    }

    const { error: assignmentsError } = await admin
      .from("routines")
      .update({ assigned_by: owner.id })
      .eq("assigned_by", userId);

    if (assignmentsError) {
      return json(
        { error: "No se pudieron transferir tus asignaciones: " + assignmentsError.message },
        500
      );
    }

    // La invitación con la que entró guarda su email: es dato personal y se
    // va con la cuenta.
    if (user.email) {
      await admin.from("trainer_invitations").delete().eq("email", user.email);
    }
  }

  if (role === "MEMBER") {
    // Orden de abajo hacia arriba: primero lo que referencia al socio, al
    // final el socio. Al revés falla por FK.
    const { data: members } = await admin.from("members").select("id").eq("user_id", userId);

    const memberIds = ((members as { id: string }[] | null) ?? []).map((m) => m.id);

    if (memberIds.length > 0) {
      const { error: logError } = await admin
        .from("exercise_log")
        .delete()
        .in("member_id", memberIds);

      if (logError) {
        return json({ error: "No se pudo borrar tu historial: " + logError.message }, 500);
      }

      const { error: routinesError } = await admin
        .from("routines")
        .delete()
        .in("member_id", memberIds);

      if (routinesError) {
        return json({ error: "No se pudieron borrar tus rutinas: " + routinesError.message }, 500);
      }

      const { error: membersError } = await admin.from("members").delete().in("id", memberIds);

      if (membersError) {
        return json({ error: "No se pudo borrar tu ficha: " + membersError.message }, 500);
      }
    }
  }

  // La foto de perfil también es dato personal, y el bucket `avatars` es
  // público: si no se borra, la URL sigue sirviendo la cara de alguien que
  // pidió que se borre su cuenta.
  const { data: avatarFiles } = await admin.storage.from("avatars").list(userId);

  if (avatarFiles && avatarFiles.length > 0) {
    await admin.storage
      .from("avatars")
      .remove(avatarFiles.map((file: { name: string }) => `${userId}/${file.name}`));
  }

  // Paso 3: el perfil y, por último, la cuenta de auth. Si esto último
  // fallara, el usuario queda sin datos pero con login: se avisa, en vez de
  // devolver un ok que no es cierto.
  const { error: profileError } = await admin.from("user_profiles").delete().eq("id", userId);

  if (profileError) {
    return json({ error: "No se pudo borrar tu perfil: " + profileError.message }, 500);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return json(
      {
        error:
          "Se borraron tus datos pero no se pudo cerrar la cuenta. Escribinos para terminar de darla de baja.",
      },
      500
    );
  }

  return json({ ok: true }, 200);
});
