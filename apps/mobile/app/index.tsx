import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";

const MIN_SPLASH_MS = 3000;

// Muestra el logo un minimo de 3 segundos mientras se resuelve la sesion de
// Supabase, y una vez ambas condiciones se cumplen redirige a /home o /login.
export default function Splash() {
  const { session, loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && minTimeElapsed) {
      router.replace(session ? "/home" : "/login");
    }
  }, [loading, minTimeElapsed, session]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>BulkNode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "bold",
  },
});
