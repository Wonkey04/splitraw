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
// GYM_OWNER: Apple/Google exigen que CUALQUIER cuenta se pueda dar de baja
// desde la app, así que ya no se puede cortar acá con un mensaje. La
// decisión de qué pasa con el resto del gimnasio (migración 0023): se borra
// todo lo que es DEL gimnasio (sucursales, rutinas, historial, invitaciones,
// código, la organización), pero los entrenadores y socios NO se borran —
// quedan con la cuenta viva y organization_id/branch_id en NULL. Nadie pidió
// que se borre su cuenta más que el dueño.
//
// ADMIN sigue bloqueado a propósito: dar de baja el gimnasio entero es una
// decisión que le corresponde al dueño, no a cualquiera con ese rol.

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

  if (role === "ADMIN") {
    return json(
      {
        error:
          "Las cuentas de administrador todavía no se pueden eliminar desde la app. Escribinos y lo resolvemos a mano.",
      },
      409
    );
  }

  if (role === "GYM_OWNER" && profile?.organization_id) {
    // delete_organization_cascade() valida el rol y la organización con la
    // sesión de quien llama (auth.uid()), no con lo que decida este
    // servidor — por eso se invoca con callerClient (lleva el JWT del
    // usuario) y no con admin (service role, sin auth.uid()).
    const { error: cascadeError } = await callerClient.rpc("delete_organization_cascade", {
      p_org_id: profile.organization_id,
    });

    if (cascadeError) {
      return json(
        { error: "No se pudo dar de baja el gimnasio: " + cascadeError.message },
        500
      );
    }
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

    // exercise_logs.logged_by también apunta a este usuario (el trainer
    // puede cargar el peso por el socio, ver migración 0013) y no tiene
    // ON DELETE CASCADE: si se deja como está, borrar auth.users más abajo
    // falla por FK en cuanto exista una sola fila logueada por este
    // entrenador. Mismo criterio que routines/routine_templates: se
    // reasigna al dueño, no se borra el registro del socio.
    const { error: logsError } = await admin
      .from("exercise_logs")
      .update({ logged_by: owner.id })
      .eq("logged_by", userId);

    if (logsError) {
      return json(
        { error: "No se pudieron transferir tus cargas registradas: " + logsError.message },
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

    // exercise_log (singular) es la excepción: su member_id NO apunta a
    // members.id, apunta a user_profiles.id (== este mismo userId) — las
    // dos tablas de log usan la misma columna para dos cosas distintas,
    // ver docs/decisions.md. Antes esto filtraba por memberIds (members.id)
    // y no borraba NADA; lo que realmente limpiaba el historial era el
    // ON DELETE CASCADE de exercise_log hacia user_profiles, que corre más
    // abajo cuando se borra el profile. Se corrige para que el borrado sea
    // explícito y no dependa en silencio de un efecto secundario de otra
    // tabla.
    const { error: logError } = await admin.from("exercise_log").delete().eq("member_id", userId);

    if (logError) {
      return json({ error: "No se pudo borrar tu historial: " + logError.message }, 500);
    }

    if (memberIds.length > 0) {
      // exercise_logs (plural) y body_metrics sí usan members.id. Ninguna
      // de las dos tiene ON DELETE CASCADE hacia members, así que si el
      // socio tiene una sola fila ahí el DELETE de members de abajo falla
      // por FK. Hoy las dos tablas están vacías en producción, pero
      // exercise_logs ya tiene UI real que le escribe (drill-down del
      // trainer), así que dejar de borrarlas acá era un fallo esperando
      // pasar, no algo hipotético.
      const { error: exerciseLogsError } = await admin
        .from("exercise_logs")
        .delete()
        .in("member_id", memberIds);

      if (exerciseLogsError) {
        return json(
          { error: "No se pudo borrar tu historial de cargas: " + exerciseLogsError.message },
          500
        );
      }

      const { error: bodyMetricsError } = await admin
        .from("body_metrics")
        .delete()
        .in("member_id", memberIds);

      if (bodyMetricsError) {
        return json(
          { error: "No se pudieron borrar tus métricas: " + bodyMetricsError.message },
          500
        );
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
