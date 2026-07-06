# Módulos — Portal Estratégico Vikingo

> Estado real de cada módulo verificado en el código. "Implementado" significa que lee/escribe en Supabase a través de un servicio. "Estático" significa que solo maneja datos locales de ejemplo, sin persistencia. "Placeholder" significa que el componente no tiene lógica ni datos.

## Mapa de rutas (fuente: `AppRouter.jsx` y `Sidebar.jsx`)

| # | Menú (Sidebar) | Ruta | Componente | Estado |
|---|---|---|---|---|
| 1 | Inicio Ejecutivo | `/` | `modules/executive/ExecutiveHome.jsx` | Estático (sin import de servicios) |
| 2 | Desempeño Organizacional | `/performance` | `modules/performance/PerformanceModule.jsx` | **Placeholder** (6 líneas, solo un `<div>` con texto) |
| 3 | Seguimiento Estratégico | `/strategic-followup` | `modules/strategic-followup/StrategicFollowupModule.jsx` | Implementado (Supabase directo, sin servicio dedicado) |
| 4 | Despliegue Estratégico | `/strategic-deployment` | `modules/StrategicDeploymentModule.jsx` | Estático (sin import de servicios) |
| 5 | Diseño Organizacional | `/capacity` | `modules/organizational-capacity/CapacityModule.jsx` | Implementado — **crítico** |
| 6 | Balance de Carga | `/workload-balance` | `modules/WorkloadBalanceModule.jsx` | Implementado — **crítico** |
| 7 | Centro de Decisiones | `/decision-center` | `modules/decision-center/DecisionCenterModule.jsx` | Implementado |
| 8 | Madurez Organizacional | `/maturity` | `modules/maturity/MaturityModule.jsx` | Estático (sin import de servicios) |
| 9 | Diagnóstico SIG | `/sig` | `modules/sig/SigDiagnosisModule.jsx` | Estático (sin import de servicios) |
| 10 | Catálogo Organizacional | `/organization-catalog` | `modules/organization-catalog/OrganizationCatalogModule.jsx` | Implementado |

No están en el menú ni enrutados en `AppRouter.jsx`, pero existen como archivos:
- `modules/process-view/ProcessViewModule.jsx` (6 líneas, placeholder, sin ruta)
- `modules/responsible-view/ResponsibleViewModule.jsx` (6 líneas, placeholder, sin ruta)

Fuera del menú principal:
- `modules/auth/LoginModule.jsx` — pantalla de login, se muestra antes de entrar al router cuando no hay sesión activa.

## Control de acceso por rol (a nivel de menú)

`Sidebar.jsx` define:
- `restrictedRoles = ["PM", "Analista de Procesos"]`
- Si el rol del usuario (`rol_organizacional` → `rol_sistema` → `role`, en ese orden de prioridad) está en `restrictedRoles`, el menú solo muestra: **Seguimiento Estratégico, Diseño organizacional, Catálogo Organizacional, Balance de Carga, Madurez Organizacional, Diagnóstico SIG**.
- Cualquier otro rol ve el menú completo (los 10 ítems).

`AppRouter.jsx` aplica una regla relacionada pero independiente: si el rol es `PM` o `Analista de Procesos`, la ruta `/` redirige a `/capacity` en lugar de mostrar `ExecutiveHome`.

Estas dos reglas están escritas por separado en dos archivos distintos con la misma lista de roles — ver `DEVELOPMENT_RULES.md` / deuda técnica en `ROADMAP.md`.

## Detalle por módulo

### Inicio Ejecutivo (`ExecutiveHome.jsx`, 372 líneas)
Vista de resumen ejecutivo. No importa ningún servicio; trabaja con datos definidos localmente en el componente. Usa `shared/components/ExecutiveTooltip.jsx`.

### Desempeño Organizacional (`PerformanceModule.jsx`)
Placeholder puro:
```jsx
export default function PerformanceModule() {
  return <div className="bg-white rounded-3xl border border-gray-200 p-6">Desempeño Organizacional</div>;
}
```
No tiene datos, estado ni lógica.

### Seguimiento Estratégico (`StrategicFollowupModule.jsx`, 765 líneas)
Gestión semanal de seguimiento con tres pestañas: `ENFOQUE`, `INSUMOS`, `SESIÓN`.
- Carga personas (`personas`) y semanas (`seguimiento_semanas`) desde Supabase al montar.
- **Solo la pestaña `ENFOQUE` persiste en Supabase** (tabla `seguimiento_enfoque`, referenciada por `semana_id`): al guardar una semana (`saveWeek`), borra las filas de enfoque existentes para esa semana y reinserta las actuales.
- Las pestañas `INSUMOS` y `SESIÓN` solo existen como estado local (`useState`) inicializado con filas de ejemplo; no hay `insert`/`update`/`select` hacia Supabase para ellas en el código revisado — es funcionalidad incompleta, no un dato inventado (ver `ROADMAP.md`).
- Es el único módulo que llama a `supabase` directamente en vez de a través de un archivo de `services/`.

### Despliegue Estratégico (`StrategicDeploymentModule.jsx`, 1170 líneas)
No importa ningún servicio; trabaja con datos y estado local.

