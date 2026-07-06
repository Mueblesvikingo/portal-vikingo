# Reglas de negocio — Portal Estratégico Vikingo

> Reglas verificadas en el código y en `CLAUDE.md`. Cuando una regla proviene de una constante o función específica del código, se referencia el archivo.

## 1. Diseño Organizacional es la fuente maestra

`CapacityModule.jsx` (ruta `/capacity`) y su servicio `organizationalDesignService.js` son la fuente principal de verdad de:

- procesos (`procesos`)
- subprocesos (`subprocesos`)
- roles (`proceso_roles`, `roles_catalogo`)
- actividades (`proceso_actividades`): responsables, duración, frecuencia, criticidad y estado.

La tabla `proceso_actividades` es compartida con Balance de Carga. **Modificar duración o frecuencia de una actividad aquí impacta directamente los cálculos de carga en Balance de Carga.**

`organizationalDesignService.js` sincroniza además cada alta/edición de actividad hacia la tabla `workload_actividades` (`syncActivityToWorkload`), pero esa tabla no tiene ningún lector confirmado en la aplicación — no es el vínculo real entre módulos, el vínculo real es la tabla `proceso_actividades` compartida directamente.

## 2. Flujo de Diseño Organizacional

1. Al entrar a `/capacity`, `CapacityModule` llama `getOrganizationalDesignData()` para obtener todos los procesos, roles, subprocesos y actividades, y arma el listado de procesos disponibles.
2. Al seleccionar un proceso (`processFilter`), llama `getProcessDesignData(processName)` para traer roles del proceso, catálogo de roles, subprocesos y actividades **filtrados por ese proceso**.
3. Los datos crudos de Supabase se mapean a la forma que usa el mapa visual (carriles = roles, columnas = subprocesos/actividades en orden de flujo).
4. Cada acción de edición (crear/editar rol, subproceso o actividad; reordenar; desactivar; eliminar) llama a la función correspondiente del servicio, que escribe en Supabase y, en el caso de actividades, dispara la sincronización hacia `workload_actividades`.
5. Después de guardar, el componente vuelve a pedir los datos del proceso (`reloadSelectedProcessData`) para reflejar el estado real de Supabase, en vez de solo actualizar el estado local de forma optimista.
6. **No hay ninguna verificación de rol/permiso dentro de `CapacityModule.jsx`.** Cualquier usuario que pueda navegar a `/capacity` puede crear, editar, reordenar o eliminar procesos, roles, subprocesos y actividades.

## 3. Balance de Carga — vistas y reglas

Rutas: `/workload-balance` → `WorkloadBalanceModule.jsx`, servicio `workloadService.js`.

Vistas (`viewMode` / `agendaView` en el código):

### 3.1 Capacidad
Ocupación por persona vs. su capacidad horaria diaria/semanal/mensual, tomada de `personas.horas_<dia>`. Constantes de referencia en el código:
- `DAILY_CAPACITY_MINUTES = 570` (9.5 horas, valor por defecto cuando la persona no tiene capacidad definida para ese día).
- `WEEKLY_CAPACITY_HOURS = 48`.
- `MONTHLY_CAPACITY_HOURS = 192`.

Existen **dos escalas de estado de ocupación distintas** en el mismo archivo, aplicadas en contextos diferentes:
- `getWorkloadStatus(occupation)`: `< 80` Disponible, `< 100` Cercano al límite, `<= 120` Sobrecarga moderada, `> 120` Sobrecarga crítica.
- `getUtilizationSignal(utilization)`: `< 75` Dentro del límite, `< 85` Atención, `<= 90` Casi crítico, `> 90` Crítico.

### 3.2 Asignaciones
Trabajo adicional gestionado fuera del flujo estándar de procesos: **proyectos, formación, mejora o eventual**, nunca actividades recurrentes de proceso. Persisten en `workload_asignaciones` vía `createWorkloadAssignment`/`updateWorkloadAssignment`. Tipos válidos (`ASSIGNMENT_TYPES`): Proyecto, Actividad especial, Capacitación extraordinaria, Iniciativa, Mejora, Auditoría, Reunión, Evento. Prioridades (`ASSIGNMENT_PRIORITIES`): Crítica, Alta, Media, Baja. Solo un usuario con acceso completo (ver sección 5) puede crear asignaciones (`canCreateAssignments`).

