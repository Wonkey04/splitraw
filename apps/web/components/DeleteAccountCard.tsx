"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

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
        setError(message ?? "No se pudo eliminar la cuenta. Probá de nuevo.");
        setDeleting(false);
        return;
      }

      // La cuenta ya no existe: la sesion que quedo en el navegador tiene que
      // irse igual, antes de volver a la landing.
      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      setError("No se pudo eliminar la cuenta. Revisá tu conexión.");
      setDeleting(false);
    }
  }

  return (
    <Card className="mt-6 flex flex-col items-start gap-3 border-error">
      <div>
        <h2 className="text-h3">Eliminar mi cuenta</h2>
        <p className="mt-1 text-body text-textSecondary">
          Se borran tus datos personales y tu historial. No se puede deshacer.
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
