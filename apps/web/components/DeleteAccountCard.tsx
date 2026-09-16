"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import { Button, Card, Input } from "@/components/ui";

/** Lo que hay que escribir para habilitar el botón. */
const CONFIRM_WORD = "ELIMINAR";

// "Eliminar mi cuenta" de la pantalla de Perfil.
//
// El borrado real lo hace la Edge Function `delete-account`: sacar una fila
// de auth.users necesita la service_role key, que nunca puede viajar al
// cliente. Esta pantalla solo confirma y llama.
//
// La confirmacion es ESCRITA a proposito: un "¿estas seguro?" con un boton
// al lado se acepta sin leer, y esto no se puede deshacer.
export default function DeleteAccountCard() {
  const router = useRouter();
  const { profile } = useUserProfile();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farewell, setFarewell] = useState(false);

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  const isOwner = profile?.role === "GYM_OWNER";

  async function handleDelete() {
    setError(null);

    if (!confirmed) return;

    setDeleting(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });

      // functions.invoke da un error generico cuando la funcion responde con
      // un status de error: el mensaje util viene en el body.
      const message = (data as { error?: string } | null)?.error;

      if (invokeError || message) {
        const friendly = message ?? "No se pudo eliminar la cuenta. Probá de nuevo.";
        setError(friendly);
        // alert() a propósito, además del texto en pantalla: es el detalle
        // crudo (status, nombre del error) para debuggear qué está pasando
        // realmente, no el mensaje lindo que ve un usuario final.
        window.alert(
          "Error al eliminar la cuenta:\n\n" +
            `Mensaje: ${friendly}\n` +
            `invokeError: ${invokeError ? JSON.stringify(invokeError, null, 2) : "ninguno"}\n` +
            `data: ${data ? JSON.stringify(data, null, 2) : "ninguno"}`
        );
        setDeleting(false);
        return;
      }

      // La cuenta ya no existe en el servidor, pero la sesión del navegador
      // sigue viva unos segundos a propósito: el guard de /dashboard y
      // /trainer reacciona apenas signOut() vacía la sesión y redirige de
      // inmediato, así que si se cerraba sesión primero el mensaje de
      // despedida nunca llegaba a pintarse (el layout ya había navegado).
      // Por eso el orden es mostrar -> esperar -> recién ahí signOut + volver.
      setFarewell(true);
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/");
      }, 2200);
    } catch (err) {
      const friendly = "No se pudo eliminar la cuenta. Revisá tu conexión.";
      setError(friendly);
      window.alert(
        "Error al eliminar la cuenta:\n\n" +
          `Mensaje: ${friendly}\n` +
          `Excepción: ${err instanceof Error ? err.stack ?? err.message : JSON.stringify(err)}`
      );
      setDeleting(false);
    }
  }

  if (farewell) {
    return (
      <Card className="mt-6 flex flex-col items-center gap-2 text-center">
        <h2 className="text-h3">Lamentamos que te hayas ido 😢</h2>
        <p className="text-body text-textSecondary">Tu cuenta se eliminó correctamente. ¡Gracias por haber probado SplitRaw!</p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 flex flex-col items-start gap-3 border-error">
      <div>
        <h2 className="text-h3">Eliminar mi cuenta</h2>
        <p className="mt-1 text-body text-textSecondary">
          {isOwner
            ? "Además de tu cuenta, esto da de baja TODO tu gimnasio: sucursales, rutinas, historial e invitaciones. Tus entrenadores y socios no pierden su cuenta, pero quedan sin gimnasio. No se puede deshacer."
            : "Se borran tus datos personales y tu historial. No se puede deshacer."}
        </p>
      </div>

      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Eliminar mi cuenta
        </Button>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <Input
            label={`Escribí ${CONFIRM_WORD} para confirmar`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
          />

          {error && <p className="text-small text-error">{error}</p>}

          <div className="flex items-center gap-2">
            <Button variant="destructive" disabled={!confirmed || deleting} onClick={handleDelete}>
              {deleting ? "Eliminando..." : "Eliminar definitivamente"}
            </Button>
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
