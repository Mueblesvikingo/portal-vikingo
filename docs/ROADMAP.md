# Roadmap y deuda técnica — Portal Estratégico Vikingo

> Este documento no propone fechas ni compromisos: lista únicamente hallazgos objetivos del código (módulos incompletos, deuda técnica confirmada, oportunidades de refactor) para que el equipo priorice. Nada aquí debe ejecutarse sin autorización explícita, según `DEVELOPMENT_RULES.md`.

## 1. Módulos pendientes de desarrollar

| Módulo | Estado actual | Evidencia |
|---|---|---|
| Desempeño Organizacional (`/performance`) | Placeholder puro, sin datos ni lógica | `PerformanceModule.jsx`, 6 líneas |
| Despliegue Estratégico (`/strategic-deployment`) | Solo datos y estado local, sin conexión a Supabase | `StrategicDeploymentModule.jsx` no importa ningún servicio |
| Madurez Organizacional (`/maturity`) | Solo datos y estado local, sin conexión a Supabase | `MaturityModule.jsx` no importa ningún servicio |
| Diagnóstico SIG (`/sig`) | Solo datos y estado local, sin conexión a Supabase | `SigDiagnosisModule.jsx` no importa ningún servicio |
| Inicio Ejecutivo (`/`) | Solo datos y estado local, sin conexión a Supabase | `ExecutiveHome.jsx` no importa ningún servicio |
| Seguimiento Estratégico — pestañas INSUMOS y SESIÓN | Solo estado local en memoria; no se encontró `insert`/`select` hacia Supabase para estas pestañas (a diferencia de ENFOQUE, que sí persiste) | `StrategicFollowupModule.jsx` |
| `ProcessViewModule.jsx` / `ResponsibleViewModule.jsx` | Placeholders de 6 líneas, ni siquiera enrutados en `AppRouter.jsx` | Archivos presentes en `src/modules/process-view/` y `src/modules/responsible-view/` |

Nota: no se puede afirmar si Madurez Organizacional, Diagnóstico SIG, Despliegue Estratégico e Inicio Ejecutivo están "pendientes de conectar a Supabase" por diseño (vistas intencionalmente estáticas/informativas) o si están a mitad de implementación — eso requiere confirmación del usuario, no una suposición de este análisis.

## 2. Deuda técnica detectada

### Datos y backend

1. **Sincronización sin lector (`workload_actividades`)**: `organizationalDesignService.syncActivityToWorkload` escribe en esta tabla en cada alta/edición de actividad, pero ningún módulo la lee. Costo: escrituras extra en cada guardado, riesgo de inconsistencia, y confusión sobre cuál es el vínculo real entre Diseño Organizacional y Balance de Carga (que en realidad es `proceso_actividades` compartida directamente).
2. **Relaciones por texto, no por clave foránea**: los vínculos entre `proceso_actividades`/`subprocesos`/`proceso_roles` y su `procesos.nombre`, y entre `proceso_actividades.rol` y `persona_roles.rol`, se resuelven comparando cadenas de texto (normalizadas con `normalizeText`/acentos). Renombrar un proceso o un rol en un solo lugar puede romper el vínculo en silencio, sin error de base de datos.
3. **Autenticación sin verificación de contraseña**: `authService.loginWithUserAndPassword` consulta la tabla `usuarios` por usuario y `activo = true`, pero no valida la contraseña contra el hash almacenado (comentario explícito en el código lo marca como temporal). Cualquier usuario activo puede iniciar sesión con cualquier contraseña.
4. **Servicio duplicado y no usado (`sharepointService.js`)**: implementación alternativa de guardado de decisiones estratégicas hacia SharePoint, no importada por ningún componente. Es un candidato a código muerto, pero no debe eliminarse sin confirmación (regla general de `DEVELOPMENT_RULES.md`).
5. **Doble persistencia en Balance de Carga**: parte del estado (bloques manuales, bloques mensuales, planes) se guarda tanto en Supabase como en `localStorage` con claves por persona. Puede desincronizarse entre dispositivos o navegadores del mismo usuario.
6. **Contrato de retorno inconsistente entre servicios**: unas funciones lanzan excepción (`throw error`), otras devuelven `{ ok, error, data }`, otras devuelven `[]`/`null` silenciosamente tras solo hacer `console.error`. Quien consuma un servicio nuevo debe leer su implementación para saber qué esperar.
7. **`console.log`/`console.error` de depuración dejados en código de producción**: por ejemplo en `workloadService.getWorkloadActivities`, `scheduleActivityInMonthlyPlan`, y en `CapacityModule.reloadSelectedProcessData` (varios `console.log` de datos cargados).

### Frontend / arquitectura

