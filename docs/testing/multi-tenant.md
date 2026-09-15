# Test de aislamiento multi-tenant

Verifica el criterio de aceptación del bloque: **dos gimnasios se registran
desde cero, cada uno genera su código, miembros distintos se vinculan a cada
uno, y ninguno ve nada del otro — sin ninguna intervención manual en la base.**

Son dos capas. La automatizada prueba las reglas de la base, que es donde vive
el aislamiento; la manual prueba la pantalla, que es lo que la otra no puede
ver. Hacen falta las dos.

---

## 1. Automatizado (antes de tocar producción)

```bash
./supabase/tests/run.sh
```

Levanta un Postgres descartable, reproduce el esquema de producción
(`supabase/tests/fixture_schema.sql`), aplica `0013`-`0017` y corre 47
chequeos: alta de dos gimnasios, aislamiento cruzado, vinculación por código,
límites de plan y las tres reglas de vencimiento. Tienen que pasar todos.

Si se toca una migración, esto se corre de nuevo **antes** de aplicarla en
Supabase.

---

## 2. Auditoría contra la base real

Correr `supabase/audit/tenant_isolation_audit.sql` en el SQL editor **antes y
después** de aplicar las migraciones. Es de solo lectura.

Lo que tiene que dar después:

| Chequeo | Resultado esperado |
|---|---|
| 0 · columnas de `user_profiles` | anotar el resultado en `docs/decisions.md` — resuelve la contradicción del volcado |
| 1 · RLS por tabla | ninguna tabla con datos de gimnasio en `rls_activo = false` |
| 2 · RLS activo y cero policies | **cero filas** |
| 3 · policies abiertas (`qual`/`with_check` = true) | **cero filas** |
| 7 · códigos por organización | ninguna organización sin `invitation_code` |

El chequeo 3 es el central. Si devuelve aunque sea una fila sobre una tabla con
datos de gimnasio, el aislamiento sigue roto: en Postgres las policies
PERMISSIVE se combinan con OR y una sola abierta anula a todas las acotadas.

---

## 3. Orden de aplicación

Las migraciones van en orden y **`0013` y el build de mobile salen juntos**:
`0013` dropea `members_insert_self`, que es la policy que sostiene el registro
de socios de la app vieja. Entre una cosa y la otra, ningún socio nuevo puede
registrarse.

```
0013_tenant_isolation_repair.sql      ← primero, bloquea todo lo demás
0014_organizations_tenant_columns.sql
0015_onboarding_and_linking.sql
0016_plan_limits.sql
0017_member_expiry.sql
```

---

## 4. Manual por la UI

### 4.1 Alta de dos gimnasios

Dos navegadores distintos (o uno en incógnito), **sin tocar Supabase en ningún
momento**.

1. Gym A: `/signup` → email + contraseña + nombre → `/create-gym` → "Gym A",
   Río Tercero, Córdoba, "Sucursal Centro".
2. Gym B: lo mismo con "Gym B", Rosario, Santa Fe, "Sucursal Norte".
3. Cada dashboard abre con su código a la vista. **Anotar los dos.**
   - Son de 8 caracteres, distintos, sin I/O/0/1.
   - "Copiar" deja el código en el portapapeles.
   - En plan free **no hay** botón de regenerar ni de editar.
4. Cada uno crea una rutina: "Upper Lower A" y "Full Body B".

✅ Owner A ve solo "Gym A", su sucursal y su rutina. Nada de B.

### 4.2 El chequeo que importa: REST directo

La UI filtra por organización en algunas queries y en otras no
(`RoutineDetail.tsx:42` y `lib/memberName.ts:15-19` traen por id sin filtro).
Que la pantalla no muestre datos ajenos no prueba nada: hay que pedirlos.

Con el token de A y un id de B:

