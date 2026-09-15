import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Badge, Banner, Card, Icon } from "@/components/ui";
import { WeekSelector } from "@/components/WeekSelector";
import { dayLabel, getTodayDayOfWeek } from "@/constants/days";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useHomeOverview } from "@/hooks/useHomeOverview";
import { useRoutineOfDay } from "@/hooks/useRoutineOfDay";
import { colors, radius, spacing, typography, withAlpha } from "@/theme";
import { clearGymSession } from "@/utils/storage";
import { estimateDurationMinutes } from "@/utils/routineEstimate";

const todayDayOfWeek = getTodayDayOfWeek();

// Pantallas del roadmap: se listan sin onPress hasta que existan (Fase 3/4).
// Al implementarlas se saca el badge y la opacidad, y se agrega la
// navegación real. "Mi perfil" ya salió de acá: es /profile.
const UPCOMING_ITEMS = ["Mis rutinas de la semana"];

// "Hola, Juan". El nombre sale del metadata del usuario de auth, que es
// donde lo deja el registro: `members` NO tiene columna de nombre (se
// verificó contra la base real), y el `full_name` que se leía antes siempre
// venía undefined, así que el saludo caía siempre en el email.
function displayName(fullName?: string | null, email?: string): string {
  const name = fullName?.trim();
  if (name) return name.split(" ")[0];
  return email?.split("@")[0] ?? "";
}

function initials(fullName?: string | null, email?: string): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }
  return (email?.charAt(0) ?? "?").toUpperCase();
}

// Vencido = hay fecha Y ya pasó. Sin fecha NO es vencido: el gimnasio cobra
// por fuera de SplitRaw, así que un socio del que no se cargó vencimiento no
// tiene por qué ver un aviso de deuda.
function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });
}

