# Portal Estratégico Vikingo

Guía permanente de desarrollo para Claude Code en este repositorio. Léela antes de proponer o aplicar cualquier cambio, y consúltala como referencia de arquitectura durante todo el trabajo.

## 1. Visión del proyecto

**Portal Estratégico Vikingo** (Portal de Desempeño Organizacional) es un sistema interno construido en **React + Vite + Supabase**, desplegado en **Vercel**.

Su propósito es conectar en un solo lugar: **estrategia, procesos, personas, capacidad, proyectos y seguimiento**. Es decir, permitir que la organización defina cómo trabaja (procesos, roles, actividades), vea si tiene la capacidad real para ejecutarlo (balance de carga por persona), y dé seguimiento a su desempeño y decisiones estratégicas.

No es un prototipo desechable: se usa como herramienta operativa real, por lo que la estabilidad y la integridad de los datos existentes en Supabase priman sobre la velocidad de iteración.

## 2. Arquitectura técnica

- **React 18** — SPA sin framework SSR.
- **Vite** — dev server y build (`npm run dev`, `npm run build`, `npm run preview`).
- **Tailwind CSS** — estilos utilitarios en línea en el JSX (no hay archivos `.css` de componente).
- **React Router** (`react-router-dom` v7) — enrutamiento centralizado en `src/core/routing/AppRouter.jsx`.
- **Supabase** (`@supabase/supabase-js`) — única fuente de datos persistente; cliente inicializado en `src/services/supabase.js` con variables de entorno `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **Vercel** — hosting y despliegue (`vercel.json`).

Reglas de arquitectura:

- **No hacer cambios masivos sin autorización.** Refactors grandes, renombrados amplios, reestructuración de carpetas o cambios que toquen muchos módulos a la vez requieren confirmación explícita del usuario antes de ejecutarse.
- **Ejecutar `npm run build` después de cada cambio funcional** y confirmar que termina sin errores antes de dar el cambio por terminado.
- No existe gestor de estado global (Redux/Zustand) ni Context API en uso real: `src/core/context/AppContext.jsx`, `AuthContext.jsx` y `PermissionContext.jsx` están vacíos. El estado vive en cada módulo con `useState`/`useEffect`, y la sesión de usuario se pasa por props desde `App.jsx` hacia abajo. No asumir que existe un contexto global disponible para leer.

## 3. Módulos principales

Rutas definidas en `AppRouter.jsx` y menú en `Sidebar.jsx`:

| Módulo (menú) | Ruta | Componente | Estado |
|---|---|---|---|
| Inicio Ejecutivo | `/` | `modules/executive/ExecutiveHome.jsx` | Implementado |
| Desempeño Organizacional | `/performance` | `modules/performance/PerformanceModule.jsx` | **Placeholder** (stub sin lógica) |
| Seguimiento Estratégico | `/strategic-followup` | `modules/strategic-followup/StrategicFollowupModule.jsx` | Implementado |
| Despliegue Estratégico | `/strategic-deployment` | `modules/StrategicDeploymentModule.jsx` | Implementado |
| Diseño Organizacional | `/capacity` | `modules/organizational-capacity/CapacityModule.jsx` | Implementado — **módulo crítico** |
| Balance de Carga | `/workload-balance` | `modules/WorkloadBalanceModule.jsx` | Implementado — **módulo crítico** |
| Centro de Decisiones | `/decision-center` | `modules/decision-center/DecisionCenterModule.jsx` | Implementado |
| Madurez Organizacional | `/maturity` | `modules/maturity/MaturityModule.jsx` | Implementado |
| Diagnóstico SIG | `/sig` | `modules/sig/SigDiagnosisModule.jsx` | Implementado |
| Catálogo Organizacional | `/organization-catalog` | `modules/organization-catalog/OrganizationCatalogModule.jsx` | Implementado |

Usuarios con rol `PM` o `Analista de Procesos` tienen acceso restringido: solo ven Seguimiento Estratégico, Diseño Organizacional, Catálogo Organizacional, Balance de Carga, Madurez Organizacional y Diagnóstico SIG (regla duplicada hoy en `AppRouter.shouldStartInCapacity` y `Sidebar.restrictedRoles`/`allowedForRestricted` — tenerlo en cuenta si se cambian roles, hay que actualizar ambos sitios).

### Módulos críticos (tratar con especial cuidado)

- `src/modules/WorkloadBalanceModule.jsx`
- `src/modules/organizational-capacity/CapacityModule.jsx`
- `src/services/organizationalDesignService.js`
- `src/services/workloadService.js`
- `src/core/routing/AppRouter.jsx`
- `src/layout/Sidebar.jsx`

## 4. Diseño Organizacional

Es la **fuente maestra** de:

- procesos
- subprocesos
- roles
- actividades
- responsables
- duración
- frecuencia
- criticidad
- estado

**Tabla principal: `public.proceso_actividades`.**

**Regla de integración:** Balance de Carga debe leer actividades desde `proceso_actividades`, **no desde `workload_actividades`**, salvo que se justifique explícitamente un cambio arquitectónico y se confirme con el usuario. Nota de contexto: `organizationalDesignService.js` sincroniza una copia de cada actividad hacia `workload_actividades` (función `syncActivityToWorkload`), pero hoy ningún módulo lee esa tabla — no es el vínculo activo entre ambos módulos, es una escritura sin lector confirmado. No eliminarla ni "limpiarla" sin confirmación previa del usuario.

## 5. Balance de Carga

Pestañas/vistas del módulo:

- **Capacidad** — vista de ocupación por persona vs. su capacidad horaria diaria/semanal/mensual.
- **Asignaciones** — trabajo adicional gestionado fuera del flujo estándar de procesos.
- **Pendientes** — actividades de `proceso_actividades` aún no programadas en una agenda.
- **Planificación** — agenda real, semanal o mensual, de lo que efectivamente se ejecutará.
- **Semana típica** — estándar de referencia de carga recurrente.
- **Mes típico** — estándar de referencia organizado en semanas 1 a 4.

Reglas importantes:

- **Pendientes** muestra actividades de `proceso_actividades` asociadas a la persona/rol/proceso correspondiente (vínculo vía `persona_roles` y el campo `rol` de la actividad).
- **Semana típica** es un estándar de referencia, no necesariamente representa la realidad de todas las semanas.
- **Mes típico** organiza la carga estándar distribuyéndola por semanas 1 a 4 según la frecuencia de cada actividad/bloque.
- **Planificación** representa lo que realmente se ejecutará semana a semana o mes a mes (respaldada en `workload_plan_semanal_detalle` / `workload_plan_mensual` y en `workload_planes_guardados`), y es distinta de los estándares "típicos".
- Las **asignaciones** (`workload_asignaciones`) representan trabajo adicional: **proyectos, formación, mejora o eventual** — no actividades recurrentes de proceso. No mezclar su lógica con la de actividades de `proceso_actividades`.
- **No desactivar ni eliminar bloques manuales salvo acción explícita del usuario** dentro del flujo de la app.
- **No hacer guardados masivos que borren información existente** (por ejemplo, sobrescribir un plan completo cuando solo se pidió ajustar un bloque).
- **Al modificar duración o frecuencia en Diseño Organizacional, revisar el impacto en Balance de Carga**, ya que esos valores alimentan directamente el cálculo de carga semanal/mensual y de ocupación por persona.

## 6. Supabase — tablas clave

- `usuarios` — login y rol del usuario (`rol_sistema`, `rol_organizacional`).
- `personas` — catálogo de personas y su capacidad horaria diaria (lunes a viernes).
- `persona_roles` — vínculo entre una persona y los roles/procesos que desempeña.
- `procesos` — catálogo de procesos.
- `proceso_roles` — carriles/roles dentro de un proceso.
- `subprocesos` — subprocesos de un proceso.
- `proceso_actividades` — **tabla maestra de actividades**, fuente compartida entre Diseño Organizacional y Balance de Carga.
- `workload_plan_semanal_detalle` — detalle de planificación semanal real.
- `workload_plan_mensual` — detalle de planificación mensual real.
- `workload_asignaciones` — asignaciones de trabajo adicional (proyectos, formación, mejora, eventual).
- `workload_planes_guardados` — planes semanales/mensuales guardados (borrador/aprobado).

No cambiar el esquema de estas tablas, ni de ninguna otra, sin avisar antes al usuario y explicar el impacto.

## 7. Reglas de desarrollo

Claude debe:

- Analizar el impacto antes de editar (qué módulos, servicios y tablas de Supabase consumen lo que se va a tocar).
- No tocar módulos no relacionados con la tarea solicitada.
- No crear tablas nuevas en Supabase sin explicar por qué son necesarias.
- No cambiar la estructura de Supabase sin autorización explícita.
- No eliminar funciones, aunque parezcan no usadas, sin confirmar antes con el usuario.
- Mantener compatibilidad con los datos existentes (no romper registros ya guardados en Supabase o `localStorage`).
- Preferir cambios pequeños, verificables y reversibles frente a refactors amplios.
- Ejecutar `npm run build` al finalizar cambios de código.
- Reportar archivos modificados, riesgos detectados y resultado del build (ver sección 9).

## 8. Estilo UI

- Mantener el estilo ejecutivo del portal (paletas sobrias, tipografía compacta en mayúsculas para etiquetas, tarjetas con bordes suaves).
- Botones compactos, consistentes con los ya existentes en cada módulo.
- No agregar secciones ni controles innecesarios que no se hayan pedido.
- Evitar romper layouts existentes (recordar que los módulos viven dentro de `AppLayout`, que ya controla `min-h-screen`, sidebar, topbar y scroll — un módulo no debe añadir esos mismos estilos a su raíz).
- Respetar la estructura visual actual de cada módulo al hacer cambios puntuales.

## 9. Forma de trabajo

**Antes de cualquier cambio**, Claude debe responder:

- Qué entendió de la tarea.
- Qué archivos tocará.
- Qué riesgo existe.
- Cómo lo validará.

**Después del cambio**, Claude debe responder:

- Archivos modificados.
- Resumen del cambio.
- Prueba realizada.
- Resultado de `npm run build`.
