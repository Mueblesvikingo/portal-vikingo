# Arquitectura — Portal Estratégico Vikingo

> Documento generado a partir del análisis directo del código fuente y de `CLAUDE.md`. No contiene funcionalidades supuestas: todo lo aquí descrito existe en el repositorio al momento de este análisis.

## 1. Naturaleza del sistema

SPA (Single Page Application) construida en **React 18**, sin renderizado en servidor. Toda la navegación ocurre en el cliente vía `react-router-dom`. La persistencia de datos es 100% **Supabase** (Postgres + API REST/JS client), sin backend propio (no hay carpeta `api/`, ni servidor Express/Node en el repo).

## 2. Stack técnico

| Capa | Tecnología | Evidencia |
|---|---|---|
| UI | React 18 (`react`, `react-dom`) | `package.json` |
| Build/dev server | Vite 5 (`@vitejs/plugin-react`) | `vite.config.js` |
| Estilos | Tailwind CSS vía **CDN en runtime** (`<script src="https://cdn.tailwindcss.com">` en `index.html`) | `index.html:7`; no está en `package.json` ni hay `tailwind.config.js`/`postcss.config.js` en el repo |
| Routing | `react-router-dom` v7 | `src/core/routing/AppRouter.jsx` |
| Datos | `@supabase/supabase-js` v2 | `src/services/supabase.js` |
| Hosting/CI | Vercel | `vercel.json`, carpeta `.vercel/` |

`vite.config.js` no tiene configuración adicional más allá del plugin de React (sin alias de rutas, sin proxy, sin plugins extra). `vercel.json` define build con `npm run build`, salida en `dist/` y un rewrite SPA (`/(.*)` → `/index.html`) para que las rutas de React Router funcionen en producción.

No existe configuración de linting (`.eslintrc*`) ni de testing (Jest/Vitest) en la raíz del proyecto ni en `package.json`.

## 3. Punto de entrada y arranque

```
index.html → src/main.jsx → src/App.jsx
```

- `main.jsx` monta `<App />` en `#root` dentro de `React.StrictMode`.
- `App.jsx` es un **gate de sesión**: si no hay usuario en sesión (`getSession()` de `authService.js`, respaldado en `localStorage` bajo la clave `vikingo_current_user`), muestra `LoginModule`. Si hay sesión, monta `AppRouter` pasándole `currentUser` y `onLogout` por props.
- No hay Context API en uso: `src/core/context/AppContext.jsx`, `AuthContext.jsx` y `PermissionContext.jsx` existen como archivos pero están **vacíos (0 líneas)**. El usuario actual se propaga por props manualmente desde `App.jsx` hacia `AppRouter` → `AppLayout` → cada módulo que lo necesite (p. ej. `WorkloadBalanceModule`).

## 4. Enrutamiento y layout

- `AppRouter.jsx` (dentro de `src/core/routing/`) es el único punto donde se declaran rutas, todas envueltas por `AppLayout`.
- `AppLayout.jsx` (`src/layout/`) controla el shell visual completo: contenedor `min-h-screen`, `Sidebar`, `Topbar` y el `<main>` con scroll y padding (`p-6`). Los módulos **no deben** replicar `min-h-screen` ni paddings globales en su raíz (advertencia dejada explícitamente como comentario en `CapacityModule.jsx`), porque deformaría el layout general.
- `Sidebar.jsx` construye el menú de navegación y aplica un filtro de visibilidad por rol (ver `MODULES.md` y `BUSINESS_RULES.md`).
- La ruta inicial (`/`) se decide en `AppRouter.shouldStartInCapacity`: si el rol organizacional del usuario es `PM` o `Analista de Procesos`, se redirige a `/capacity` en vez de `ExecutiveHome`. Esta misma condición de rol está duplicada en `Sidebar.restrictedRoles`.

## 5. Capa de servicios (acceso a datos)

Convención general: cada dominio de datos tiene su propio archivo en `src/services/`, que expone funciones `async` que llaman a `supabase.from(tabla)...` y devuelven datos ya "planos" (arrays u objetos), dejando el mapeo a forma de UI en el componente.

