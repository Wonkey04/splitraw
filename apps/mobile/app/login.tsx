import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Button, Input } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { isValidEmail } from "@/utils/validation";

// Login y registro del socio.
//
// El campo "Código de gimnasio" se sacó de las dos pantallas. Era el primer
// campo del formulario y se pedía en CADA ingreso, cuando en realidad es un
// evento que pasa una sola vez en la vida del usuario. Ahora el registro es
// email + contraseña + nombre, y la vinculación vive en /link-gym.
export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { loading, error, setError, login, signup } = useSupabaseAuth();
  const isSignup = mode === "signup";
  const displayError = fieldError ?? error;

  function clearErrors() {
    setFieldError(null);
    setError(null);
  }

  function toggleMode() {
    setMode(isSignup ? "login" : "signup");
    clearErrors();
  }

  async function handleSubmit() {
    clearErrors();

    if (!isValidEmail(email)) {
      setFieldError("Email inválido.");
      return;
    }
    if (isSignup && password.length < 8) {
      setFieldError("Contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!isSignup && password.length === 0) {
      setFieldError("Ingresá tu contraseña.");
      return;
    }

    if (isSignup) {
      if (!name.trim()) {
        setFieldError("Ingresá tu nombre.");
        return;
      }

      const ok = await signup({ email, password, name: name.trim(), surname: surname.trim() });
      // Recién registrado: no puede tener vínculo todavía, así que va directo
      // a vincularse. No se le pregunta el código antes de tener cuenta.
      if (ok) router.replace("/link-gym");
    } else {
      const ok = await login({ email, password });
      // El index resuelve la bifurcación (¿tiene vínculo?) consultando la
      // base. Acá no se decide: el dato no está en el cliente.
      if (ok) router.replace("/");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>BulkNode</Text>

        <Input
          label="Email"
          containerStyle={styles.field}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearErrors();
          }}
          placeholder="tu@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Input
          label="Contraseña"
          containerStyle={styles.field}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearErrors();
          }}
          placeholder="••••••"
          secureTextEntry
        />

        {isSignup && (
          <>
            <Input
              label="Nombre"
              containerStyle={styles.field}
              value={name}
              onChangeText={(value) => {
                setName(value);
                clearErrors();
              }}
              placeholder="Juan"
            />
            <Input
              label="Apellido"
              containerStyle={styles.field}
              value={surname}
              onChangeText={(value) => {
                setSurname(value);
                clearErrors();
              }}
              placeholder="Pérez"
            />
          </>
        )}

        {displayError && <Text style={styles.error}>{displayError}</Text>}

        <Button fullWidth loading={loading} onPress={handleSubmit} style={styles.submit}>
          {isSignup ? "Crear cuenta" : "Ingresar"}
        </Button>

        <Pressable onPress={toggleMode} hitSlop={8} style={styles.toggle} disabled={loading}>
          <Text style={styles.toggleText}>
            {isSignup ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate"}
          </Text>
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
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  field: {
    marginBottom: spacing.md,
  },
  error: {
    ...typography.small,
    color: colors.error,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.sm,
  },
  toggle: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  toggleText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "500",
  },
});
