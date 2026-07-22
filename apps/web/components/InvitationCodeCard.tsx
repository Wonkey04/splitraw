"use client";

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
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold">Código de invitación de tu gimnasio</h2>

      <div className="rounded-lg bg-bg px-4 py-4">
        <p className="select-all font-mono text-3xl font-bold text-primary">{code}</p>
        <p className="mt-1 text-sm text-text-secondary">
          Compartí este código con tus alumnos para que se registren en la app.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-primary flex-1" onClick={onCopy} disabled={regenerating}>
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded bg-[#25D366] px-4 py-2 text-center font-medium text-white hover:brightness-95"
        >
          Enviar por WhatsApp
        </a>
        <button
          className="flex-1 rounded bg-error px-4 py-2 font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? "Regenerando..." : "Regenerar"}
        </button>
      </div>
    </div>
  );
}
