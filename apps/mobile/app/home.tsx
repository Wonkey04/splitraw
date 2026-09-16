import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Badge, Banner, Card, Icon } from "@/components/ui";
import { WeekSelector } from "@/components/WeekSelector";
import { RoutineTodayCard } from "@/components/RoutineTodayCard";
import { NoRoutineCard } from "@/components/NoRoutineCard";
import { dayLabel, getTodayDayOfWeek } from "@/constants/days";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useHomeOverview } from "@/hooks/useHomeOverview";
import { useRoutineOfDay } from "@/hooks/useRoutineOfDay";
import { colors, spacing, typography, withAlpha } from "@/theme";
import { estimateDurationMinutes } from "@/utils/routineEstimate";

const todayDayOfWeek = getTodayDayOfWeek();

// Pantallas del roadmap: se listan sin onPress hasta que existan (Fase 3/4).
// Al implementarlas se saca el badge y la opacidad, y se agrega la
// navegación real.
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
  const { daysWithRoutine, weeklyRoutineCount, gymName, branchLabel, muscleGroupByExercise } =
    useHomeOverview(member);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user]);

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
  const hasRoutineToday = !routineLoading && exercises.length > 0;

  // name y surname viajan separados en el metadata (signup los pide en dos
  // campos). Para el saludo alcanza el nombre; los initials del avatar
  // necesitan los dos, si no un socio con apellido cargado se queda con una
  // sola letra en el círculo.
  const profileMetadata = user?.user_metadata as { name?: string; surname?: string } | undefined;
  const profileName = profileMetadata?.name ?? null;
  const profileFullName = [profileMetadata?.name, profileMetadata?.surname].filter(Boolean).join(" ") || null;
  const expired = isExpired(member?.activation_expires_at);

  const heroLabel = isToday ? "Rutina de hoy" : "Rutina del " + dayLabel(currentDay).toLowerCase();
  const emptyTitle = isToday
    ? "Sin rutina para hoy"
    : "Sin rutina para el " + dayLabel(currentDay).toLowerCase();

  // TODO(backend): todavía no hay forma de contactar al entrenador desde acá
  // (ni su teléfono es visible para el socio por RLS, ni existe una tabla de
  // notificaciones internas). Cuando eso exista, acá va el link de WhatsApp
  // o el insert que dispare la notificación — por ahora se lo decimos claro
  // en vez de simular un envío que no pasa.
  function handleNotifyTrainer() {
    Alert.alert(
      "Próximamente",
      "Todavía no podés avisarle a tu entrenador desde la app. Hablalo directamente con él."
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profileFullName, member?.email)}</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.date}>{formatToday()}</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              Hola, {displayName(profileName, member?.email)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            onPress={() => router.push("/profile")}
            hitSlop={12}
            style={styles.profileButton}
          >
            <Icon name="person" size={18} color={colors.textSecondary} />
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

            {/* Dos componentes distintos, no un mismo hero con datos en
                cero: "sin rutina" no es una rutina de 0 ejercicios, es otra
                situación (avisarle al entrenador, no "ver rutina"). */}
            {routineLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : hasRoutineToday ? (
              <RoutineTodayCard
                label={heroLabel}
                routineName={routineName ?? ""}
                exerciseCount={exercises.length}
                durationMinutes={durationMinutes}
                onPress={() => router.push({ pathname: "/routine/[day]", params: { day: currentDay } })}
              />
            ) : (
              <NoRoutineCard title={emptyTitle} onNotifyTrainer={handleNotifyTrainer} />
            )}

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{weeklyRoutineCount}</Text>
                <Text style={styles.statLabel}>
                  {weeklyRoutineCount === 1 ? "Rutina esta semana" : "Rutinas esta semana"}
                </Text>
              </Card>

              <Card style={styles.statCard}>
                {muscleFocus ? (
                  <Text style={styles.statValue} numberOfLines={1}>
                    {muscleFocus}
                  </Text>
                ) : (
                  <Text style={styles.statValueEmpty} numberOfLines={1}>
                    {isToday ? "Sin rutina hoy" : "Sin rutina"}
                  </Text>
                )}
                <Text style={styles.statLabel}>Grupo foco de hoy</Text>
              </Card>
            </View>

            <Text style={styles.sectionLabel}>Tu gimnasio</Text>
            <Card style={styles.gymCard}>
              <Icon name="pin" size={20} color={colors.textSecondary} />
              <View style={styles.gymText}>
                <Text style={styles.gymName} numberOfLines={1}>
                  {gymName ?? "Gimnasio no disponible"}
                </Text>
                {branchLabel && (
                  <Text style={styles.branchName} numberOfLines={1}>
                    {branchLabel}
                  </Text>
                )}
              </View>
            </Card>

            <Text style={styles.sectionLabel}>Próximamente</Text>
            <View style={styles.upcomingGroup}>
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
const PROFILE_BUTTON_SIZE = 36;

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
  profileButton: {
    width: PROFILE_BUTTON_SIZE,
    height: PROFILE_BUTTON_SIZE,
    borderRadius: PROFILE_BUTTON_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
  statValueEmpty: {
    ...typography.body,
    fontStyle: "italic",
    color: colors.textSecondary,
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
  gymText: {
    flex: 1,
    minWidth: 0,
  },
  gymName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  branchName: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Sección atenuada a propósito: solo para lo que todavía no existe. Una
  // función real (ej. "Mi perfil") nunca se mezcla acá.
  upcomingGroup: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.bgSubtle,
  },
  upcomingRow: {
    opacity: 0.65,
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
    color: colors.textSecondary,
    flex: 1,
    minWidth: 0,
  },
});
