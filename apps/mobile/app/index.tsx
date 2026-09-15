import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, typography } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { fetchMemberLink } from "@/utils/gymAuth";

const MIN_SPLASH_MS = 3000;

// Splash y bifurcación de arranque. UNA sola decisión, y se toma acá:
//
//   sin sesión          -> /login
//   con sesión, con vínculo de socio -> /home
//   con sesión, sin vínculo          -> /link-gym
//
// El vínculo se consulta con my_member_link() contra la base, no contra
// AsyncStorage: es un hecho del servidor, no un dato de sesión. Si viviera en
// el cliente, cambiar de teléfono te desvincularía y un socio dado de baja
// seguiría entrando hasta limpiar el cache.
//
// Los 3 segundos de splash ya estaban y acá pagan solos: cubren el viaje de
// la consulta sin que aparezca un segundo spinner.
export default function Splash() {
  const { session, loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !minTimeElapsed) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const link = await fetchMemberLink();
        if (!cancelled) router.replace(link ? "/home" : "/link-gym");
      } catch {
        // Si la consulta falla (sin red), se manda a vincular en vez de
        // dejarlo en el splash para siempre: esa pantalla muestra el error y
        // deja reintentar, y si ya estaba vinculado la RPC responde
        // 'already_linked' y lo pasa derecho al home.
        if (!cancelled) router.replace("/link-gym");
      }
    })();

    return () => {
      cancelled = true;
    };
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
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    ...typography.h1,
    color: colors.textPrimary,
  },
});
