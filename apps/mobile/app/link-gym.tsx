import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { router } from "expo-router";
import { Button, Input } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { GymAuthError, linkMemberByCode } from "@/utils/gymAuth";
import { clearGymSession } from "@/utils/storage";

// Pantalla de vinculación: un input y un botón.
//
// Es el ÚNICO lugar donde se pide el código del gimnasio, y se ve una sola
// vez en la vida del usuario. Una vez que la fila de `members` existe, el
// arranque de la app manda derecho al home y este código no se vuelve a
// pedir nunca — el vínculo vive en la base, no en la sesión.
//
// No hay aprobación manual del dueño: el código ya es el secreto compartido.
// El socio entra hoy, que es el día que tiene ganas, y el dueño lo ve en su
// lista y puede darlo de baja si no corresponde. Confiar primero, moderar
// después.
export default function LinkGym() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!code.trim()) {
      setError("Ingresá el código de tu gimnasio.");
      return;
    }

    setLoading(true);
    try {
      const name = (user?.user_metadata as { name?: string } | undefined)?.name ?? null;
      const result = await linkMemberByCode(code, name);

      if (result.status === "invalid") {
        // Error en pantalla, sin salir de acá: el socio corrige el código y
        // reintenta sin perder el contexto.
        setError(result.message ?? "Ese código no corresponde a ningún gimnasio.");
        return;
      }
      if (result.status === "limit_reached") {
        // El mensaje viene del trigger de límite de plan, ya escrito. No es
        // culpa del socio, así que se le dice qué hacer.
        setError(
          `${result.message ?? "El gimnasio llegó a su límite de miembros."} Hablá con tu gimnasio.`
        );
        return;
      }

      // 'linked' y 'already_linked' terminan igual: adentro.
      router.replace("/home");
    } catch (err) {
      setError(err instanceof GymAuthError ? err.message : "Sin conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    await clearGymSession();
    router.replace("/login");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sumate a tu gimnasio</Text>
        <Text style={styles.subtitle}>
          Pedile el código a tu gimnasio. Lo vas a necesitar una sola vez.
        </Text>

        <Input
          label="Código del gimnasio"
          containerStyle={styles.field}
          inputStyle={styles.codeInput}
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setError(null);
          }}
          placeholder="GYMFENIX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button fullWidth loading={loading} onPress={handleSubmit} style={styles.submit}>
          Entrar
        </Button>

        <Pressable onPress={handleSignOut} hitSlop={8} style={styles.signOut} disabled={loading}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  // El código se dicta y se tipea: centrado y espaciado para poder
  // verificarlo carácter por carácter contra el papel.
  codeInput: {
    textAlign: "center",
    letterSpacing: 4,
    ...typography.h3,
  },
  error: {
    ...typography.small,
    color: colors.error,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.sm,
  },
  signOut: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  signOutText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