| Servicio | Dominio | Tablas que usa |
|---|---|---|
| `authService.js` | Login y sesión local | `usuarios` |
| `organizationalDesignService.js` | Diseño Organizacional | `procesos`, `proceso_roles`, `roles_catalogo`, `subprocesos`, `proceso_actividades`, `workload_actividades`, `subproceso_trazabilidad` |
| `workloadService.js` | Balance de Carga | `proceso_actividades`, `personas`, `persona_roles`, `workload_plan_semanal_detalle`, `workload_plan_mensual`, `workload_asignaciones`, `workload_planes_guardados` |
| `organizationCatalogService.js` | Catálogo Organizacional | `puestos`, `personas`, `persona_roles`, `usuarios` |
| `decisionService.js` | Centro de Decisiones (activo) | `decisiones_estrategicas` |
| `sharepointService.js` | Centro de Decisiones (alternativa) | Ninguna tabla Supabase — llama a la API REST de SharePoint (`mueblesvikingomx.sharepoint.com`). **No está importado por ningún componente**; es código muerto / implementación alternativa no usada. |

**Excepción a la convención**: `src/modules/strategic-followup/StrategicFollowupModule.jsx` llama a `supabase.from(...)` **directamente dentro del componente** (tablas `personas`, `seguimiento_semanas`, `seguimiento_enfoque`), sin pasar por un archivo de servicio dedicado. Es la única pantalla que rompe el patrón "componente → servicio → Supabase".

Los contratos de retorno de los servicios **no son uniformes**:
- Algunos lanzan la excepción (`throw error`) y devuelven el dato directo: `organizationalDesignService.js`, `organizationCatalogService.js`, `decisionService.js`.
- Otros devuelven `{ ok, error, data }` sin lanzar: la mayor parte de `workloadService.js`.
- Otros capturan el error, hacen `console.error` y devuelven `[]`/`null` silenciosamente: `getWorkloadActivities`, `getWorkloadPeople`, `getWorkloadPersonRoles`, etc.

## 6. Estado y persistencia en cliente

- No hay store global (Redux/Zustand/Recoil). Cada módulo maneja su propio estado con `useState`/`useEffect`/`useMemo`.
- `WorkloadBalanceModule.jsx` combina **Supabase** (fuente de verdad) con **`localStorage`** como caché local por persona, bajo claves con patrón `vikingo-workload-<recurso>-<personaId|all>` (bloques manuales, bloques mensuales, bloques manuales de agenda, planes guardados). Ver `DATABASE.md` y `BUSINESS_RULES.md` para el detalle de qué vive en cada lado.
- La sesión de usuario vive en `localStorage` (`vikingo_current_user`), gestionada por `authService.js`.

## 7. Estructura de carpetas

```
src/
  App.jsx                        Gate de sesión (login vs router)
  main.jsx                       Punto de entrada React
  core/
    routing/AppRouter.jsx         Definición de rutas
    context/                      AppContext, AuthContext, PermissionContext — VACÍOS, sin uso real
  layout/
    AppLayout.jsx                 Shell general (sidebar + topbar + main)
    Sidebar.jsx                   Menú y filtro de visibilidad por rol
    Topbar.jsx                    Barra superior
  modules/                        Un archivo o carpeta por pantalla (ver MODULES.md)
  services/                       Capa de acceso a Supabase, por dominio
  data/catalogs/                  objectives.js, people.js, processes.js, roles.js — los 4 VACÍOS (residuo de una versión previa sin Supabase)
  shared/components/
    ExecutiveTooltip.jsx           Único componente reutilizable explícito del proyecto
```

## 8. Flujo de datos general (patrón repetido en los módulos conectados a Supabase)

```
Supabase (tabla)
   │  select/insert/update/delete
   ▼
services/<dominio>Service.js   (llama al cliente supabase, sin lógica de UI)
   │  retorna arrays/objetos planos
   ▼
modules/<Modulo>.jsx           (mapea campos de la tabla a la forma que usa el JSX,
   │                            valida, calcula, filtra, renderiza)
   ▼
Render (JSX + Tailwind)
```

Los flujos concretos de Diseño Organizacional, Balance de Carga, Planeación, Asignaciones y Pendientes están documentados en detalle en `BUSINESS_RULES.md`.

## 9. Variables de entorno

`src/services/supabase.js` requiere:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Se cargan vía `import.meta.env` (mecanismo estándar de Vite). Existen `.env` y `.env.local` en la raíz (no versionados en este documento por su contenido sensible).