```bash
TOKEN_A="<access_token del owner A>"   # DevTools → Application → Local Storage
URL="https://<proyecto>.supabase.co/rest/v1"
ANON="<anon key>"

# Todos tienen que devolver [] — no un error, una lista vacía.
curl -s "$URL/organizations?select=*"             -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A"
curl -s "$URL/branches?select=*"                  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A"
curl -s "$URL/routine_templates?id=eq.<id de B>"  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A"
curl -s "$URL/members?id=eq.<member de B>"        -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_A"
```

✅ `organizations` y `branches` devuelven **solo los de A**. Los dos pedidos por
id de B devuelven `[]`.

❌ Si alguno trae datos de B, parar: falta aplicar `0013` o quedó una policy
abierta. Correr el chequeo 3 de la auditoría.

### 4.3 Vinculación de socios

En la app móvil, dos cuentas distintas:

1. Registro: email + contraseña + nombre. **No se pide ningún código.**
2. Al terminar cae en la pantalla de vinculación.
3. Socio A entra el código de Gym A → home.
4. Socio B entra el código de Gym B → home.
5. **Cerrar y reabrir la app con cada uno:** entra directo al home. El código
   **no** se vuelve a pedir. Esto es lo que prueba que el vínculo vive en la
   base y no en la sesión.
6. Código inventado (`ZZZZZZZZ`) → error en pantalla, sin salir de ahí.
7. Socio A entra el código de **Gym B** estando ya vinculado → sigue en Gym A
   (la RPC responde `already_linked`; no lo muda de gimnasio).

✅ Owner A ve a Socio A en su lista y no a Socio B. Socio A ve la rutina de A y
nunca la de B.

### 4.4 Límites de plan

Con Gym A en `free` (sucursales 1, miembros 10, trainers 3):

- Crear una 2ª sucursal → *"Límite del plan free alcanzado: hasta 1 sucursal.
  El plan Pro permite 3."*
- Invitar un 4º entrenador → mismo formato, con entrenadores. El error aparece
  **al invitar**, no cuando el entrenador acepta.
- Con 10 socios, el 11º que se vincula ve el mensaje del límite en la pantalla
  de vinculación.

**Repetirlo por REST**, que es donde se prueba que el límite es de backend:

```bash
curl -s -X POST "$URL/branches" -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d '{"organization_id":"<org de A>","name":"colada"}'
```

✅ Rebota con el mismo mensaje. Si entra, el límite está solo en la UI.

Levantar el plan a mano y confirmar que el techo sube al instante:

```sql
UPDATE organizations SET plan = 'pro' WHERE name = 'Gym A';
```

### 4.5 Vencimiento

```sql
UPDATE members SET activation_expires_at = now() - interval '1 day'
WHERE email = '<socio A>';
```

- Dashboard del dueño: badge **vencido**; el filtro "Vencidos" lo trae y "Al
  día" no.
- App del socio: banner de plan vencido **y la rutina se ve completa**. El
  acceso no se bloquea — SplitRaw refleja el estado del pago, no lo decide.
- "Renovar 30 días" en la fila → pasa a activo. Renovar de nuevo extiende desde
  el vencimiento, no desde hoy.
- El socio **no** puede correrse su propia fecha:

```bash
curl -s -X PATCH "$URL/members?user_id=eq.<uid del socio>" -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN_SOCIO" -H "Content-Type: application/json" \
  -d '{"activation_expires_at":"2030-01-01"}'
```

✅ No cambia nada (`members_update_self` se dropeó en `0013`).

### 4.6 No romper al trainer

El flujo del entrenador no se tocó, pero los triggers de cupo lo rozan:

1. Invitar un entrenador desde `/dashboard/employees` → llega el mail.
2. Aceptar en `/accept-invite?token=...` y elegir contraseña.
3. `/trainer` abre con las rutinas de su gimnasio y **solo** los socios de su
   sucursal.
4. Asignar una rutina a un socio funciona igual que antes.

---

## Criterio de salida

Todo lo de arriba en verde, incluidos los `curl`. Si la UI se ve bien pero un
`curl` trae datos ajenos, **no está listo**: la UI no es la barrera.
