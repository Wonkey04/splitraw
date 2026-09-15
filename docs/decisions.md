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


## 2026-09 — Miembros del admin: mismo nivel que el trainer, sin filtro de sucursal

**Contexto:** `/dashboard/members` mostraba Email / Nombre ("-", sin dato) /
Acciones. Nunca se había hecho el JOIN a `user_profiles`, y no tenía
paginado — la misma deuda que ya se había resuelto para el trainer seguía
sin tocar del lado del owner.

**Decisión:** RPC `list_org_members` (migración `0010`), clon de
`list_branch_members` (`0009`) pero sin el filtro `branch_id` y con columna
extra `branch_name`, porque el owner ve toda la organización y necesita
saber de qué sucursal es cada socio. `TrainerMembersSection` se generalizó a
`MembersSection.tsx` con prop `scope: "branch" | "org"` — un solo componente
para tabla, paginado, buscador y modal de reasignación en los dos roles.

**Por qué un solo componente y no dos parecidos:** ya habíamos decidido
reusar `CreateRoutineForm` entre owner y trainer por el mismo motivo — dos
copias del mismo listado son dos lugares donde el próximo bug se arregla
una vez y se reproduce en el otro.

---

## 2026-09 — Asignar rutina: crear y asignar en el mismo paso

**Contexto:** la pantalla de asignar rutina (cards con preview, ya
rediseñada para el trainer) solo dejaba elegir entre rutinas existentes. Si
el owner/trainer quería una rutina puntual para ese alumno, tenía que salir,
crearla en Rutinas, y volver a buscar al alumno.

**Decisión:** tercera opción en la pantalla de asignar — "+ Crear rutina
nueva para {nombre}" — navega a `/.../routines/create?assignToMemberId=<id>`.
`CreateRoutineForm` detecta el query param y, si el INSERT de la rutina
sale bien, hace el INSERT en `routines` (la asignación) en el mismo submit
— es el mismo INSERT que ya usaba la pantalla de asignar, no uno nuevo.

**Por qué no un flujo de creación paralelo:** mismo criterio que la
decisión de septiembre sobre "duplicar rutina" — toda creación de rutina
vive en `/create`, nunca se abre una segunda vía para lograr lo mismo.

**Caso de falla:** si la rutina se crea pero la asignación falla, se
muestra "Creada, pero sin asignar" con una salida explícita — no se
redirige en silencio como si hubiera funcionado.

**Deuda que quedó a la vista:** no existe una ruta de "ficha del alumno".
Después de asignar, se vuelve al listado de miembros, no a una vista
propia del socio. Queda pendiente si se justifica crear esa ruta.

---

## 2026-09 — Panel de Empleados (admin)

**Contexto:** el nav ya tenía la pestaña "Entrenadores" reservada pero sin
implementar. El owner solo veía invitaciones enviadas, ninguna vista
consolidada de su equipo (nombre, rol, sucursal).

**Decisión:** RPC `list_org_employees` (migración `0011`), **SECURITY
DEFINER** — a diferencia de `list_org_members` / `list_branch_members`, que
son INVOKER. El motivo: el email del empleado vive en `auth.users`, no en
`user_profiles`, y `auth.users` no es accesible por RLS normal desde el
cliente. La función hace el chequeo de rol (GYM_OWNER/ADMIN) explícito
adentro, ya que no puede depender de la RLS de la tabla para eso.

`/dashboard/employees` muestra el equipo activo arriba y las invitaciones
pendientes abajo, en la misma pantalla — no se armó una pantalla aparte
para las invitaciones, esa data ya existía y solo se reubicó. Nav:
"Entrenadores" → "Empleados".

**Alcance:** solo lectura. Sin edición de rol/sucursal desde esta pantalla
todavía — no se expandió el scope del brief.

---

## 2026-09 — Perfil compartido (los 3 roles) + política de dato inmutable

**Contexto:** ningún rol tenía pantalla propia para editar nombre o subir
foto.

**Decisión:** migración `0012` — columna `avatar_url` en `user_profiles`,
bucket de Storage `avatars` (lectura pública, escritura solo por el propio
usuario vía policy con `auth.uid()`), y un **trigger que bloquea que el
propio usuario cambie su rol, organización o sucursal** desde el mismo
UPDATE que usa para guardar su perfil — la superficie de escritura es la
misma fila, así que la restricción tiene que vivir en la base, no confiar
en que el form nunca mande esos campos.

Rutas: `/dashboard/profile` (owner), `/trainer/profile`, `/profile` en
mobile.

**Caso particular MEMBER:** guarda por RPC (`save_member_profile`), no por
UPDATE directo, porque un MEMBER puede no tener fila todavía en
`user_profiles` — y una policy de INSERT no puede, por sí sola, garantizar
que el rol que se inserta sea el correcto. La función lo fija server-side.

**Nueva dependencia:** `expo-image-picker` en mobile.

---

## 2026-09 — Expiración de sesión: 12 h, medida desde `last_sign_in_at`

**Contexto:** las sesiones no vencían nunca del lado de la app — volver a
abrir después de días seguía logueado.

**Decisión:** 12 horas, chequeado en el `useAuth` de ambas apps (web y
mobile) contra `last_sign_in_at`, **no contra el `iat` del JWT.**

**Por qué no el `iat`:** el JWT se renueva con cada refresh de token
silencioso, así que su `iat` se corre solo y la sesión nunca llegaría a
vencer aunque el usuario esté inactivo — hay que anclar el chequeo a
cuándo inició sesión, no a cuándo se emitió el último token.

**Pendiente, no resuelto en este brief:** confirmar en el dashboard de
Supabase (Auth → Sessions) si está disponible el time-box nativo de
sesiones para ese plan. Si está, activarlo igual — el chequeo del cliente
no revoca el refresh token del lado del servidor, solo fuerza el logout
visual.

---

## 2026-09 — Eliminar cuenta: Edge Function, reasignación de rutinas de trainer, owner explícitamente afuera

**Contexto:** borrar de `auth.users` requiere `service_role`, que no puede
viajar al cliente — mismo problema ya resuelto antes con la API key de
Resend.

**Decisión:** Edge Function `delete-account`. El id del usuario a borrar
sale **del token de la request, nunca del body** — nadie puede pedir la
baja de otra cuenta pasando un id distinto.

**Trainer:** sus rutinas no se borran ni quedan con `created_by` /
`assigned_by` apuntando a un usuario que ya no existe (rompería la FK). Se
reasignan al owner de la organización al momento de la baja.

**Owner:** caso cortado explícitamente — la función no contempla borrar la
cuenta de un GYM_OWNER. Queda pendiente de decisión de producto qué pasa
con una organización completa cuando su único owner quiere borrarse.

**Confirmación:** el usuario tiene que escribir "ELIMINAR" en la pantalla
de perfil, no un simple "¿estás seguro?".

**Pendiente manual (no lo puede hacer Claude Code):**
- `supabase functions deploy delete-account`
- Aplicar `0010`, `0011`, `0012` en el SQL editor, en ese orden
  (`0011` asume que `user_profiles` tiene `created_at`)
---