### Diseño Organizacional (`CapacityModule.jsx`, 3392 líneas) — módulo crítico
Editor visual de procesos por carriles (roles), con subprocesos y actividades arrastrables. Usa `organizationalDesignService.js` para: `getOrganizationalDesignData`, `getProcessDesignData`, `createProcess`/`createRole`/`updateRole`, `createSubprocess`/`updateSubprocess`/`updateSubprocessOrder`/`deactivateSubprocess`/`deleteSubprocess`, `createActivity`/`updateActivity`/`updateActivityOrder`/`deactivateActivity`/`deleteActivity`, `getRoleCatalogByMacroprocess`, `getSubprocessTraceability`/`createSubprocessTraceability`.

**No tiene ninguna verificación de rol/permiso dentro del componente** (no se encontró lectura de `currentUser` ni de roles en este archivo). El control de acceso a esta pantalla depende únicamente de que el usuario pueda navegar a `/capacity` (visibilidad del menú y enrutamiento), no de una restricción interna de edición.

Detalle de flujo de datos en `BUSINESS_RULES.md`.

### Balance de Carga (`WorkloadBalanceModule.jsx`, 2779 líneas) — módulo crítico
Vista de capacidad/agenda por persona con seis vistas: Capacidad, Asignaciones, Pendientes, Planificación, Semana típica y Mes típico (ver `BUSINESS_RULES.md` para el detalle de cada una). Usa `workloadService.js` en su totalidad.

Control de acceso interno (a diferencia de Diseño Organizacional, este módulo sí valida roles):
- `hasFullAccess(user)` → roles: `Director`, `PM`, `Coordinador SIG`, `Analista de Procesos`, `Administrador Operativo`, `Administrador`, `Estrategia`. Controla: ver la carga de todas las personas (`canViewAllWorkloads`), aprobar planes (`canApprovePlan`), crear asignaciones (`canCreateAssignments`), revisar planes (`canReviewPlan`).
- `canEditPendingSourceActivities(user)` → roles: `Director`, `Coordinador SIG`, `Analista de Procesos`, `PM`, `Administrador`, `Administrador Operativo`. Controla si el usuario puede editar actividades pendientes (que en realidad pertenecen a Diseño Organizacional, tabla `proceso_actividades`) desde esta pantalla.
- Un usuario sin acceso completo solo ve su propia carga, identificada por coincidencia de nombre entre `currentUser.name` y el catálogo de `personas`.

### Centro de Decisiones (`DecisionCenterModule.jsx`, 1180 líneas)
Gestión de decisiones estratégicas con metodología WRAP (opciones, evidencia, distancia, prevención, decisión final). Usa `decisionService.js` (`createStrategicDecision`, `getStrategicDecisions`, `updateStrategicDecision`, `deleteStrategicDecision`) sobre la tabla `decisiones_estrategicas`.

Existe además `services/sharepointService.js`, una implementación alterna que escribiría a una lista de SharePoint (`DECISIONES_ESTRATEGICAS`) en vez de Supabase. **No está importado por `DecisionCenterModule.jsx` ni por ningún otro archivo** — es código muerto, probablemente un enfoque descartado antes de migrar a Supabase.

### Madurez Organizacional (`MaturityModule.jsx`, 474 líneas)
No importa ningún servicio; trabaja con datos y estado local (evaluación de madurez con datos de ejemplo).

### Diagnóstico SIG (`SigDiagnosisModule.jsx`, 586 líneas)
No importa ningún servicio; trabaja con datos y estado local.

### Catálogo Organizacional (`OrganizationCatalogModule.jsx`, 678 líneas)
Administración de catálogos base: Puestos, Personas, Roles (de persona) y Usuarios, en pestañas. Usa `organizationCatalogService.js` sobre las tablas `puestos`, `personas`, `persona_roles`, `usuarios`.

### Login (`LoginModule.jsx`, 103 líneas)
Formulario usuario/contraseña. Usa `authService.js` (`loginWithUserAndPassword`, `saveSession`). Ver notas de seguridad en `DATABASE.md` y `ROADMAP.md` sobre la validación de contraseña.

## Componentes reutilizados

- `shared/components/ExecutiveTooltip.jsx` — único componente compartido explícito fuera de un módulo específico.
- `layout/AppLayout.jsx`, `layout/Sidebar.jsx`, `layout/Topbar.jsx` — compartidos por todas las rutas vía `AppRouter`.
- Dentro de `CapacityModule.jsx` y `WorkloadBalanceModule.jsx` existen subcomponentes (modales, tarjetas, formularios) definidos como funciones en el mismo archivo (p. ej. `ActivityModal`, `GeneralDataModal`, `LaneFormModal`, `BlockFormModal`, `VisualGridMap`, `DeleteConfirmModal` en Diseño Organizacional; `FilterSelect`, `ViewTab`, `StatusPill`, `SourcePill`, `SourceDistributionPie`, `QuickBlockForm`, `SchedulePendingModal`, `PendingActivitiesView`, etc. en Balance de Carga). No están extraídos a `shared/components/`, por lo que no son reutilizables fuera de su archivo actual.
