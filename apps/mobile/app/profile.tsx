import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Badge, Button, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { colors, radius, spacing, typography } from "@/theme";
import { initialsOf, uploadAvatar } from "@/utils/avatar";

const AVATAR_SIZE = 96;

/** La foto elegida en el picker, todavía sin subir. */
interface PendingPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

// Mi perfil (MEMBER): nombre, apellido y foto. Escribe las MISMAS columnas
// que la pantalla de perfil de la web, pero via la RPC save_member_profile
// (0012) y no con un update directo: el socio puede no tener fila en
// user_profiles todavia — el signup mobile crea `members` y no siempre el
// perfil — y esa funcion la crea con el rol y la organizacion sacados de su
// ficha de socio, sin que el cliente los pueda elegir.
//
// Fuera de alcance a proposito: email y contraseña.
export default function Profile() {
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      try {
        // maybeSingle y no single: no tener perfil todavia es un caso
        // normal, no un error.
        const { data } = await supabase
          .from("user_profiles")
          .select("name, surname, avatar_url")
          .eq("id", user!.id)
          .maybeSingle();

        if (cancelled || !data) return;

        setName((data.name as string) ?? "");
        setSurname((data.surname as string) ?? "");
        setAvatarUrl((data.avatar_url as string | null) ?? null);
      } catch {
        if (!cancelled) setError("Sin conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handlePickPhoto() {
    setError(null);
    setSaved(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Necesitamos permiso a tus fotos para cambiar el avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      // La foto se sube desde base64: RN no resuelve bien un uri file://
      // a bytes (ver utils/avatar.ts). quality baja el peso antes de subir.
      base64: true,
      quality: 0.6,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      setError("No se pudo leer la imagen elegida.");
      return;
    }

    setPendingPhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!user) {
      setError("Tu sesión expiró, volvé a entrar.");
      return;
    }

    setSaving(true);

    try {
      // La foto primero: si falla la subida no se guarda nada, asi no queda
      // un avatar_url apuntando a algo que no existe.
      let nextAvatarUrl = avatarUrl;

      if (pendingPhoto) {
        const { url, error: uploadError } = await uploadAvatar(
          user.id,
          pendingPhoto.base64,
          pendingPhoto.mimeType
        );

        if (uploadError || !url) {
          setError(uploadError ?? "No se pudo subir la foto.");
          return;
        }
        nextAvatarUrl = url;
      }

      const { error: rpcError } = await supabase.rpc("save_member_profile", {
        p_name: name.trim(),
        p_surname: surname.trim(),
        p_avatar_url: nextAvatarUrl,
      });

      if (rpcError) {
        setError("No se pudieron guardar los cambios: " + rpcError.message);
        return;
      }

      setAvatarUrl(nextAvatarUrl);
      setPendingPhoto(null);
      setSaved(true);
    } catch {
      setError("Sin conexión.");
    } finally {
      setSaving(false);
    }
  }

  // Lo que se ve: la foto recien elegida si hay, si no la guardada.
  const shownPhoto = pendingPhoto?.uri ?? avatarUrl;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {/* Mismo "Volver" que la pantalla de rutina: el set de iconos no
              tiene flecha y no vale sumar una dependencia por esto. */}
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>Volver</Text>
          </Pressable>
          <Text style={styles.title}>Mi perfil</Text>
        </View>

        {(authLoading || loading) && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!authLoading && !loading && (
          <>
            <View style={styles.avatarBlock}>
              {shownPhoto ? (
                <Image source={{ uri: shownPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {initialsOf(name, surname, user?.email)}
                  </Text>
                </View>
              )}

              <Button variant="secondary" onPress={handlePickPhoto}>
                {shownPhoto ? "Cambiar foto" : "Subir foto"}
              </Button>

              {pendingPhoto && <Text style={styles.hint}>Se sube al guardar.</Text>}
            </View>

            <Input
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Juan"
              autoCapitalize="words"
            />
            <Input
              label="Apellido"
              value={surname}
              onChangeText={setSurname}
              placeholder="Pérez"
              autoCapitalize="words"
            />

            {/* El email se muestra pero no se edita: vive en auth.users y es
                otro flujo. */}
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.readOnlyValue}>{user?.email ?? "-"}</Text>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
            {saved && <Badge variant="success">Cambios guardados</Badge>}

            <Button fullWidth onPress={handleSave} loading={saving} disabled={saving}>
              Guardar cambios
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  back: { ...typography.body, color: colors.accent, fontWeight: "500" },
  title: { ...typography.h2, color: colors.textPrimary },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  avatarBlock: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgTertiary,
  },
  avatarText: { ...typography.h2, color: colors.textSecondary },
  hint: { ...typography.small, color: colors.textSecondary },
  readOnlyField: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  readOnlyValue: {
    ...typography.body,
    color: colors.textSecondary,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: { ...typography.small, color: colors.error },
});