8. **Módulos monolíticos**: `CapacityModule.jsx` (3392 líneas) y `WorkloadBalanceModule.jsx` (2779 líneas) concentran estado, mapeo de datos, lógica de negocio y JSX de decenas de subcomponentes en un solo archivo cada uno.
9. **Contextos vacíos sin usar**: `src/core/context/AppContext.jsx`, `AuthContext.jsx`, `PermissionContext.jsx` existen con 0 líneas. El usuario se propaga por props manualmente en cada nivel.
10. **Permisos duplicados y dispersos**: la lista de roles restringidos existe por separado en `Sidebar.restrictedRoles` y en `AppRouter.shouldStartInCapacity`; y dentro de `WorkloadBalanceModule.jsx` hay tres funciones de permiso (`hasFullAccess`, `canEditPendingSourceActivities`, y los helpers `canApprovePlan`/`canCreateAssignments`/`canReviewPlan` que delegan en `hasFullAccess`) con listas de roles definidas ahí mismo. `CapacityModule.jsx` no tiene ninguna verificación de permiso interna.
11. **Un módulo rompe el patrón de capa de servicio**: `StrategicFollowupModule.jsx` llama a `supabase.from(...)` directamente en el componente, en vez de a través de un archivo en `services/`, como sí hacen el resto de los módulos conectados a Supabase.
12. **Dos escalas de "estado de ocupación/carga" distintas** conviviendo en el mismo módulo (`getWorkloadStatus` con umbrales 80/100/120, y `getUtilizationSignal` con umbrales 75/85/90), sin una fuente única de verdad sobre qué porcentaje significa qué nivel de riesgo.
13. **Archivos vacíos sin propósito activo**: `src/data/catalogs/objectives.js`, `people.js`, `processes.js`, `roles.js` (0 líneas cada uno) — residuo de una versión previa sin Supabase.
14. **Tailwind cargado por CDN en runtime** (`index.html`, `<script src="https://cdn.tailwindcss.com">`), sin `tailwind.config.js` ni dependencia de build. Implica: sin purga de CSS, sin control de versión fija del framework de estilos, y dependencia de disponibilidad de un CDN externo para que el portal se vea correctamente.

### Calidad y proceso

15. **Sin pruebas automatizadas**: no hay Jest/Vitest ni carpeta de tests. La única verificación de comportamiento en código son `console.assert` dentro de `runModuleSmokeTests()` (Balance de Carga) y `runDevChecks()` (Diseño Organizacional), que corren una vez en el navegador al montar el módulo, no en un pipeline.
16. **Sin linting configurado**: no hay `.eslintrc*` ni dependencia de ESLint.
17. **Sin CI**: no se encontró carpeta `.github/workflows`; la única validación previa a producción es `npm run build` y el propio proceso de build de Vercel.

## 3. Oportunidades de refactor (a evaluar y priorizar con el usuario, no ejecutar de forma unilateral)

- Confirmar con el usuario si `workload_actividades` y `syncActivityToWorkload` deben eliminarse, o si hay un consumidor futuro planeado; documentar la decisión.
- Confirmar si `sharepointService.js` puede eliminarse por no tener importadores, o si se conserva como referencia de una integración futura.
- Centralizar la lista de roles restringidos y las funciones de permiso (`hasFullAccess`, `canEditPendingSourceActivities`, etc.) en un solo módulo compartido, consumido por `Sidebar`, `AppRouter` y los módulos, en vez de repetirla en cada archivo.
- Extraer subcomponentes de `CapacityModule.jsx` y `WorkloadBalanceModule.jsx` a archivos propios (modales, tarjetas, vistas por pestaña) y mover los mapeadores Supabase→UI a un lugar compartido, reduciendo el tamaño de ambos archivos sin cambiar su comportamiento.
- Unificar el contrato de retorno de los servicios (`{ ok, error, data }` en todos, o excepciones en todos) para que el código de UI no tenga que adivinar según el archivo.
- Decidir una única escala de estado de ocupación/carga (o documentar explícitamente por qué se necesitan dos) para `getWorkloadStatus`/`getUtilizationSignal`.
- Migrar Tailwind de CDN a dependencia de build (`tailwindcss` + `postcss` + `tailwind.config.js`) para permitir purga de CSS y fijar versión, si el equipo decide que vale la pena el esfuerzo de migración.
- Evaluar mover la lógica de Supabase de `StrategicFollowupModule.jsx` a un `strategicFollowupService.js` dedicado, para que todos los módulos sigan el mismo patrón componente→servicio→Supabase.
- Retirar (con confirmación previa) los archivos vacíos de `data/catalogs/` y los tres contextos vacíos, o completarlos si hay intención real de usarlos.
- Resolver la validación real de contraseña en `authService.js` antes de considerar el login apto para credenciales sensibles en un entorno expuesto.
- Introducir un framework de pruebas (aunque sea acotado a los servicios de `services/`) y una configuración mínima de linting, dado que hoy la única red de seguridad ante un cambio es `npm run build` más verificación manual.
