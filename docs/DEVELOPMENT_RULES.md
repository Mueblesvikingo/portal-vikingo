# Reglas de desarrollo — Portal Estratégico Vikingo

> Consolidado de las reglas de trabajo definidas en `CLAUDE.md`, más el contexto de herramientas de calidad realmente presentes en el repositorio (verificado en `package.json` y en la raíz del proyecto).

## 1. Regla principal

- **No hacer cambios masivos sin autorización.** Refactors grandes, renombrados amplios, reestructuración de carpetas o cambios que toquen muchos módulos a la vez requieren confirmación explícita del usuario antes de ejecutarse.
- **Analizar el impacto antes de editar**: qué módulos, servicios y tablas de Supabase consumen lo que se va a tocar (ver `ARCHITECTURE.md`, `MODULES.md` y `DATABASE.md` como referencia de dependencias).
- **Ejecutar `npm run build` después de cada cambio funcional** y confirmar que termina sin errores antes de dar el cambio por terminado.

## 2. Módulos y archivos críticos

Tratar con especial cuidado (ver `MODULES.md` para el detalle de cada uno):

- `src/modules/WorkloadBalanceModule.jsx`
- `src/modules/organizational-capacity/CapacityModule.jsx`
- `src/services/organizationalDesignService.js`
- `src/services/workloadService.js`
- `src/core/routing/AppRouter.jsx`
- `src/layout/Sidebar.jsx`

## 3. Restricciones explícitas

- No modificar otros módulos si la tarea pedida es específica a uno solo. Mantener el cambio acotado al alcance solicitado.
- No cambiar la estructura de Supabase (tablas, columnas, relaciones) sin avisar antes al usuario y explicar el impacto.
- No crear tablas nuevas en Supabase sin justificar por qué son necesarias y confirmarlo con el usuario.
- No eliminar funciones, aunque parezcan no usadas, sin confirmar antes con el usuario — incluso cuando el análisis indique que algo parece código muerto (por ejemplo, `syncActivityToWorkload`/`workload_actividades` o `sharepointService.js`, documentados en `DATABASE.md` y `MODULES.md`).
- Mantener compatibilidad con los datos existentes: no romper registros ya guardados en Supabase o en `localStorage`.
- No tocar autenticación (`src/services/authService.js`, manejo de sesión) sin instrucción explícita del usuario.
- Preferir cambios pequeños, verificables y reversibles frente a refactors amplios.

## 4. Estado real de las herramientas de calidad

Verificado directamente en el repositorio (no hay suposición):

- **No hay framework de pruebas automatizadas** configurado (no hay Jest, Vitest, Testing Library ni carpeta `tests/`/`__tests__/` en `package.json` ni en el árbol de archivos). La única verificación de comportamiento presente en el código son `console.assert` dentro de `runModuleSmokeTests()` (`WorkloadBalanceModule.jsx`) y `runDevChecks()` (`CapacityModule.jsx`), que se ejecutan una vez en el navegador cuando el módulo se monta (protegidos por una bandera en `window`), no como parte de un pipeline de CI.
- **No hay configuración de linting** (no existe `.eslintrc*` en la raíz ni dependencia de ESLint en `package.json`).
- El único "build check" formal es `npm run build` (Vite), que valida que el proyecto compila, no que el comportamiento sea correcto.
- No hay pipeline de CI (no se encontró carpeta `.github/workflows` en el repo); el despliegue es vía Vercel directamente sobre el repositorio.

Mientras esto no cambie, la validación de un cambio depende de: (a) que `npm run build` termine sin errores, y (b) verificación manual en el navegador de la ruta afectada.

## 5. Flujo de trabajo esperado (antes y después de cada cambio)

**Antes de cualquier cambio**, responder:

1. Qué se entendió de la tarea.
2. Qué archivos se van a tocar.
3. Qué riesgo existe (módulos, tablas o flujos que podrían verse afectados).
4. Cómo se va a validar (build, prueba manual en el navegador, revisión de datos existentes).

**Después del cambio**, responder:

1. Archivos modificados.
2. Resumen del cambio realizado.
3. Prueba realizada (qué se verificó y cómo, dado que no hay tests automáticos).
4. Resultado de `npm run build`.

## 6. Estilo de código observado (para mantener consistencia, no como regla impuesta)

- Componentes funcionales con hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`); no hay componentes de clase en el código revisado.
- Módulos grandes concentran subcomponentes (modales, tarjetas, formularios) como funciones declaradas en el mismo archivo, en vez de archivos separados.
- Los servicios (`services/*.js`) son funciones `async` planas exportadas individualmente, sin clases ni un cliente/wrapper adicional sobre `supabase-js`.
- Nombres de campos y variables mezclan español (reflejando las columnas de Supabase: `actividad`, `responsable`, `duracion_minutos`) e inglés (variables de React: `activity`, `responsible`, `durationMinutes`), con funciones de mapeo (`firstValue`, `firstText`) que aceptan ambos alias — es un patrón deliberado para tolerar nombres de columna variables, no un descuido aislado.
