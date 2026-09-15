import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  userId: "gym_user_id",
  organizationId: "gym_organization_id",
  branchId: "gym_branch_id",
  gymCode: "gym_code",
} as const;

// El contexto de gimnasio YA NO SE CACHEA acá.
//
// Estas cuatro claves guardaban organización, sucursal y código del socio
// para tenerlos sin ir a la red. Se dejaron de escribir porque el vínculo es
// un hecho del servidor, no un dato de sesión: vive en la tabla `members` y
// se consulta con my_member_link(). Cachearlo traía dos problemas reales —
// cambiar de teléfono o borrar los datos de la app te "desvinculaba", y un
// socio dado de baja seguía entrando hasta que el cache se limpiara solo.
// (loadGymSession, además, no tenía un solo caller.)
//
// clearGymSession queda para barrer las claves viejas de los teléfonos que ya
// las tienen escritas: se llama al cerrar sesión y al borrar la cuenta.
export async function clearGymSession(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