### 3.3 Pendientes
Muestra actividades de `proceso_actividades` que aún no están programadas en una agenda, filtradas por la persona seleccionada según su vínculo en `persona_roles` (coincidencia de `rol` y, salvo para el rol "Líder de proceso", también de `proceso`). Un usuario sin permiso de edición (`canEditPendingSourceActivities`) puede ver esta lista pero no editar la actividad origen desde aquí.

### 3.4 Planificación (agenda semanal/mensual)
Representa lo que **realmente se ejecutará** semana a semana o mes a mes, respaldado en Supabase (`workload_plan_semanal_detalle`, `workload_plan_mensual`) y en planes guardados (`workload_planes_guardados`, con `estado` tipo "Borrador"/aprobado). Es distinta de los estándares "típicos": una actividad puede tener una Semana típica de referencia y, aun así, no estar planificada realmente para la semana en curso.

Reglas explícitas:
- No desactivar ni eliminar bloques manuales salvo acción explícita del usuario dentro del flujo de la app (`removeWeeklyPlanActivity`/`removeMonthlyPlanActivity` marcan `activo: false`, no hacen `delete`).
- No hacer guardados masivos que sobrescriban un plan completo cuando solo se pidió ajustar un bloque.
- La aprobación de un plan (`canApprovePlan`) y su revisión (`canReviewPlan`) están restringidas a roles con acceso completo.

### 3.5 Semana típica
Estándar de referencia de carga recurrente — **no representa necesariamente la realidad de todas las semanas**. Se construye a partir de las actividades de `proceso_actividades` expandidas por su(s) día(s) típico(s) (`dia_tipico`, campo `programaciones` cuando hay más de una ocurrencia).

### 3.6 Mes típico
Organiza la carga estándar distribuyéndola en semanas 1 a 4 según la frecuencia de cada actividad/bloque (`getWeeksForFrequency`: Manual → sin semanas, Mensual → semana 4, Quincenal → semanas 2 y 4, cualquier otra → las 4 semanas).

## 4. Flujo de Planeación (detalle técnico)

1. Al programar una actividad pendiente en una agenda semanal, `scheduleActivityInWeeklyPlan` primero verifica que no exista ya un registro activo para esa persona/actividad/día (`workload_plan_semanal_detalle`); si no existe, calcula el siguiente orden dentro de ese día y lo inserta.
2. El equivalente mensual (`scheduleActivityInMonthlyPlan`) hace lo mismo por `semana_mes` en vez de por día.
3. Mover un bloque ya programado (`moveWeeklyPlanActivity`/`moveMonthlyPlanActivity`) revalida duplicados en el destino antes de actualizar `dia_semana`/`semana_mes` y `orden`.
4. Quitar un bloque (`removeWeeklyPlanActivity`/`removeMonthlyPlanActivity`) es una desactivación lógica (`activo: false`), no un borrado físico.
5. Los planes guardados (`workload_planes_guardados`) tienen búsqueda de duplicados por persona + rango de fechas (`findExistingSavedWeek`) o por persona + mes/año (`findExistingSavedMonth`) antes de crear uno nuevo, para evitar duplicar el mismo periodo.

## 5. Flujo de Asignaciones (detalle técnico)

1. Se crean con `createWorkloadAssignment`, quedando en estado `"Pendiente"` por defecto.
2. Se pueden actualizar con `updateWorkloadAssignment` (estado, datos de gestión, etc.).
3. En la UI, una asignación puede programarse dentro de la agenda (semana típica, mes típico, planeación semanal o planeación mensual — `ASSIGNMENT_SCHEDULE_DESTINATIONS`), asociándola a un origen (`ASSIGNMENT_SCHEDULE_ORIGINS`: Procesos, Proyectos, Formación, Mejora, Eventual).
4. Solo se listan como visibles las asignaciones activas y con `estado !== "Cancelada"` (`visibleAssignments`), filtradas también por persona y por rol si hay un filtro activo.

## 6. Flujo de Pendientes (detalle técnico)

1. Las actividades de `proceso_actividades` se traen ya normalizadas (`normalizeActivities`) y se cruzan con los vínculos activos de `persona_roles` de la persona seleccionada (`activityMatchesRoleLink`): coincide si el `rol` de la actividad es igual (insensible a mayúsculas/acentos) al `rol` del vínculo, y además el `proceso` coincide — excepto si el rol es "Líder de proceso" o "Líder de proceso", caso en el que se ignora la coincidencia de proceso.
2. Se excluyen las actividades ya programadas (presentes en algún plan semanal o mensual activo, `collectScheduledActivityIds`).
3. Se deduplican por una clave que prioriza el id real de la actividad (`getPendingActivityUniqueKey`); si dos registros compiten por la misma clave, se prefiere el activo sobre el inactivo, y entre dos activos, el de menor orden de flujo (`selectPendingActivityRepresentative`).
4. Se ordenan por proceso, luego subproceso, luego orden operativo (`orden_flujo`/`orden`/`numero_actividad`), luego por `id`.
5. Un usuario con `canEditPendingSourceActivities` puede editar la actividad origen (duración, frecuencia, estado, activo) directamente desde esta vista, lo cual escribe en `proceso_actividades` vía `updateWorkloadSourceActivity`.

