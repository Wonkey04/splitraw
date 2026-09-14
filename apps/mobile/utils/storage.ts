import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  userId: "gym_user_id",
  organizationId: "gym_organization_id",
  branchId: "gym_branch_id",
  gymCode: "gym_code",
} as const;

export interface GymSession {
  userId: string;
  organizationId: string;
  branchId: string;
  gymCode: string;
}

// El token de sesión ya lo persiste supabase-js solo (ver lib/supabase.ts,
// storage: AsyncStorage). Acá solo cacheamos el contexto de gym (org/branch)
// para tenerlo disponible sync/sin ir a la red apenas se loguea.
export async function saveGymSession(session: GymSession): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.userId, session.userId],
    [KEYS.organizationId, session.organizationId],
    [KEYS.branchId, session.branchId],
    [KEYS.gymCode, session.gymCode],
  ]);
}

export async function loadGymSession(): Promise<GymSession | null> {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const map = Object.fromEntries(entries);

  const userId = map[KEYS.userId];
  const organizationId = map[KEYS.organizationId];
  const branchId = map[KEYS.branchId];
  const gymCode = map[KEYS.gymCode];

  if (!userId || !organizationId || !branchId || !gymCode) return null;

  return { userId, organizationId, branchId, gymCode };
}

export async function clearGymSession(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
