"use client";

import { Button, Card } from "@/components/ui";

interface InvitationCodeCardProps {
  code: string;
  regenerating: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  copied: boolean;
}

export default function InvitationCodeCard({
  code,
  regenerating,
  onCopy,
  onRegenerate,
  copied,
}: InvitationCodeCardProps) {
  // Abre WhatsApp Web/app con el mensaje pre-cargado para que el owner
  // solo tenga que elegir el contacto y enviar.
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Usá este código para registrarte en SplitRaw: ${code}`
  )}`;

  return (
    <Card>
      <h2 className="mb-4 text-h3">Código de invitación de tu gimnasio</h2>

      <div className="rounded border border-border bg-bgSecondary p-4">
        <p className="select-all font-mono text-h1 text-accent">{code}</p>
        <p className="mt-2 text-body text-textSecondary">
          Compartí este código con tus alumnos para que se registren en la app.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="flex-1" onClick={onCopy} disabled={regenerating}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded border border-border px-4 py-2 text-center text-body font-medium text-textPrimary transition-colors hover:bg-bgTertiary"
        >
          Enviar por WhatsApp
        </a>
        <Button variant="destructive" className="flex-1" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? "Regenerando..." : "Regenerar"}
        </Button>
      </div>
    </Card>
  );
}
