# DECISIONS.md — SplitRaw / BulkNode

> Registro cronológico de decisiones de producto y arquitectura. Cada entrada
> queda fija — si una decisión se revierte, se agrega una entrada nueva que
> lo diga, no se borra la vieja. Esto es historia, no un doc que se reescribe.

---

## 2026-09 — Rebranding a light premium

**Decisión:** se abandona el dark-first (`#0B0F14` / `#111827`) por un sistema
light premium (`#FFFFFF` / `#F8F9FA`, acento `#1E3A8A`).

**Por qué:** para dueños de gimnasio B2B, el blanco lee como "enterprise serio"
y justifica pricing. El dark leía a gamer/startup, no a herramienta de gestión
seria.

**Detalle completo:** `/docs/BRANDING.md`

---

## 2026-09 — Pivot de foco: de "app bonita para el socio" a "resolver el papel"

**Contexto que lo disparó:** conversación sobre cómo trabaja hoy el gimnasio
piloto (Río Tercero) con su método actual: 100 rutinas armadas en Excel,
impresas, el alumno tacha a mano el peso durante la semana, el entrenador
sube cargas/repeticiones después.

**Lo que reveló esa conversación, en 3 respuestas concretas del dueño:**
1. El alumno anota su propio peso en papel durante la semana.
2. El entrenador ajusta cargas/repeticiones después, en base a eso.
3. Lo que más tiempo consume HOY no es el registro — es **armar el plan
   personalizado por alumno, imprimirlo, y sostener que el alumno sea
   constante anotando**.

