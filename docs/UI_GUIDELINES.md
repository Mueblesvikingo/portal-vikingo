# Convenciones de UI — Portal Estratégico Vikingo

> Patrones visuales extraídos directamente del código (Tailwind en JSX). No hay un archivo de tema ni tokens de diseño centralizados: las convenciones existen por repetición entre componentes, no por configuración.

## 1. Principio de layout (obligatorio)

`AppLayout.jsx` controla el shell global: `min-h-screen`, `overflow-hidden`, sidebar (`w-[280px]`), topbar (`h-[82px]`) y el `<main>` con `overflow-auto p-6`. **Ningún módulo debe repetir `min-h-screen` ni paddings globales en su elemento raíz** — hay una advertencia dejada explícitamente como comentario al inicio de `CapacityModule.jsx` sobre esto, porque deforma el tamaño del portal completo.

## 2. Paleta y tono general

- Fondo general de la app: `bg-[#f4f6f8]`.
- Sidebar: fondo oscuro `bg-[#071226]`, texto blanco, acento de marca en rojo (`text-red-500` para "GO" de "VIKINGO"; ítem de menú activo en `bg-red-600`).
- Topbar y tarjetas: fondo blanco, bordes `border-gray-200`/`border-slate-200`, esquinas muy redondeadas (`rounded-2xl`, `rounded-3xl`).
- Color de marca/acento recurrente: rojo (`red-600`/`red-700`) para acciones primarias y elementos activos (botón de login, botón "Salir", ítem de menú activo).
- Encabezados de página: tipografía muy grande y pesada (`text-4xl font-black`), color `text-[#0f172a]` (casi negro azulado).
- Etiquetas pequeñas: **mayúsculas, tracking amplio, muy compactas** — patrón repetido: `text-[10px] font-black uppercase tracking-[0.25em]` (o variantes `tracking-[0.14em]`, `tracking-widest`) en color gris (`text-gray-400`/`text-slate-400`).

## 3. Tarjetas (cards)

Patrón repetido en Diseño Organizacional (`MiniMetric`, `EditableCard`, `LockedCard`) y en Balance de Carga (`getCardStyle`, `getCardAccentStyle`):
- Borde suave + fondo casi blanco + esquinas redondeadas (`rounded-lg`/`rounded-2xl`, `border-gray-200`/`border-slate-100`).
- Un campo "bloqueado" se marca con fondo gris (`bg-gray-100`), opacidad reducida (`opacity-90`) y una etiqueta explícita "Bloqueado" en una píldora blanca — no solo con un `disabled` silencioso.
- Un campo editable inline usa un `<input>` dentro de la tarjeta con foco en rojo tenue (`focus:border-red-200`).

## 4. Codificación por color según origen/tipo (Balance de Carga)

`WorkloadBalanceModule.jsx` define una paleta fija por tipo de origen de carga, usada de forma consistente en gráficos y píldoras:

| Origen | Color de fondo/borde (píldora) | Color de gráfico | Color de texto en gráfico |
|---|---|---|---|
| Proceso / Procesos | `bg-sky-50 text-sky-700 border-sky-200` | `#8ECDF8` | `#075985` |
| Proyecto / Proyectos | `bg-violet-50 text-violet-700 border-violet-200` | `#B9A7F5` | `#5B21B6` |
| Mejora | `bg-emerald-50 text-emerald-700 border-emerald-200` | `#9BE7C4` | `#047857` |
| Formación | `bg-orange-50 text-orange-700 border-orange-200` | `#FDBA8C` | `#C2410C` |
| Eventual | `bg-slate-50 text-slate-700 border-slate-200` (o naranja en algunas píldoras) | `#CBD5E1` | `#475569` |

Este mapeo vive en constantes al inicio del archivo (`SOURCE_CHART_COLORS`, `SOURCE_TEXT_COLORS`, funciones `getSourceStyle`/`getCardStyle`/`getCardAccentStyle`) y debe mantenerse coherente si se agrega un nuevo tipo de origen.

## 5. Codificación por color según estado de ocupación/carga

Existen **dos escalas distintas** en el mismo módulo (`WorkloadBalanceModule.jsx`), aplicadas en vistas distintas — se documentan ambas tal como están, sin unificar, porque unificarlas sería un cambio funcional:

- `getWorkloadStatus` (vista de persona/capacidad): verde `< 80%` "Disponible", amarillo `< 100%` "Cercano al límite", naranja `<= 120%` "Sobrecarga moderada", rojo `> 120%` "Sobrecarga crítica".
- `getUtilizationSignal` (gráfico de distribución mensual): verde `< 75%` "Dentro del límite", naranja `< 85%` "Atención", rojo claro `<= 90%` "Casi crítico", rojo intenso `> 90%` "Crítico".

## 6. Botones

- Botones compactos y consistentes por módulo: en Diseño Organizacional y Balance de Carga, botones de acción secundaria suelen ser `text-[10px] font-black uppercase tracking-widest` sobre fondo blanco con borde sutil; el estado activo/seleccionado pasa a fondo oscuro (`bg-[#001225] text-white`, ver `ViewTab` en `WorkloadBalanceModule.jsx`).
- Botón primario de acción destructiva o de sesión: rojo sólido (`bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold`).
- Botón de "agregar bloque" (`AddBlockButton`): borde punteado, texto gris, hover en tono cian/azul (`hover:border-sky-200 hover:text-sky-600`).

## 7. Indicadores de estado (pills/dots)

- `StatusPill`/`SourcePill` en Balance de Carga: círculo o píldora pequeña con color de fondo/borde/punto según el estado o el origen, con `title` para el texto completo (tooltip nativo del navegador).
- Mismo patrón de "punto de color + texto corto" se repite para criticidad (`getCriticalityStyle`, `getCriticalityRank` en Diseño Organizacional) y para estado (`getStatusStyle`, `getStatusLabel`).

## 8. Reglas generales (heredadas de `CLAUDE.md`)

- Mantener el estilo ejecutivo del portal: paletas sobrias, tipografía compacta en mayúsculas para etiquetas, tarjetas con bordes suaves.
- Botones compactos, consistentes con los ya existentes en cada módulo.
- No agregar secciones ni controles innecesarios que no se hayan pedido.
- Evitar romper layouts existentes; respetar que `AppLayout` ya controla el contenedor global.
- Respetar la estructura visual actual de cada módulo al hacer cambios puntuales.

## 9. Observación de mantenibilidad

- Tailwind se carga por **CDN en tiempo de ejecución** (`index.html:7`, `<script src="https://cdn.tailwindcss.com">`), no como dependencia de build: no está en `package.json` ni existe `tailwind.config.js`/`postcss.config.js` en el repo. Esto implica que el CSS se genera en el navegador de cada usuario en cada carga de página (sin purga ni caché de build), y que el sitio depende de la disponibilidad de `cdn.tailwindcss.com` para verse correctamente. No hay forma de definir `theme.extend` con tokens propios porque no hay archivo de configuración.
- No existe una carpeta de tokens de diseño: los colores y tamaños "de marca" (p. ej. `#001225`, `#071226`, `#0f172a`, la paleta por tipo de origen) están como valores arbitrarios (`bg-[#...]`) o constantes JS repetidas dentro de cada módulo, no en un lugar compartido.
- Cada módulo repite sus propias constantes de color/estilo en vez de importar un set compartido. Ver oportunidades de refactor en `ROADMAP.md`.
