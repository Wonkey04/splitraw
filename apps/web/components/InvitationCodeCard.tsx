"use client";

import { useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { invitationCodeError, updateInvitationCode } from "@/lib/invitationCode";

interface InvitationCodeCardProps {
  organizationId: string;
  code: string;
  plan: string;
  onCodeChange?: (code: string) => void;
}

// El código de vinculación del gimnasio: lo que el dueño le dicta al socio
// una sola vez para que entre. Vive en organizations.invitation_code.
//
// El botón "Regenerar" que había acá se sacó a propósito. Regenerar invalida
// de golpe todos los códigos ya repartidos, sin que el dueño se entere de que
// eso es lo que hace; y encima estaba roto (chocaba contra el UNIQUE y dejaba
// al gimnasio sin código). En Pro el código se EDITA, que es la operación que
// el dueño realmente quiere: poner uno que se pueda dictar por teléfono.
export default function InvitationCodeCard({
  organizationId,
  code,
  plan,
  onCodeChange,
}: InvitationCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = plan === "pro" || plan === "enterprise";

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Usá este código para registrarte en SplitRaw: ${code}`
  )}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Seleccionalo y copialo a mano.");
    }
  }

  async function handleSave() {
    setError(null);
    const formatError = invitationCodeError(draft);
    if (formatError) {
      setError(formatError);
      return;
    }

    setSaving(true);
    const result = await updateInvitationCode(organizationId, draft);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.code) onCodeChange?.(result.code);
    setEditing(false);
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-h3">Código de tu gimnasio</h2>
        <Badge variant={canEdit ? "primary" : "neutral"}>{canEdit ? "Plan Pro" : "Plan free"}</Badge>
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          <Input
            label="Código"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="GYMFENIX"
            className="font-mono"
          />
          <p className="text-small text-textSecondary">
            Entre 6 y 8 caracteres. Sin I, O, 0 ni 1, para que no se confundan
            al dictarlo.
          </p>
          {error && <p className="text-small text-error">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(code);
                setError(null);
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded border border-border bg-bgSecondary p-4">
            <p className="select-all font-mono text-[22px] font-bold tracking-[0.15em] text-accent">
              {code}
            </p>
            <p className="mt-2 text-body text-textSecondary">
              Compartilo con tus alumnos. Lo usan una sola vez, cuando se
              registran en la app.
            </p>
          </div>

          {error && <p className="mt-2 text-small text-error">{error}</p>}

          <div className="mt-4 flex flex-col gap-2">
            <Button fullWidth onClick={handleCopy}>
              {copied ? "Copiado" : "Copiar código"}
            </Button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded border border-border px-4 py-2 text-center text-body font-medium text-textPrimary transition-colors hover:bg-bgTertiary"
            >
              Enviar por WhatsApp
            </a>
          </div>

          {canEdit ? (
            <button
              type="button"
              className="mt-3 text-small font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => {
                setDraft(code);
                setEditing(true);
              }}
            >
              Editar código
            </button>
          ) : (
            <p className="mt-4 text-small text-textSecondary">
              Con el plan Pro podés elegir tu propio código.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
