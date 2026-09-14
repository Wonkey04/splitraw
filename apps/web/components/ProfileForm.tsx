"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import { initialsOf, uploadAvatar } from "@/lib/avatar";
import { Badge, Button, Card, Input } from "@/components/ui";

// Pantalla de Perfil, compartida entre el GYM_OWNER (/dashboard/profile) y
// el TRAINER (/trainer/profile): los datos personales viven en la misma
// tabla y se editan igual, lo unico que cambia es el layout que la envuelve.
// La app mobile tiene su propia pantalla (React Native no comparte
// componentes con la web) pero escribe exactamente las mismas columnas.
//
// Alcance a proposito: nombre, apellido y foto. Cambiar email o contraseña
// NO entra aca — eso toca auth.users y es otro flujo.
export default function ProfileForm() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useUserProfile();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  /** Lo que se ve: la foto guardada, o el preview local de la recien elegida. */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // El form arranca con lo que ya hay cargado. Corre cuando el perfil
  // termina de cargar, no solo al montar.
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setSurname(profile.surname ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  // El preview es un object URL: hay que revocarlo o cada foto elegida deja
  // un blob colgado en memoria.
  useEffect(() => {
    if (!pendingFile) return;

    const objectUrl = URL.createObjectURL(pendingFile);
    setAvatarUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingFile]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSaved(false);
    setPendingFile(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!user || !profile) {
      setError("Tu sesión expiró, volvé a loguearte.");
      return;
    }

    setSaving(true);

    // La foto primero: si falla la subida no se guarda nada, asi no queda un
    // avatar_url apuntando a algo que no existe.
    let nextAvatarUrl = profile.avatar_url ?? null;

    if (pendingFile) {
      const { url, error: uploadError } = await uploadAvatar(user.id, pendingFile);

      if (uploadError || !url) {
        setSaving(false);
        setError(uploadError ?? "No se pudo subir la foto.");
        return;
      }
      nextAvatarUrl = url;
    }

    // surname es NOT NULL en la base: vacio se guarda como "" y no como null.
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        name: name.trim(),
        surname: surname.trim(),
        avatar_url: nextAvatarUrl,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError("No se pudieron guardar los cambios: " + updateError.message);
      return;
    }

    setPendingFile(null);
    setAvatarUrl(nextAvatarUrl);
    setSaved(true);
    // El nav y el resto de las pantallas leen el perfil del contexto: sin
    // esto siguen mostrando el nombre viejo hasta recargar.
    await refresh();
  }

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  if (!profile) {
    return <p className="text-body text-error">No se encontró tu perfil. Volvé a loguearte.</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-h1">Mi perfil</h1>

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // <img> y no next/image: la URL sale del bucket de Supabase y
              // configurar remotePatterns para una foto de perfil es mas
              // ruido que beneficio.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Tu foto de perfil"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bgTertiary text-h3 text-textSecondary">
                {initialsOf(name, surname, user?.email)}
              </div>
            )}

            <div className="flex flex-col items-start gap-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? "Cambiar foto" : "Subir foto"}
              </Button>
              {pendingFile && (
                <span className="text-small text-textSecondary">
                  Se sube al guardar ({pendingFile.name}).
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickFile}
            />
          </div>

          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Apellido" value={surname} onChange={(e) => setSurname(e.target.value)} />

          {/* El email se muestra pero no se edita: vive en auth.users y
              cambiarlo es otro flujo (fuera del alcance de esta pantalla). */}
          <div className="flex flex-col gap-1">
            <span className="text-label text-textSecondary">Email</span>
            <span className="text-body text-textSecondary">{user?.email ?? "-"}</span>
          </div>

          {error && <p className="text-small text-error">{error}</p>}
          {saved && <Badge variant="success">Cambios guardados</Badge>}

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