function formatToday(): string {
  const formatted = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { member, loading: memberLoading, error: memberError } = useCurrentMember(user?.id);
  const [currentDay, setCurrentDay] = useState(todayDayOfWeek);

  const { routineName, exercises, loading: routineLoading, error: routineError } = useRoutineOfDay(
    member?.id,
    currentDay
  );
  const { daysWithRoutine, weeklyRoutineCount, branchLabel, muscleGroupByExercise } =
    useHomeOverview(member);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user]);

  async function handleLogout() {
    await supabase.auth.signOut();
    await clearGymSession();
    router.replace("/login");
  }

  // Grupo con más ejercicios en el día seleccionado. Los ejercicios cargados
  // a mano (fuera del catálogo) no tienen grupo, así que puede no haber dato.
  const muscleFocus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exercise of exercises) {
      const group = muscleGroupByExercise.get(exercise.name);
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }

    let top: string | null = null;
    let topCount = 0;
    for (const [group, count] of counts) {
      if (count > topCount) {
        top = group;
        topCount = count;
      }
    }
    return top;
  }, [exercises, muscleGroupByExercise]);

  const durationMinutes = estimateDurationMinutes(exercises);
  const isToday = currentDay === todayDayOfWeek;
  const loading = authLoading || memberLoading;
  const error = memberError ?? routineError;

  const profileName = (user?.user_metadata as { name?: string } | undefined)?.name ?? null;
  const expired = isExpired(member?.activation_expires_at);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profileName, member?.email)}</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.date}>{formatToday()}</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              Hola, {displayName(profileName, member?.email)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            onPress={handleLogout}
            hitSlop={12}
            style={styles.logoutButton}
          >
            <Icon name="logout" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Plan vencido: aviso suave y NADA MÁS. No se bloquea el acceso ni
            se esconde la rutina. El gimnasio cobra por fuera de SplitRaw:
            nosotros reflejamos el estado del pago, no lo decidimos. Cortarle
            la rutina al socio por una fecha que quizás ya arregló en el
            mostrador lo convertiría en un problema nuestro. */}
        {!loading && expired && member?.activation_expires_at && (
          <Banner
            variant="warning"
            style={styles.banner}
            title="Tu plan venció"
            message={`Venció el ${formatExpiry(member.activation_expires_at)}. Hablá con tu gimnasio para renovarlo.`}
          />
        )}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!loading && error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && (
          <>
            <WeekSelector
              currentDay={currentDay}
              daysWithRoutine={daysWithRoutine}
              onSelectDay={setCurrentDay}
            />

            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.heroHeaderText}>
                  <Text style={styles.heroLabel}>
                    {isToday ? "Rutina de hoy" : "Rutina del " + dayLabel(currentDay).toLowerCase()}
                  </Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {routineName ?? "Sin rutina asignada"}
                  </Text>
                </View>
                <Icon name="list" size={20} color={colors.accent} />
              </View>

              <View style={styles.heroMetrics}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue}>{exercises.length}</Text>
                  <Text style={styles.heroMetricLabel}>
                    {exercises.length === 1 ? "Ejercicio" : "Ejercicios"}
                  </Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue}>
                    {durationMinutes > 0 ? durationMinutes + " min" : "-"}
                  </Text>
                  <Text style={styles.heroMetricLabel}>Duración estimada</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: exercises.length === 0 }}
                disabled={exercises.length === 0 || routineLoading}
                onPress={() => router.push({ pathname: "/routine/[day]", params: { day: currentDay } })}
                style={[styles.heroButton, exercises.length === 0 && styles.heroButtonDisabled]}
              >
                <Text style={styles.heroButtonText}>Ver rutina completa</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{weeklyRoutineCount}</Text>
                <Text style={styles.statLabel}>
                  {weeklyRoutineCount === 1 ? "Rutina esta semana" : "Rutinas esta semana"}
                </Text>
              </Card>

              <Card style={styles.statCard}>
                <Text style={styles.statValue} numberOfLines={1}>
                  {muscleFocus ?? "-"}
                </Text>
                <Text style={styles.statLabel}>Grupo foco de hoy</Text>
              </Card>
            </View>

            <Text style={styles.sectionLabel}>Tu gimnasio</Text>
            <Card style={styles.gymCard}>
              <Icon name="pin" size={20} color={colors.textSecondary} />
              <Text style={styles.gymName} numberOfLines={2}>
                {branchLabel ?? "Sucursal no disponible"}
              </Text>
            </Card>

            <Text style={styles.sectionLabel}>Próximamente</Text>
            <View style={styles.upcomingGroup}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/profile")}
                style={styles.upcomingRow}
              >
                <Text style={styles.linkText}>Mi perfil</Text>
              </Pressable>

              {UPCOMING_ITEMS.map((item, index) => (
                <View
                  key={item}
                  style={[
                    styles.upcomingRow,
                    index === UPCOMING_ITEMS.length - 1 && styles.upcomingRowLast,
                  ]}
                >
                  <Text style={styles.upcomingText}>{item}</Text>
                  <Badge variant="neutral">Pronto</Badge>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 38;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: withAlpha(colors.accent, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  date: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  greeting: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  logoutButton: {
    padding: spacing.xs,
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  banner: {
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },

  // Único bloque del panel con fondo distinto al resto.
  hero: {
    backgroundColor: withAlpha(colors.accent, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    borderRadius: radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  heroLabel: {
    ...typography.label,
    color: colors.accent,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  heroMetric: {
    flexShrink: 1,
  },
  heroMetricValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  heroMetricLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  heroButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  heroButtonDisabled: {
    opacity: 0.5,
  },
  heroButtonText: {
    ...typography.body,
    fontWeight: "500",
    color: colors.bgPrimary,
  },

  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  gymCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  gymName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },

  upcomingGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
  },
  upcomingRow: {
    opacity: 0.55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  upcomingRowLast: {
    borderBottomWidth: 0,
  },
  upcomingText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  // Las filas que ya son navegables se distinguen por color, no por icono:
  // el resto de la lista sigue siendo texto muerto con badge "Pronto".
  linkText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "500",
    flex: 1,
    minWidth: 0,
  },
});