## 7. Permisos (consolidado)

| Alcance | Mecanismo | Roles/condición |
|---|---|---|
| Visibilidad de menú completo vs. reducido | `Sidebar.restrictedRoles` | `PM`, `Analista de Procesos` ven solo 6 de los 10 módulos |
| Ruta inicial `/` vs. redirección a `/capacity` | `AppRouter.shouldStartInCapacity` | Mismos roles que arriba, evaluados por separado |
| Ver la carga de **todas** las personas en Balance de Carga | `hasFullAccess` (`WorkloadBalanceModule.jsx`) | `Director`, `PM`, `Coordinador SIG`, `Analista de Procesos`, `Administrador Operativo`, `Administrador`, `Estrategia` |
| Aprobar plan de Balance de Carga | `canApprovePlan` → `hasFullAccess` | Igual que arriba |
| Crear asignaciones | `canCreateAssignments` → `hasFullAccess` | Igual que arriba |
| Revisar plan | `canReviewPlan` → `hasFullAccess` | Igual que arriba |
| Editar actividad origen desde Pendientes | `canEditPendingSourceActivities` | `Director`, `Coordinador SIG`, `Analista de Procesos`, `PM`, `Administrador`, `Administrador Operativo` |
| Editar cualquier dato de Diseño Organizacional (`/capacity`) | Ninguno a nivel de componente | Cualquier usuario que pueda navegar a la ruta |
| Editar Catálogo Organizacional, Centro de Decisiones, Seguimiento Estratégico | Ninguno a nivel de componente | Cualquier usuario que pueda navegar a la ruta |

Nótese que `PM` y `Analista de Procesos` tienen el menú reducido (no ven, por ejemplo, Centro de Decisiones ni Catálogo... en realidad **sí** ven Catálogo Organizacional) pero dentro de Balance de Carga están en la lista de acceso completo (`hasFullAccess`) — es decir, un rol con menú restringido puede tener permisos amplios dentro de los módulos a los que sí tiene acceso. Esto es el comportamiento actual documentado, no necesariamente el deseado; ver `ROADMAP.md`.

## 8. Responsabilidades por módulo (quién es dueño de qué dato)

- **Diseño Organizacional** (`CapacityModule` / `organizationalDesignService`): dueño de `procesos`, `proceso_roles`, `roles_catalogo`, `subprocesos`, `proceso_actividades`, `subproceso_trazabilidad`.
- **Balance de Carga** (`WorkloadBalanceModule` / `workloadService`): dueño de `workload_plan_semanal_detalle`, `workload_plan_mensual`, `workload_asignaciones`, `workload_planes_guardados`. **Lee, pero no es dueño**, de `proceso_actividades`, `personas` y `persona_roles`.
- **Catálogo Organizacional** (`OrganizationCatalogModule` / `organizationCatalogService`): dueño de `puestos`, `personas`, `persona_roles`, `usuarios`. Esto significa que `personas` y `persona_roles` tienen dos consumidores de escritura distintos (Catálogo Organizacional los crea/edita; Balance de Carga solo los lee) — coherente, pero conviene no editar su forma de datos en un módulo sin revisar el otro.
- **Centro de Decisiones** (`DecisionCenterModule` / `decisionService`): dueño de `decisiones_estrategicas`, sin relación con otras tablas del sistema.
- **Seguimiento Estratégico** (`StrategicFollowupModule`): dueño de `seguimiento_semanas` y `seguimiento_enfoque`; lee (no escribe) `personas`.

## 9. Reglas explícitas de no-destrucción (heredadas de `CLAUDE.md`)

- No desactivar ni eliminar bloques manuales de Balance de Carga salvo acción explícita del usuario.
- No hacer guardados masivos que borren información existente.
- Mantener compatibilidad con datos ya guardados en Supabase o `localStorage`.
- Revisar el impacto en Balance de Carga antes de modificar duración o frecuencia en Diseño Organizacional.