**Conclusión:** el cuello de botella no es visual ni de UI. Es de velocidad
para el entrenador/dueño (armar 50 planes parecidos-pero-no-iguales) y de
fricción cero para el alumno (competir contra "tachar un número en una hoja
pegada en la pared", que es rapidísimo).

**Qué se reordena:**

| Antes | Ahora |
|---|---|
| Pulir home mobile, branding, "Accesos" | En pausa, ya está aceptable como está |
| Fase 3: onboarding de TRAINER | Baja de prioridad — no es lo que traba hoy |
| Fase 2: `exercise_log` completo (form rico) | Sube a prioridad 1, pero **recortado** a versión mínima |
| — | Nuevo: función "duplicar rutina" para el owner/entrenador |

**Fase 2 recortada — hipótesis a validar primero:**
No construir logging completo (sets/reps/peso/notas en formulario) todavía,
porque puede tener la misma fricción que el papel y no probaría nada. Versión
mínima:
- Por ejercicio del día: un tap — "lo hice" / "no lo hice"
- Opcional: ajustar peso con stepper +/-, sin formulario ni texto libre

Si esa versión de un tap no logra más adopción que el papel, el problema no
es de UX — es que el canal celular personal pierde contra una hoja fija en
la pared, y ahí se replantea el canal (¿tablet fija en el gym en vez de
celular del socio?).

**Función pendiente de especificar:** "duplicar rutina existente y ajustar
solo lo que cambia" — ataca directamente el dolor de armar 50 planes
parecidos desde cero.

**Estado:** decisión de dirección tomada. Falta: especificar y armar brief
de la versión mínima de logging + la función de duplicar rutina.

---

## Cómo usar este archivo

Cada vez que se tome una decisión de producto que cambie prioridades, se
agrega una entrada nueva arriba (orden cronológico ascendente, la más
reciente al final) con: contexto que la disparó, la decisión, y qué se
reordena o qué queda como deuda pendiente. Sin esto, las prioridades se
pierden entre sesiones.

## 2026-09 — Logging mínimo: un botón por día, no por ejercicio
 
**Decisión:** la versión mínima de `exercise_log` es un solo botón "Completé
el entrenamiento de hoy" por rutina del día — no un tilde por ejercicio
individual.
 
**Por qué:** menos pasos = menos fricción = más probabilidad de que el
socio realmente lo use (modelo de comportamiento de Fogg: B=MAP, bajar la
"habilidad requerida" al mínimo). Tildar ejercicio por ejercicio suma
fatiga de decisión equivalente a un formulario, aunque visualmente parezca
simple. Se acepta como trade-off consciente: datos algo optimistas pero con
alta tasa de uso, en vez de datos exactos que nadie carga.
 
**Duplicar rutina — pospuesto, no descartado.** Se había priorizado como
la feature que más tiempo le ahorra al owner/entrenador hoy, pero se decide
ir primero con el logging porque valida la hipótesis más riesgosa (¿el
socio realmente va a registrar algo desde el celular?). Duplicar rutina
queda documentado como pendiente para cuando el logging esté validado.
 
## 2026-09 — day_of_week es simbólico, no un calendario obligatorio
 
**Contexto:** al probar el botón "Completé el entrenamiento", Claude Code
había restringido su visibilidad a que el día viendo coincidiera con la
fecha real del dispositivo (interpretación propia del brief, no pedida
explícitamente). Eso reveló un problema más de fondo: `exercises.day_of_week`
está guardado como día real de calendario (1=lunes...7=domingo), pero en la
práctica "Upper Lower x3" significa "3 veces por semana", no días fijos —
un socio puede entrenar martes/jueves/sábado con la misma rutina.
 
**Decisión de corto plazo:** el botón se muestra en cualquier día con
ejercicios cargados, sin exigir coincidencia con la fecha real. El registro
en `exercise_log` sigue usando la fecha real de hoy — eso sí es correcto.
 
**Decisión pendiente, NO se hace ahora:** rediseñar `day_of_week` como
"Día 1/2/3" desacoplado del calendario real, en vez de lunes/miércoles/
viernes fijos. Toca schema + selector semanal del home + asignación de
rutina. Se pospone para no arriesgar lo ya validado. Queda como deuda
técnica de modelo de datos.
 
---

## 2026-09 — Duplicar rutina: se descarta el botón/RPC aislado, se integra al flujo de Crear Rutina

**Contexto:** se había especificado (y llegó a implementarse) un botón
"Duplicar" suelto en la lista de rutinas, respaldado por una RPC
`duplicate_routine_template` que copiaba el template + sus exercises
server-side. Al revisar el flujo completo con el dueño, esa acción quedaba
desconectada de dónde el owner realmente la necesita: el momento en que ya
está por crear una rutina nueva.

**Decisión:** se descarta el botón "Duplicar" y la RPC
`duplicate_routine_template` (no se implementa). En su lugar, "Crear rutina"
gana un paso 0 — "¿Cómo querés empezar?" con las opciones "Desde cero" o
"Traer de una rutina existente". Elegir una rutina existente precarga el
mismo formulario de creación en el **cliente** (nombre, descripción,
ejercicios, sets, reps, peso) a partir de los datos ya cargados del
gimnasio — no hay copia server-side. El submit sigue siendo el INSERT de
"crear rutina" de siempre, así que el resultado es una rutina nueva e
independiente, igual que antes.

**Por qué:** UX más natural — el owner ya está en el contexto de "estoy
creando algo nuevo", así que partir de una rutina existente es una opción
dentro de ese flujo, no una acción aparte que hay que descubrir y aprender
en la lista. También evita mantener una segunda vía (RPC transaccional)
para lograr lo mismo que ya hace el formulario de creación.

**Cómo aplica:** cualquier trabajo futuro sobre "empezar una rutina a partir
de otra" debe vivir dentro de `/dashboard/routines/create`, no como acción
separada en la lista de rutinas.

---

## 2026-09 — [SUPERADA] Código de invitación en tabla propia (`gym_invitation_codes`)

> **Superada el 2026-09-15** por "El código de vinculación se muda a
> `organizations`" (más abajo). La tabla no se dropeó: quedó como respaldo del
> backfill. Lo que dejó de ser cierto es que el código viva ahí.

La decisión original (migraciones `0001` y `0003`) fue darle al código una
tabla propia con `UNIQUE(organization_id)` y un puntero de vuelta desde
`organizations.invitation_code_id`. En la práctica eso era una relación 1-a-1
disfrazada de tabla, y el `UNIQUE` terminó rompiendo el botón "Regenerar".

---

## 2026-09 — Invitación de trainer por Resend (no Supabase Auth invite), 30 min de vida

**Decisión:** el alta de un TRAINER arranca con el owner cargando nombre +
email + sucursal en `/dashboard/employees`. Eso inserta una fila en
`trainer_invitations` con un `token` uuid de un solo uso que vence a los 30
minutos, y manda el mail con **Resend**. El trainer abre
`/accept-invite?token=...`, elige contraseña, y recién ahí se crea su
`user_profiles` con `role = 'TRAINER'` y la org/sucursal que venían en el
token.

**Por qué Resend y no el invite nativo de Supabase Auth:** el invite de
Supabase manda al usuario a un flujo de recuperación de contraseña genérico
y no deja pasar metadata de negocio (organización, sucursal, quién invitó)
sin pegarle igual a una tabla propia. Con tabla + token propios el estado de
cada invitación (pendiente / usada / vencida) es un dato consultable, que es
lo que la pantalla del owner necesita mostrar.

**Consecuencia arquitectónica — primer route handler del proyecto:** hasta
acá la app le pegaba a Supabase siempre directo desde el cliente, sin capa
de API. El envío del mail rompe esa regla por necesidad: la API key de
Resend no puede viajar al browser. Vive en
`apps/web/app/api/trainer-invitations/route.ts`, que valida server-side que
quien llama sea GYM_OWNER/ADMIN de esa organización antes de insertar. El
resto de la app sigue sin API routes.

**Variables de entorno nuevas** (no van al repo): `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` (opcional, default `onboarding@resend.dev`) y
`NEXT_PUBLIC_APP_URL` (opcional, default: el origin del request).

**Si el mail falla, la invitación se borra.** Un token que nadie recibió no
le sirve a nadie y solo ensucia el listado: el owner ve el error del envío
en pantalla, no una invitación "pendiente" fantasma.

---

## 2026-09 — Dashboard TRAINER: rutinas compactas, planes en pausa, miembros por sucursal

**Contexto:** TRAINER existía como fila en la tabla `roles` desde el
principio, pero sin una sola policy ni pantalla propia: un trainer logueado
no veía nada. Peor: el login mandaba a todo el mundo a `/dashboard`, cuyo
guard cierra la sesión de quien no sea GYM_OWNER — así que un trainer se
autodeslogueaba al entrar. El login ahora rutea por rol
(`lib/roleRedirect.ts`).

**Decisión — tres secciones en `/trainer`:**

1. **Rutinas.** Ve las de su `organization_id` y puede crear nuevas. Crear
   rutina **reusa el mismo componente** que el owner
   (`components/CreateRoutineForm`), parametrizado solo por a dónde
   redirige. Mismo criterio para ver rutina y asignar
   (`RoutineDetail`, `AssignMemberToRoutine`, `AssignRoutineToMember`).
   El listado es **denso a propósito** (padding vertical mínimo, una fila
   por rutina con nombre + descripción + cantidad de ejercicios en la misma
   línea), siguiendo la referencia Linear/Notion de BRANDING.md: el objetivo
   es ver el listado completo sin scrollear.
2. **Gestión de planes.** Placeholder, sin datos reales, mismo patrón que
   las secciones "Próximamente" del home mobile (card + badge "Pronto").
3. **Miembros.** Solo los de la `branch_id` asignada al trainer.

**El filtro por sucursal es server-side.** Las policies de
`0008_trainer_rls.sql` no le devuelven al trainer members de otra branch
aunque el cliente pida toda la organización. El trainer tampoco puede
invitar trainers (esa policy es GYM_OWNER/ADMIN) ni actualizar
`user_profiles` (no puede cambiar roles, ni el suyo).

**Deuda que esto dejó a la vista, NO resuelta acá:** no existe ninguna tabla
de planes/membresías. El estado de plan que muestra el panel se deriva de
`members.activation_expires_at`, que hoy está en `null` para todos los
socios, así que en la práctica muestra "sin datos". Es un placeholder
honesto hasta que se defina el modelo real de planes — no se inventó una
tabla para llenar la columna.

---

## 2026-09 — "Agregar ejercicio" pasa a botón, y por qué aparecían paréntesis vacíos

**Fix de affordance:** en el form de crear rutina, "Agregar ejercicio" era
texto plano al pie de la tabla y no se leía como acción. Ahora es un botón
secundario del sistema. Los "+" por día siguen exactamente igual: el cambio
es solo visual.

**Hallazgo (investigado antes de tocar nada) — los "Press banca ()":** el
paréntesis vacío es el grupo muscular que no se pudo resolver, y la causa es
de modelo de datos: **`exercises` no tiene ninguna FK al catálogo**, guarda
`name` como texto libre. El grupo muscular solo se conoce en el momento en
que se elige el ejercicio por la cascada (ExerciseSelector); una vez
guardado, se pierde.

Cuando una rutina se precarga desde otra existente, el único modo de
recuperar el grupo es matchear `exercises.name` contra
`exercise_catalog.name`. Contra la base real ese match falla para **18 de
22** nombres distintos: el catálogo está en inglés ("Bench Press", "Barbell
Row") y la rutina real del gimnasio piloto ("Upper Lower x3") está en
castellano ("Press banca", "Sentadilla", "Peso muerto"...), cargada por
fuera de la cascada.

**Qué se hizo ahora:** solo dejar de pintar el paréntesis cuando no hay dato
— no se tocó ni un registro. **Qué queda pendiente de decidir:** si
`exercises` debería tener `exercise_catalog_id`, y qué hacer con los
ejercicios en castellano que hoy no existen en el catálogo (¿se agregan al
catálogo?, ¿el catálogo pasa a castellano?). Es una decisión de producto +
schema, no un bug para tapar.

---

## 2026-09 — Miembros del trainer: paginado server-side, estado de rutina y flujo de asignación con contexto

Cuatro cambios sobre la sección Miembros de `/trainer`, todos disparados por
la misma pregunta: qué pasa cuando el gimnasio tiene cientos de alumnos en
vez de dos.

**1. Paginado y búsqueda en la base, no en el cliente.** Antes la pantalla
traía TODOS los miembros de la sucursal de una, sin `limit`. Ahora va por
páginas de 25 vía la RPC `list_branch_members` (`0009`).

Por qué una función y no un `.select()` con `.range()`: **el nombre del socio
no está en `members`** — esa tabla no tiene columna de nombre, vive en
`user_profiles` ligado por `members.user_id`. Buscar por nombre desde el
cliente obligaría a traerse todas las filas para filtrarlas después, que es
exactamente lo que se quería evitar. Con el JOIN adentro de la función, el
filtro y el `LIMIT` los resuelve Postgres. La función es SECURITY **INVOKER**
(no DEFINER): la RLS del trainer sigue aplicando, y el filtro explícito por
organización + sucursal es la segunda barrera, no la única.

El JOIN es LEFT a propósito: hay `members` sin fila en `user_profiles`, y con
INNER JOIN esos socios desaparecerían del listado sin aviso. El buscador
matchea nombre **y email** justamente porque para esos socios el email es lo
único que hay.

**2. "Con rutina" / "Sin rutina" en cada fila,** con el nombre de la rutina
actual al lado. La misma RPC lo resuelve con un LATERAL: `routines` es un
historial (asignar de nuevo agrega una fila, no pisa la anterior), así que la
rutina "actual" es la última por `assigned_at`.

**3. Confirmación antes de reasignar.** Si el socio ya tiene rutina, el botón
dice "Cambiar rutina" y abre un modal con el nombre de la que ya tiene antes
de seguir. El trainer no debería pisar una rutina activa sin enterarse de
cuál era.

**4. La pantalla de asignar dejó de ser un dropdown suelto.** Ahora tiene
header con el nombre del socio (y su rutina actual como contexto), lista de
cards seleccionables con preview real de cada rutina (cantidad de ejercicios
+ días de la semana), estado vacío con CTA "Crear rutina" en vez de un form
inutilizable, y confirmación explícita al asignar en vez de un redirect
silencioso. La lógica de asignación no cambió: sigue siendo el mismo INSERT
en `routines`.

**Alcance:** esto es la sección del TRAINER. El listado del owner
(`/dashboard/members`) sigue sin paginar — mismo problema latente, queda
pendiente. La pantalla de asignar sí es compartida, así que el rediseño le
llega también al owner.

---

## 2026-09 — Miembros del owner: misma tabla que el trainer, sin filtro de sucursal

Cierra la deuda anotada arriba ("el listado del owner sigue sin paginar").
`/dashboard/members` mostraba Email / Nombre / Acciones, con Nombre siempre
en "-": el nombre del socio no está en `members`, y esa pantalla nunca hizo
el JOIN a `user_profiles`. Además traía todos los members de la organización
de una sola vez, sin `limit`.

**Qué se hizo:** nueva RPC `list_org_members` (`0010`), clon de
`list_branch_members` sin el filtro por sucursal y con una columna extra
`branch_name` — el owner ve toda la organización, así que necesita saber de
qué sucursal es cada socio. Mismo LEFT JOIN a `user_profiles`, mismo LATERAL
para "con rutina / sin rutina" + nombre de la rutina actual, mismo
SECURITY INVOKER.

**Por qué un clon y no un parámetro `p_branch_id` opcional en la función de
0009:** el alcance es justamente lo que separa los dos roles. Una función con
el filtro opcional dejaría que el trainer pase NULL y vea todo el gimnasio —
la RLS lo frenaría, pero el alcance pasaría a depender de un argumento del
cliente en vez de estar fijo en la función que ese rol llama.

**Del lado del cliente**, `TrainerMembersSection` pasó a ser
`MembersSection` con `scope="branch" | "org"`: la tabla, el paginado de 25,
el buscador debounceado y el modal de "ya tiene rutina" son los mismos para
los dos paneles; lo único que cambia es qué RPC llama y si pinta la columna
Sucursal. La pantalla de asignar rutina ya era compartida desde el cambio
anterior, así que el admin ya venía usando las cards con preview.

**Pendiente:** `Member.full_name` sigue declarado en `lib/types.ts` como
opcional aunque la columna no exista en la base — ya no lo usa ninguna
pantalla del owner, pero se deja hasta barrer los últimos usos.

---

## 2026-09 — Crear rutina para un alumno puntual: query param, no flujo paralelo

La pantalla de asignar solo dejaba elegir entre rutinas ya existentes. Si el
owner/trainer quería una rutina puntual para ese alumno tenía que irse a
Rutinas, crearla, volver y buscar al alumno de nuevo.

**Qué se hizo:** una tercera opción abajo de las cards — "+ Crear rutina
nueva para {alumno}" — que lleva a `/…/routines/create?assignToMemberId=<id>`.
El form de creación es **el mismo de siempre**; cuando detecta el param,
después de insertar el template y los ejercicios hace el INSERT en `routines`
con los mismos campos que usa `AssignRoutineToMember`, y vuelve al listado de
miembros en vez de a la ficha de la rutina.

**Por qué un query param y no una pantalla nueva:** misma razón que la
decisión de duplicar rutina — un segundo flujo de creación significa dos
formularios que se van desincronizando. Acá la rama nueva son 10 líneas al
final del submit, no un camino aparte.

**Rutina huérfana:** el INSERT del template y el de la asignación no son una
transacción (son dos llamadas desde el cliente). Si la asignación falla, la
rutina YA existe: la pantalla lo dice explícitamente ("Creada, pero sin
asignar"), con el nombre, un link para asignarla y otro para verla, en vez de
redirigir como si no hubiera pasado nada. Si en cambio el usuario abandona
antes de guardar, no queda nada colgado — el INSERT recién pasa al hacer
"Guardar", y el cartel de arriba lo aclara.

**Pendiente / desvío del brief:** el brief pedía volver "a la ficha del
alumno". Esa ficha no existe todavía como ruta: hoy `/…/members/[id]` solo
tiene `assign-routine`. Se vuelve al listado de miembros (que ya muestra la
rutina actual de cada socio, así que el resultado se ve igual). Cuando exista
la ficha, es cambiar `membersPath`.

---

## 2026-09 — Panel de empleados: el equipo, no solo las invitaciones

`/dashboard/employees` era la pantalla de invitaciones y nada más: el owner
podía invitar entrenadores y ver el estado de los links, pero no tenía
ninguna vista de quién trabaja hoy en el gimnasio.

**Qué se hizo:** la pantalla ahora abre con el equipo (nombre + apellido,
email, rol, sucursal, fecha de alta) y abajo, en la misma vista, el form de
invitar y el listado de invitaciones con su estado. El nav dice "Empleados"
en vez de "Entrenadores", que es lo que la pantalla realmente muestra (el
owner y los admins también salen en la tabla).

**Por qué una RPC SECURITY DEFINER** (`list_org_employees`, `0011`) y no un
`.select()` sobre `user_profiles` como el resto de la app: el **email del
empleado no está en user_profiles** — vive en `auth.users`, y ese esquema no
es accesible desde el rol `authenticated`. Es la misma razón por la que las
funciones de invitación de 0007 son definer. Como en una definer la RLS del
caller no aplica, el chequeo de permisos es explícito y es lo primero que
hace la función: GYM_OWNER/ADMIN y solo de su propia organización.

Los JOIN a `auth.users` y a `branches` son LEFT: un perfil cuyo usuario de
auth ya no existe, o con una sucursal borrada, tiene que seguir apareciendo
con la celda vacía en vez de desaparecer del listado sin aviso.

**Alcance:** es de solo lectura a propósito — no hay editar empleado, cambiar
de sucursal ni dar de baja. Eso es otra decisión (¿qué pasa con las rutinas
que creó un trainer al que se da de baja?) y no entra acá.

**Ojo al aplicar 0011:** asume que `user_profiles` tiene `created_at`. Si la
tabla real no lo tiene, la función falla al crearse — es la columna "fecha de
alta" del listado.

---

## 2026-09 — Perfil en los tres roles: bucket público, escritura del dueño

Pantalla de Perfil para GYM_OWNER (`/dashboard/profile`), TRAINER
(`/trainer/profile`) y MEMBER (mobile `/profile`): nombre, apellido y foto.
Alcance acotado a propósito — email y contraseña no se tocan acá, viven en
`auth.users` y son otro flujo.

**Bucket `avatars` público de lectura, escritura solo del dueño** (`0012`).
Público porque la foto se muestra en pantallas donde el que mira no es el
dueño (el owner ve a sus entrenadores, el trainer a sus alumnos): con un
bucket privado habría que firmar una URL por foto y por pantalla, y no hay
nada sensible en un avatar. La escritura se ata a
`avatars/<auth.uid()>/<archivo>` y las policies comparan la primera carpeta
del path contra el uid — **la convención de path es parte del permiso**, no
un detalle de organización.

El nombre del archivo lleva timestamp en vez de ser fijo: pisar el mismo
objeto deja el CDN devolviendo la foto vieja.

**Editar el propio perfil necesitó una policy nueva** (`user_profiles_update_self`)
— hasta ahora los perfiles se creaban y nunca se actualizaban. Como una
policy de UPDATE no puede restringir QUÉ columnas se tocan, un trigger
bloquea los cambios de `role`, `organization_id` y `branch_id` sobre la
propia fila: sin eso, cualquiera se ascendía a GYM_OWNER con un UPDATE
directo por REST.

**El MEMBER no usa ese UPDATE sino la RPC `save_member_profile`**: el socio
puede no tener fila en `user_profiles` todavía (el signup mobile crea
`members` y no siempre el perfil — la misma razón de los LEFT JOIN de 0009),
así que su pantalla a veces tiene que CREAR la fila. Una policy de INSERT no
alcanza porque no puede fijar el `role`: cualquiera sin perfil se insertaría
uno con role GYM_OWNER y el `organization_id` de un gimnasio ajeno. En la
función el rol se fuerza a MEMBER y org/sucursal salen de su propia fila de
`members`.

**Reusar el componente entre web y mobile no se pudo:** React Native no
comparte componentes con React DOM y `packages/shared` está vacío. Lo que se
mantiene en espejo es la LÓGICA (`apps/web/lib/avatar.ts` y
`apps/mobile/utils/avatar.ts`), igual que ya pasa con `types.ts`. La
diferencia real entre las dos: en mobile no hay `File` — ImagePicker devuelve
base64 y Storage necesita bytes, y la conversión se hace a mano porque RN no
trae `atob` ni `Buffer` y `fetch(file://).arrayBuffer()` no es confiable.
Dependencia nueva en mobile: `expo-image-picker`.

---

## 2026-09 — Expiración de sesión: 12 horas, chequeada en el cliente

Supabase renueva el access token solo cada hora, así que hoy una sesión vive
indefinidamente mientras se siga abriendo la app. En una compu del mostrador
del gimnasio eso es una cuenta abierta para siempre.

**Cuánto:** 12 horas, no los 3 días que decía el brief — se acortó a pedido
del dueño del producto ("que sean horas"). Con 12 h, quien entrena a la
mañana y vuelve a la tarde sigue logueado, y una sesión abierta de noche no
llega al día siguiente. El número es UNA constante
(`SESSION_MAX_AGE_HOURS`) en cada app.

**Dónde:** en el hook `useAuth` de las dos apps, que es por donde pasan las
tres superficies (`/dashboard`, `/trainer` y mobile). Al abrir, si la sesión
es vieja se hace `signOut()` y la app cae sola al login por el guard que ya
existía. En mobile además se limpia el contexto de gym cacheado, para que el
próximo login no arranque con la organización del usuario anterior.

**De dónde sale la fecha de login:** de `user.last_sign_in_at`, con un
timestamp propio guardado (localStorage / AsyncStorage) como respaldo. **No**
del `iat` del JWT: ese token se refresca cada hora, así que su `iat` se
renueva y nunca llegaría al límite — es justamente el bug que haría que la
expiración no expirara nunca.

Si no hay forma de saber cuándo fue el login, NO se cierra la sesión: echar a
alguien por las dudas es peor que dejar una sesión de más, y el próximo login
ya deja el timestamp.

**Pendiente de verificar:** el brief pedía revisar antes si el setting nativo
de Supabase (Auth → Sessions → "time-box user sessions") está disponible en
el plan actual. No se pudo verificar desde acá (hace falta entrar al
dashboard) y es un setting de plan pago. Si está disponible, conviene
activarlo igual: el chequeo del cliente no revoca el refresh token del lado
del servidor, solo cierra la sesión en la app. Los dos conviven sin
pisarse — el nativo corta antes.

---

## 2026-09 — Eliminar cuenta: Edge Function, y qué pasa con cada rol

Borrar de `auth.users` requiere la `service_role` key, que nunca puede viajar
al cliente — el mismo problema que ya se resolvió así con Resend. Va entonces
en la Edge Function `delete-account`, donde la key vive en el runtime de
Supabase.

**Nadie borra la cuenta de otro:** el id NO se recibe por parámetro, se saca
del token del que llama (validado con el cliente anon, no con el service
role). Un body con el uid de otra persona no tiene ningún efecto porque no se
lee.

**MEMBER:** se borra de abajo hacia arriba — `exercise_log`, `routines`
asignadas, `members`, la foto del bucket, `user_profiles` y por último
`auth.users`. Al revés falla por FK.

**TRAINER — decisión tomada con el dueño del producto: las rutinas que creó
QUEDAN en el gimnasio.** Nadie se queda sin rutina porque su entrenador se
dio de baja. No pueden quedarse "huérfanas" tal cual están: `created_by` y
`assigned_by` apuntan al usuario de auth y borrarlo con filas que lo
referencian falla por FK. Se **reasignan al dueño del gimnasio** — la rutina
sigue viva, con un responsable real, y no hay que tocar el esquema (la
alternativa era hacer `created_by` nullable con ON DELETE SET NULL). También
se borra la invitación con la que entró, que guarda su email.

**GYM_OWNER: explícitamente fuera de este brief.** Un owner puede ser el
único de una organización con datos de otra gente adentro. La función corta
con un mensaje claro en vez de borrar a medias; qué pasa con la organización
es una decisión de producto todavía sin tomar.

**La confirmación es escrita** ("ELIMINAR"), no un "¿estás seguro?": un botón
al lado de una pregunta se acepta sin leer, y esto no se deshace. Después de
borrar: `signOut()` y afuera — la cuenta ya no existe pero la sesión seguía
en el dispositivo.

**Para que funcione hay que deployarla:** `supabase functions deploy
delete-account`. Hasta entonces el botón existe y falla.

---

---

# Bloque 2026-09-15 — Multi-tenancy real + vinculación de miembros

## [2026-09-15] Las policies `USING (true)` que anulaban todo el aislamiento

**Contexto:** el producto se vendía como multi-gimnasio pero nunca se había
probado con dos. Al volcar el estado real de RLS aparecieron cuatro policies
PERMISSIVE con `USING (true)` / `WITH CHECK (true)` sobre `organizations` y
`branches`, conviviendo con `organizations_select_own` y
`branches_select_own_org` (`0008:128-141`), que están bien escritas. En
Postgres varias policies PERMISSIVE sobre la misma tabla y el mismo comando se
combinan con **OR**: la permisiva gana siempre. Las acotadas no hacían nada.
Cualquier usuario autenticado listaba todas las organizaciones y todas las
sucursales de todos los gimnasios, y podía crear organizaciones y sucursales
en cualquiera.

**Decisión:** dropearlas (`0013`) y reponer solo lo que cada rol necesita:
SELECT acotado por `current_profile_org()`, INSERT/UPDATE de sucursales
limitado a GYM_OWNER/ADMIN de la propia organización. El INSERT de
`organizations` queda **sin ninguna policy**: crear un gimnasio pasa a ser
exclusivamente `create_gym_with_owner()`.

**Justificación:** esto iba primero y bloqueaba todo lo demás. El criterio de
aceptación del bloque —dos gimnasios que no se ven entre sí— es imposible de
cumplir mientras exista una sola policy abierta, por más flujo nuevo que se
construya encima. Agregar policies acotadas sin dropear las permisivas no
habría cambiado absolutamente nada, y es justo el error que ya estaba cometido.

**Alternativas descartadas:** (a) convertir las permisivas en RESTRICTIVE, que
las haría AND en vez de OR — funciona, pero deja en la base dos capas de
policies que hay que leer juntas para entender qué pasa, y la próxima persona
que agregue una permisiva vuelve a abrir todo; (b) filtrar por organización en
cada query del cliente, que es lo que la app ya hace en algunos lados y no
sirve: el browser tiene la anon key y le pega directo al REST.

**Consecuencias:** el aislamiento ahora depende de una sola capa, legible de
corrido. Queda más difícil "probar algo rápido" desde el SQL editor con un
usuario cualquiera, que es exactamente lo que se quiere. Toda policy nueva
sobre una tabla con datos de gimnasio tiene que ir acotada por
`current_profile_org()` desde el primer día.

**Archivos / migraciones afectadas:** `supabase/migrations/0013_tenant_isolation_repair.sql`.

---

## [2026-09-15] `gym_invitation_codes` tenía RLS apagado

**Contexto:** la tabla que guarda el código de cada gimnasio —lo único que
separa a un gimnasio de otro a la hora de vincularse— tenía RLS desactivado.
No era una policy mal escrita: era la tabla abierta. Cualquiera con la anon
key, **sin siquiera estar autenticado**, se llevaba los códigos de todos los
gimnasios. La policy `gym_invitation_codes_select` de `0004:21-26` existía,
pero con RLS apagado era decorativa.

**Decisión:** `ENABLE ROW LEVEL SECURITY` y reemplazar el `USING (true)` por
`organization_id = current_profile_org()` (`0013`).

**Justificación:** con un código ajeno, cualquiera se vinculaba como socio a
cualquier gimnasio. La anon key está embebida en la app móvil: no es un
secreto, es un identificador público.

**Alternativas descartadas:** dropear la tabla directamente, ya que el código
se muda a `organizations` en `0014`. Se descartó porque es el respaldo del
backfill: si el backfill sale mal, esa tabla es la única copia de los códigos
ya repartidos. Se protege ahora y se dropea cuando el backfill esté confirmado.

**Consecuencias:** queda una tabla protegida y sin uso. Es deuda menor y
consciente, anotada acá para que quien la encuentre sepa que no se olvidó.

**Archivos / migraciones afectadas:** `0013_tenant_isolation_repair.sql`.

---

## [2026-09-15] El socio no puede editar su propia fila de `members`

**Contexto:** `members_update_self` (`0004:39-45`) dejaba que cualquier socio
hiciera UPDATE sobre su propia fila. Cuando se escribió, `members` solo tenía
organización y sucursal y la policy parecía inofensiva. No lo era: permitía
mudarse solo a cualquier gimnasio. Y al sumar el vencimiento (Parte 5) pasaba a
permitir que el socio **se renovara el plan a sí mismo** con un `PATCH` al REST.

**Decisión:** dropear `members_update_self` y `members_insert_self`. La
creación del socio pasa a ser exclusiva de `link_member_by_code()` y la
renovación exclusiva de `renew_member()`, ambas SECURITY DEFINER con el
chequeo de permisos explícito adentro. Se agrega `members_select_self`, que es
lo único que el socio realmente necesita: leer su propia fila.

**Justificación:** un vencimiento que el interesado puede editar no es un
vencimiento. Y una policy de UPDATE no puede restringir **qué columnas** se
tocan, así que no había forma de dejarle editar algo inocuo sin darle también
`organization_id` y `activation_expires_at` — el mismo problema que ya se había
resuelto con un trigger en `user_profiles` (`0012`).

**Alternativas descartadas:** un trigger `BEFORE UPDATE` que congelara las
columnas sensibles, como el de `0012`. Se descartó porque acá no queda ninguna
columna que el socio tenga motivo para editar: la lista de columnas
permitidas habría quedado vacía, y una policy que no permite nada es una
policy que no debería existir.

**Consecuencias:** toda escritura sobre `members` pasa por una función con el
permiso chequeado. Sumar un campo que el socio sí deba editar (un teléfono,
por ejemplo) requiere una RPC nueva, no reabrir la policy.

**Archivos / migraciones afectadas:** `0013_tenant_isolation_repair.sql`,
`0015_onboarding_and_linking.sql`, `0017_member_expiry.sql`.

---

## [2026-09-15] El código de vinculación se muda a `organizations`

Supera la decisión marcada como `[SUPERADA]` más arriba.

**Contexto:** el código vivía en `gym_invitation_codes`, con
`UNIQUE(organization_id)` y un puntero de vuelta desde
`organizations.invitation_code_id`. Además el botón "Regenerar" estaba roto:
hacía soft-delete de la fila vigente e insertaba una nueva para la misma
organización, lo que choca contra ese `UNIQUE`. El insert fallaba con `23505`,
`lib/invitationCode.ts` lo interpretaba como colisión de código, reintentaba
cinco veces y se rendía — dejando al gimnasio **sin código activo**, porque el
viejo ya estaba marcado como borrado.

**Decisión:** `organizations.invitation_code TEXT UNIQUE`, con backfill desde
la tabla vieja (`0014`). `gym_invitation_codes` no se dropea.

**Justificación:** el `UNIQUE(organization_id)` ya demostraba que nunca hubo
más de un código por gimnasio: era una relación 1-a-1 disfrazada de tabla. Y el
plan Pro pide que el dueño pueda **editar** su código, que como columna es un
UPDATE trivial y como tabla obligaba a decidir si se pisa la fila o se inserta
otra — que es justo la ambigüedad que produjo el bug.

**Alternativas descartadas:** arreglar "Regenerar" reusando la fila en vez de
insertar. Resolvía el bug sin tocar el modelo, pero dejaba el código como una
entidad con historial que nadie consulta, y la edición de Pro seguía siendo
más complicada de lo necesario.

**Consecuencias:** desaparece un JOIN de todas las lecturas del código. Se
pierde el historial de códigos anteriores (que no se usaba en ninguna
pantalla). `invitation_code_id` queda como columna muerta apuntando al
respaldo; se saca cuando se dropee la tabla vieja.

**Archivos / migraciones afectadas:** `0014_organizations_tenant_columns.sql`,
`apps/web/lib/invitationCode.ts`, `apps/web/components/InvitationCodeCard.tsx`,
`apps/web/lib/types.ts`.

---

## [2026-09-15] Formato del código: 8 caracteres, sin ambiguos, y los de 6 siguen valiendo

**Contexto:** el generador viejo hacía 6 caracteres con `Math.random()` en el
browser. Ya hay códigos de 6 repartidos en el gimnasio piloto.

**Decisión:** los nuevos son de 8, generados en Postgres con
`gen_random_bytes` (`generate_invitation_code()`, `0014`), sobre el charset
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. El CHECK de la columna acepta **6 a 8**,
no 8 exactos.

**Justificación:** el charset excluye I, O, 0 y 1 porque el código se dicta en
voz alta en el mostrador — el costo de una confusión lo paga el socio, que
escribe mal y no entra. `Math.random()` es predecible y esto es el único
secreto que separa un gimnasio de otro, así que la generación tiene que ser
criptográfica y del lado del servidor. El rango 6-8 existe para no invalidar
de golpe códigos que ya están en manos de socios que todavía no se
registraron: el gimnasio no se enteraría hasta que alguien se quejara.

**Alternativas descartadas:** regenerar todos los códigos en la migración para
tener formato uniforme. Más prolijo en la base, y rompe silenciosamente a
gente real.

**Consecuencias:** la validación del campo editable de Pro acepta 6-8, no 8.
Cuando no queden códigos de 6 en circulación se puede endurecer el CHECK; eso
requiere confirmar contra la base, no asumirlo.

**Archivos / migraciones afectadas:** `0014_organizations_tenant_columns.sql`,
`apps/web/lib/invitationCode.ts`.

---

## [2026-09-15] Onboarding self-serve en una transacción, salvo `auth.signUp`

**Contexto:** `/create-gym` hacía cuatro escrituras secuenciales desde el
browser: `signUp`, `organizations`, `branches`, `user_profiles`, más la
generación del código. Si fallaba la tercera o la cuarta quedaban un usuario de
auth y una organización huérfanos —sin sucursal, sin perfil— y el segundo
intento con el mismo email fallaba en `signUp`. El dueño quedaba trabado sin
ninguna salida desde la app.

**Decisión:** una RPC `create_gym_with_owner()` (`0015`) hace organización +
sucursal + perfil + código. El alta se parte en dos pantallas: `/signup` crea
la cuenta, `/create-gym` crea la organización.

**Justificación:** una función plpgsql **ya es** una transacción — no hacía
falta ninguna maquinaria, solo mover los inserts adentro. `auth.signUp()` no
puede correr dentro de Postgres, así que el usuario de auth queda
necesariamente afuera; se acepta y se dice en voz alta en vez de fingir
atomicidad total. Partir las pantallas hace que ese límite sea recuperable: si
la organización falla, la cuenta ya existe y el dueño vuelve a `/create-gym` y
sigue, en vez de chocar contra un `signUp` duplicado.

**Alternativas descartadas:** (a) crear el usuario de auth desde una Edge
Function con la `service_role` key, para meter todo en un solo paso — suma un
servicio más al camino crítico del alta y la transacción de Postgres seguiría
sin cubrir `auth.users`; (b) dejar los inserts en el cliente con rollback
manual, que es escribir a mano lo que la base ya hace bien.

**Consecuencias:** cambiar qué se crea al dar de alta un gimnasio ahora es
tocar una función SQL, no cinco llamadas en un componente. El guard
`ALREADY_HAS_ORG` vive en la RPC, así que vale también si alguien le pega
directo al REST.

**Archivos / migraciones afectadas:** `0015_onboarding_and_linking.sql`,
`apps/web/app/signup/page.tsx` (nuevo), `apps/web/app/create-gym/page.tsx`,
`apps/web/lib/hooks/useOrganization.ts` (nuevo).

---

## [2026-09-15] El código sale del login y pasa a ser un evento único

**Contexto:** `apps/mobile/app/login.tsx` pedía el código del gimnasio como
primer campo, en login **y** en registro, cada vez. Y no validaba nada:
`useSupabaseAuth` lo resolvía, lo cacheaba en AsyncStorage y **nunca** lo
comparaba contra `members.organization_id`. Entrar con el código de otro
gimnasio funcionaba igual. El comentario de `0004` que decía que re-loguearse
con otro código pisaba la fila del socio era falso: el código nunca lo hizo.

**Decisión:** el registro es email + contraseña + nombre. Al abrir la app hay
una sola bifurcación, resuelta con `my_member_link()` contra la base: con
vínculo va al home, sin vínculo va a `/link-gym`, una pantalla nueva de un
input y un botón. Una vez vinculado, el código no se vuelve a pedir nunca.

**Justificación:** el código es un evento de vinculación que ocurre una vez en
la vida del usuario, no una credencial. Pedirlo en cada ingreso le exige al
socio recordar un dato que le dieron una vez en un papel, para nada: no era ni
un factor de autenticación, porque no se verificaba contra el vínculo real.

**El vínculo se consulta al servidor, no al cache**, y esto es lo que más
condiciona hacia adelante: si viviera en AsyncStorage, cambiar de teléfono o
borrar los datos de la app te desvincularía, y un socio dado de baja seguiría
entrando hasta que el cache se limpiara solo. Por eso `utils/storage` dejó de
escribir el contexto de gimnasio.

**Alternativas descartadas:** (a) pedir el código solo en el registro y no en
el login — mejor que lo que había, pero deja el código como parte del alta de
cuenta, cuando el usuario puede querer crearse la cuenta antes de pasar por el
gimnasio; (b) links de invitación por deep link, que es mejor UX pero necesita
que el gimnasio mande un mensaje por socio, cuando hoy dicta un código en el
mostrador.

**Consecuencias:** un usuario puede existir sin gimnasio, que antes era
imposible. Eso obligó a repuntar `email_is_registered()` a `auth.users`
(consultaba `members`, así que le decía "email no registrado" a alguien que sí
tenía cuenta y lo dejaba afuera) y a pasar `useCurrentMember` a
`.maybeSingle()`. Habilita que en el futuro un socio pertenezca a más de un
gimnasio sin rehacer el flujo.

**Archivos / migraciones afectadas:** `0015_onboarding_and_linking.sql`,
`apps/mobile/app/login.tsx`, `apps/mobile/app/index.tsx`,
`apps/mobile/app/link-gym.tsx` (nuevo), `apps/mobile/hooks/useSupabaseAuth.ts`,
`apps/mobile/utils/gymAuth.ts`, `apps/mobile/utils/storage.ts`,
`apps/mobile/hooks/useCurrentMember.ts`.

---

## [2026-09-15] Sin aprobación manual del socio: confiar primero, moderar después

**Contexto:** al vincularse con un código válido, el socio podría quedar
pendiente de que el dueño lo apruebe.

**Decisión:** no hay cola de aprobación. Código válido, socio adentro. El dueño
lo ve en su lista y puede darlo de baja si no corresponde.

**Justificación:** el código ya es el secreto compartido — quien lo tiene, lo
recibió del gimnasio. Una cola de aprobación frena al socio **el día que se
anota**, que es el único día que tiene ganas de instalarse una app y crearse
una cuenta; si le aparece "esperá que te aprueben", vuelve al papel y no
vuelve más. El costo del error es asimétrico: un colado en la lista es un clic
para el dueño, un socio que abandona en el alta no vuelve.

**Alternativas descartadas:** aprobación obligatoria (mata la activación) y
aprobación opcional configurable por gimnasio (es una preferencia que nadie
pidió, y agregar un flag antes de tener el problema es adivinar).

**Consecuencias:** si un código se filtra, entran desconocidos; el daño está
acotado porque un socio solo ve su propia rutina, y el dueño puede cambiar el
código (en Pro) o pedir que se lo cambiemos. Si aparece abuso real, la cola de
aprobación se agrega sin rehacer nada: es un estado más en `members`.

**Archivos / migraciones afectadas:** `0015_onboarding_and_linking.sql`
(`link_member_by_code`), `apps/mobile/app/link-gym.tsx`.

---

## [2026-09-15] El estado del socio se calcula desde una fecha, no es un booleano

**Contexto:** `members` ya tenía `activation_expires_at`, en NULL para todos, y
el panel del trainer mostraba un estado de plan derivado de esa columna que en
la práctica decía "sin datos" siempre. La alternativa natural era un booleano
`activo`.

**Decisión:** el estado se calcula comparando `activation_expires_at` con hoy,
en los tres lugares donde se muestra (listado del dueño, RPC `my_member_link`,
home mobile). No existe ninguna columna de estado.

**Justificación:** un booleano hay que acordarse de apagarlo. Nadie entra un
lunes a marcar como vencidos a los doce socios que vencieron el domingo, así
que a la semana la lista miente y deja de consultarse. Una fecha es un dato
objetivo que se ordena, se filtra y se renueva, y el estado siempre está al día
sin que nadie haga nada.

**NULL no es "vencido", es "sin datos".** Un socio del que todavía no se cargó
vencimiento no tiene por qué aparecer como moroso: el gimnasio recién empieza a
usar SplitRaw y no cargó nada todavía.

**Alternativas descartadas:** (a) booleano toggleado a mano, descartado arriba;
(b) una tabla de pagos/membresías con historial, que es el modelo correcto a
futuro pero pide definir planes, precios y cobros — y hoy el gimnasio cobra en
efectivo por fuera. Inventar esa tabla para llenar una columna sería fingir un
modelo que no existe.

**Consecuencias:** "renovar" es sumarle días a una fecha, no cambiar un estado.
`renew_member()` extiende desde el vencimiento si el socio estaba al día (no se
le comen los días pagos) y desde hoy si estaba vencido (no se le regalan los
días que no pagó). No queda historial de renovaciones: eso llega con la tabla
de pagos, cuando exista.

**Archivos / migraciones afectadas:** `0017_member_expiry.sql`,
`apps/web/components/MembersSection.tsx`, `apps/mobile/app/home.tsx`.

---

## [2026-09-15] El socio vencido ve un banner, no un bloqueo

**Contexto:** con el vencimiento calculado, la decisión obvia era cortarle el
acceso a la rutina al socio vencido.

**Decisión:** banner suave en el home de la app. El acceso **no** se bloquea:
la rutina se ve completa.

**Justificación:** SplitRaw refleja el estado del pago, no lo decide. El
gimnasio cobra por fuera, en efectivo y en el mostrador, así que nuestra fecha
siempre va atrás de la realidad: el socio puede haber pagado hace diez minutos
y que nadie lo haya cargado todavía. Bloquearlo con ese dato convierte un
problema de cobranza del gimnasio en un problema de la app — y el que llama
enojado llama al gimnasio, que es nuestro cliente. Un aviso que el socio le
lleva al mostrador ayuda a cobrar; una pantalla bloqueada solo genera un
reclamo.

**Alternativas descartadas:** (a) bloquear el acceso, descartado arriba; (b) no
mostrar nada, que le saca al gimnasio el único recordatorio automático que
tendría.

**Consecuencias:** el vencimiento nunca puede usarse como control de acceso
mientras el pago viva fuera de SplitRaw. Si algún día se cobra desde acá, el
dato pasa a ser nuestro y esta decisión hay que revisarla — con una entrada
nueva, no editando esta.

**Archivos / migraciones afectadas:** `apps/mobile/components/ui/Banner.tsx`
(nuevo), `apps/mobile/app/home.tsx`.

---

## [2026-09-15] Los límites de plan son triggers de Postgres, no validación de UI

**Contexto:** los planes existían como concepto y no restringían nada. Había
que elegir dónde aplicarlos.

**Decisión:** triggers `BEFORE INSERT` sobre `branches`, `members`,
`user_profiles WHERE role='TRAINER'` y `trainer_invitations` (`0016`). El
mensaje se arma en la base, en castellano, nombrando el límite alcanzado y el
plan que lo levanta, y viaja tal cual hasta la pantalla.

**Justificación:** **esta app no tiene backend.** El browser tiene la anon key
y le escribe directo a Supabase (`apps/web/lib/supabase.ts:9-14`). Un chequeo
en el formulario es una sugerencia: se saltea con un `curl` contra
`/rest/v1/members`. El único lugar donde "backend" existe de verdad es
Postgres. Un trigger no se puede esquivar — ni siquiera con la `service_role`
key, que se saltea la RLS pero no los triggers, que es justamente por qué el
cupo se respeta también en el route handler de invitaciones.

El cupo de trainers se chequea **también al invitar** y no solo al aceptar: si
solo se validara en `user_profiles`, el dueño mandaría el mail, el entrenador
elegiría contraseña y recién ahí explotaría — el error le llegaría a la persona
equivocada, en el peor momento, con una invitación ya quemada.

**Alternativas descartadas:** (a) validar en el cliente, descartado arriba; (b)
meter los chequeos dentro de cada RPC, que cubre las altas que pasan por RPC y
deja destapadas las que escriben directo a la tabla; (c) policies de RLS con el
conteo adentro — funciona, pero una policy solo puede decir "no", sin mensaje:
el dueño vería "violates row-level security policy" en vez de saber cuántos
socios le quedan.

**Consecuencias:** el cambio de plan es un `UPDATE organizations SET plan`, sin
checkout ni pasarela, y el efecto es inmediato. Los límites viven en
`plan_limit()`, un solo lugar. Todo test de alta masiva tiene que tener el plan
en cuenta: en `free` el 11º socio rebota.

**Archivos / migraciones afectadas:** `0016_plan_limits.sql`,
`apps/web/app/api/trainer-invitations/route.ts`,
`apps/mobile/app/link-gym.tsx`.

---

## [2026-09-15] Dos tablas de log en paralelo, y `member_id` significa dos cosas

**Contexto:** al escribirle policies a las tablas que tenían RLS activo y cero
policies apareció que conviven `exercise_log` (singular: completado sí/no por
fecha, lo que usa la Fase 2, `0006`) y `exercise_logs` (plural: peso, reps,
sets, de la feature de weight logging). La plural estaba **inaccesible**: RLS
prendido sin una sola policy, o sea que nadie leía ni escribía nada.

Peor: las policies de `exercise_log` comparan `member_id = auth.uid()`,
mientras que `exercise_logs.member_id` apunta a `members.id`. **La misma
columna significa dos cosas distintas en dos tablas.**

**Decisión:** no se unifica ni se dropea nada en este bloque. Se declara
`exercise_log` (singular) como la **canónica** hacia adelante, porque es la que
la app usa hoy, y se le escriben a `exercise_logs` policies consistentes con
*su* semántica (`member_id` → `members.id`).

**Justificación:** unificarlas es una migración de datos con dos
interpretaciones distintas de la misma columna, en el mismo bloque que ya
reescribe RLS, onboarding, vinculación, límites y vencimiento. Meterlo acá es
pedir un error silencioso de datos. Documentarlo y dejarlo estable es más
barato que arreglarlo mal.

**Alternativas descartadas:** (a) dropear `exercise_logs`, que no tiene datos
en uso — si igual tiene filas, se pierden, y no se verificó; (b) dejarla sin
policies "porque no se usa", que es lo que ya pasaba: una tabla inaccesible se
confunde con un bug de app y se debuggea dos veces antes de descubrir por qué.

**Consecuencias:** queda deuda explícita. Quien retome el logging con peso
tiene que decidir primero si migra `exercise_log` al modelo de `exercise_logs`
o al revés, y **normalizar qué guarda `member_id`** antes de escribir una línea
de app.

**Archivos / migraciones afectadas:** `0013_tenant_isolation_repair.sql`.

---

## [2026-09-15] `body_metrics`, `exercise_logs` y `roles`: RLS activo y cero policies

**Contexto:** las tres tenían RLS habilitado sin ninguna policy. Con RLS activo
y sin policies, Postgres no devuelve nada a nadie: eran tablas muertas.

**Decisión:** `roles` es catálogo global → SELECT para autenticados.
`body_metrics` son datos del socio → SELECT/INSERT propios (vía `members.user_id
= auth.uid()`) más SELECT para el staff de la organización, con el trainer
limitado a su sucursal, igual que `members` en `0008:70-80`. `exercise_logs`,
según la entrada anterior.

**Justificación:** "RLS activo y sin policies" parece seguro y es la peor
configuración posible: no protege más que una policy acotada y el síntoma
—queries que devuelven `[]` sin error— es indistinguible de un bug de la app.
Se depura dos veces antes de que a alguien se le ocurra mirar `pg_policies`.

**Alternativas descartadas:** apagarles RLS. Sería abrir tres tablas, una de
ellas con datos de salud del socio (peso, porcentaje de grasa), en el mismo
bloque cuyo objetivo es cerrar el aislamiento.

**Consecuencias:** `body_metrics` queda lista para cuando exista pantalla; hoy
no la usa nadie. El chequeo "tablas con RLS y cero policies" quedó en el script
de auditoría y en el test automatizado, para que no vuelva a pasar inadvertido.

**Archivos / migraciones afectadas:** `0013_tenant_isolation_repair.sql`,
`supabase/audit/tenant_isolation_audit.sql`.

---

## [2026-09-15] Desvíos del brief y hallazgos sobre la marcha

**1. `user_profiles`: el volcado y el repo se contradicen.** El volcado de
producción dice que la tabla es `(id, organization_id, branch_id, role, name,
created_at)`. Pero `0009:48` y `0010:50` arman el nombre con
`up.name || ' ' || up.surname` —son las RPC del listado de miembros, que según
este mismo archivo funcionan—, `0011:50` devuelve `up.surname`, `0007:196`
comenta que `surname` y `phone` son NOT NULL, y `0012:15` agrega `avatar_url`.
Las dos cosas no pueden ser ciertas: o el volcado vino recortado, o esas cinco
migraciones nunca se aplicaron.

**En vez de apostar a una lectura, las migraciones aplican en los dos
escenarios.** `0015` relaja el NOT NULL de `surname` y `phone` **si existen**
(no las borra, no toca `organization_id`), y `0017` arma el nombre para mostrar
con `surname` solo si la columna existe, resolviéndolo con un bloque `DO` +
`EXECUTE`. Es más feo que un `CREATE FUNCTION` directo y es la razón por la que
la migración no falla a mitad de camino en producción.

**Queda pendiente** correr, contra la base real:
`SELECT column_name, is_nullable FROM information_schema.columns WHERE
table_name = 'user_profiles'` — y anotar acá cuál de las dos lecturas era la
correcta, porque de eso depende si `ProfileForm` y `save_member_profile`
funcionan hoy.

**2. La falta de baseline de esquema es la deuda que causó todo esto.** El repo
no tiene el esquema de las tablas: las migraciones arrancan en `0001` asumiendo
que `organizations`, `members`, `user_profiles` y ocho más ya existen, creadas a
mano en Supabase. Por eso el estado real de RLS era invisible desde el código,
y por eso cuatro policies que anulaban el aislamiento pudieron vivir meses sin
que nadie las viera. Mitigación de este bloque:
`supabase/audit/tenant_isolation_audit.sql` (solo lectura, se corre antes y
después) y `supabase/tests/fixture_schema.sql`, que reproduce el esquema de
producción en un Postgres descartable. **El arreglo de fondo sigue pendiente:**
volcar el esquema real a `supabase/schema/baseline.sql` y versionarlo.

**3. El test de aislamiento se automatizó en vez de quedar como checklist.** El
brief pedía un test manual. `supabase/tests/run.sh` levanta un Postgres
descartable, aplica `0013`-`0017` y corre 47 chequeos: dos gimnasios que no se
ven entre sí, el socio que no puede auto-renovarse ni mudarse de gimnasio, los
límites de plan, y las tres reglas de vencimiento. Se hizo así porque el
criterio de aceptación depende de cómo Postgres combina policies —algo que no
se puede verificar leyendo el código— y porque un checklist manual se corre una
vez y no se vuelve a correr nunca. El guion manual por la UI sigue estando, en
`docs/testing/multi-tenant.md`: cubre lo que el test no puede, que es la
pantalla.

Dos bugs aparecieron **al correr** ese test y no al escribirlo: el mensaje de
límite decía "hasta 1 sucursales", y el propio script de auditoría daba falsos
positivos porque trataba el `with_check` NULL de una policy de SELECT como si
fuera `true`.

**4. `exercises` sigue sin `organization_id`.** El brief pedía que toda tabla
con datos de gimnasio lo tuviera NOT NULL. `exercises` cuelga de
`routine_templates`, que sí lo tiene, y sus policies filtran con un `EXISTS`
contra el template padre (`0008:43-66`). Agregar la columna implica backfill +
`SET NOT NULL` + mantenerla sincronizada con el template en cada insert, para
un dato derivado. Se deja como está, con el filtro transitivo, y se anota acá
como desvío consciente.

**5. Fix de dedupe en `CreateRoutineForm`, que no estaba en el brief.** Un
ejercicio cuyo nombre no matchea `exercise_catalog` recibía un
`crypto.randomUUID()` como `catalogId`, así que el dedupe por `catalogId` nunca
lo encontraba y volver a agregarlo desde la cascada creaba una fila duplicada.
Pasa seguido: el catálogo está en inglés y las rutinas del gimnasio piloto en
castellano, así que 18 de 22 nombres no matchean. Ahora la clave se deriva del
nombre normalizado.

**La FK `exercises.exercise_catalog_id` sigue pendiente y no entró acá**, por
decisión explícita: qué hacer con los ejercicios en castellano que no existen
en el catálogo (¿se agregan?, ¿el catálogo pasa a castellano?) es una decisión
de producto, no un bug para tapar, y este bloque ya venía cargado.

**6. Se sacó el botón "Regenerar" del código.** No estaba pedido. Además de
estar roto (ver la entrada del código), invalidaba de golpe todos los códigos
ya repartidos sin decirle al dueño que eso era lo que hacía. En Pro se
reemplaza por editar, que es la operación que el dueño realmente quiere.
