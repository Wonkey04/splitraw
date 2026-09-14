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
