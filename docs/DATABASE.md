# Base de datos (Supabase) — Portal Estratégico Vikingo

> Tablas, campos y relaciones documentados únicamente a partir de las consultas (`select`/`insert`/`update`) encontradas en el código. No se inspeccionó el esquema de Supabase directamente (no hay migraciones en el repo), por lo que esta lista refleja **los campos que la aplicación efectivamente lee o escribe**, no necesariamente el esquema completo de cada tabla.

## Cliente Supabase

`src/services/supabase.js` crea un único cliente con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave anónima — la seguridad real depende de las políticas RLS configuradas en Supabase, no de código de este repo).

## Inventario de tablas por dominio

### Identidad y catálogo organizacional

**`usuarios`**
- Usada por: `authService.js` (login), `organizationCatalogService.js` (CRUD).
- Campos observados: `id`, `usuario`, `nombre`, `puesto`, `rol_sistema`, `rol_organizacional`, `activo`.
- Nota de seguridad: `authService.loginWithUserAndPassword` consulta por `usuario` + `activo = true`, pero **no valida la contraseña contra el hash almacenado** (comentario explícito en el código: *"Validación temporal... por ahora NO validamos aquí"*). `organizationCatalogService.js` también deja una nota: *"no editamos password_hash aquí todavía"*, lo que sugiere que existe (o se planeó) una columna de hash de contraseña no gestionada desde la UI.

**`personas`**
- Usada por: `workloadService.js` (capacidad y filtro `tipo = "persona"`), `organizationCatalogService.js` (CRUD), `StrategicFollowupModule.jsx` (lectura directa de `id, nombre`).
- Campos observados: `id`, `nombre`, `activo`, `tipo`, `puesto`, `area`, `proceso`, `horas_lunes`, `horas_martes`, `horas_miercoles`, `horas_jueves`, `horas_viernes`.
- `horas_<dia>` es la capacidad horaria diaria de esa persona, usada por Balance de Carga para calcular ocupación.

**`persona_roles`**
- Usada por: `workloadService.js` (lectura), `organizationCatalogService.js` (CRUD).
- Campos observados: `id`, `persona_id`, `proceso`, `rol`, `activo`.
- Relación: `persona_id` → `personas.id`. Vincula una persona con los roles/procesos que desempeña; es la base para filtrar qué actividades de `proceso_actividades` le corresponden a cada persona en Balance de Carga (comparando `persona_roles.rol` con `proceso_actividades.rol`).

**`puestos`**
- Usada por: `organizationCatalogService.js` (CRUD).
- Campos observados: `id`, `nombre`, `area`, `proceso`, `nivel`, `activo`.

### Diseño Organizacional

**`procesos`**
- Usada por: `organizationalDesignService.js`.
- Campos observados en `createProcess`: `nombre`, `tipo`, `responsable`, `activo`. Lectura: `select("*")` ordenado por `id`.

**`proceso_roles`**
- Usada por: `organizationalDesignService.js`.
- Campos observados: `id`, `proceso`, `rol`, `responsable`, `orden`, `activo`.
- Relación: `proceso` referencia (por nombre, no por id numérico) a `procesos.nombre`. Representa los "carriles" de roles dentro de un proceso.

**`roles_catalogo`**
- Usada por: `organizationalDesignService.js` (`getProcessDesignData`, `getRoleCatalogByMacroprocess`).
- Filtro usado: `activo = true`. Es el catálogo general de roles disponibles (independiente de un proceso específico), del que se toman los "carriles" al construir el mapa visual.

**`subprocesos`**
- Usada por: `organizationalDesignService.js`.
- Campos observados: `id`, `proceso`, `codigo`, `nombre`, `objetivo`, `responsable`, `carril`, `orden_flujo`, `activo`, `criticidad`, `estado`, `impacto`, `beneficio`.
- Relación: `proceso` → `procesos.nombre`. El código de subproceso (`codigo`) se genera automáticamente con un prefijo derivado del nombre del proceso (`getUniqueSubprocessCode`), garantizando unicidad dentro del mismo proceso.

**`proceso_actividades`** — **tabla maestra compartida** entre Diseño Organizacional y Balance de Carga.
- Usada por: `organizationalDesignService.js` (escritura/lectura completa), `workloadService.js` (lectura para Balance de Carga).
- Campos observados: `id`, `proceso_id`, `actividad`, `descripcion`, `proceso`, `responsable`, `puesto`, `duracion_minutos`, `frecuencia`, `frecuencia_valor`, `dia_tipico`, `orden_flujo`, `rol`, `subproceso_id`, `codigo_subproceso`, `fase`, `criticidad`, `estado`, `automatizada`, `impacto`, `beneficio`, `automatizacion_ia`, `carga_horas`, `activa`, `updated_at`.
- Relaciones: `proceso` → `procesos.nombre`; `subproceso_id` → `subprocesos.id`; `rol` se compara (por texto) contra `persona_roles.rol` para saber qué persona puede ejecutar la actividad.

**`workload_actividades`**
- Usada por: `organizationalDesignService.js`, función `syncActivityToWorkload`, invocada tras cada `createActivity`/`updateActivity`.
- Campos escritos: `titulo`, `descripcion`, `tipo`, `proceso`, `responsable`, `puesto`, `duracion_minutos`, `carga_horas`, `frecuencia`, `observaciones`, `estado`, `origen_proceso` (constante `"Diseño Organizacional"`), `orden_flujo`.
- **Ningún módulo la lee** (confirmado por búsqueda en todo `src/`: las únicas referencias a `workload_actividades` están en las 3 operaciones de escritura/búsqueda de esta misma función). Es una tabla que recibe datos duplicados de `proceso_actividades` sin consumidor actual. Ver `ROADMAP.md`.

**`subproceso_trazabilidad`**
- Usada por: `organizationalDesignService.js` (`getSubprocessTraceability`, `createSubprocessTraceability`).
- Campos observados: `subproceso_id`, `campo`, `valor_anterior`, `valor_nuevo`, `usuario`, `detalle`, `created_at`.
- Relación: `subproceso_id` → `subprocesos.id`. Registro de auditoría de cambios sobre un subproceso.

### Balance de Carga

**`workload_plan_semanal_detalle`**
- Usada por: `workloadService.js`.
- Campos observados: `id`, `persona_id`, `actividad_id`, `dia_semana`, `orden`, `horas_planificadas`, `activo`.
- Relaciones: `persona_id` → `personas.id`; `actividad_id` → `proceso_actividades.id`.

**`workload_plan_mensual`**
- Usada por: `workloadService.js`.
- Campos observados: `id`, `persona_id`, `actividad_id`, `semana_mes`, `posicion_mes`, `orden`, `horas_planificadas`, `activo`.
- Relaciones: igual que la tabla semanal, con `semana_mes` (1 a 4) en vez de `dia_semana`.

**`workload_asignaciones`**
- Usada por: `workloadService.js`.
- Campos observados: `id`, `persona_id`, `responsable`, `rol`, `tipo`, `prioridad`, `gestion`, `titulo`, `revisara`, `aprobara`, `seguimiento`, `carga_horas`, `duracion_minutos`, `fecha_limite`, `estado`, `asigna`, `asigna_rol`, `activo`, `semana_mes` (leído en UI), `dia_semana` (leído en UI), `programada_por`, `programada_at`, `created_at`.
- Relación: `persona_id` → `personas.id`. Representa trabajo adicional (proyecto, formación, mejora, eventual), no actividades de proceso.

**`workload_planes_guardados`**
- Usada por: `workloadService.js`.
- Campos observados: `id`, `tipo_plan` (`"semanal"` o `"mensual"`), `persona_id`, `responsable`, `fecha_inicio`, `fecha_fin`, `mes`, `anio`, `nombre`, `estado` (p. ej. `"Borrador"`), `bloques`, `completados`, `resumen`, `creado_por`, `actualizado_por`, `activo`, `updated_at`, `created_at`.
- `bloques` y `completados` se guardan como arrays (probablemente columnas JSON/JSONB dado que se insertan arrays directamente).

### Seguimiento Estratégico

**`seguimiento_semanas`**
- Usada por: `StrategicFollowupModule.jsx` (consulta directa, sin servicio dedicado).
- Campos observados: `id`, `fecha_inicio`, `fecha_fin`, `estado` (p. ej. `"abierta"`).

**`seguimiento_enfoque`**
- Usada por: `StrategicFollowupModule.jsx`.
- Campos observados: `id`, `semana_id`, `prioridad`, `tema`, `resultado`, `responsable_id`, `responsable_texto`, `tiempo_minutos`, `revisado`, `orden`.
- Relación: `semana_id` → `seguimiento_semanas.id`.
- Nota: las pestañas `INSUMOS` y `SESIÓN` del mismo módulo manejan datos con esta misma forma en memoria, pero no se encontró tabla ni consulta Supabase asociada a ellas — no persisten (ver `ROADMAP.md`).

### Centro de Decisiones

**`decisiones_estrategicas`**
- Usada por: `decisionService.js`.
- Campos observados: `id`, `titulo_de_decision`, `responsable`, `riesgo`, `estado`, `execution_type`, `fecha_compromiso`, `consecuencia`, `recomendacion`, `wrap_options`, `wrap_evidence`, `wrap_distance`, `wrap_prepare`, `decision_final`, `proceso`, `created_at`.

## Diagrama de relaciones (basado en los campos anteriores)

```
usuarios                                    (login / rol_sistema / rol_organizacional)

personas ──< persona_roles                  (persona_id)
    │                                              │  rol (texto)
    │                                              ▼
    │                                        proceso_actividades ── proceso (texto) ── procesos
    │                                              │  subproceso_id                        │
    │                                              ▼                                        │
    │                                        subprocesos ─────────────────── proceso (texto) ┘
    │                                              │  subproceso_id
    │                                              ▼
    │                                        subproceso_trazabilidad
    │
    ├─< workload_plan_semanal_detalle (persona_id, actividad_id → proceso_actividades.id)
    ├─< workload_plan_mensual         (persona_id, actividad_id → proceso_actividades.id)
    ├─< workload_asignaciones         (persona_id)
    └─< workload_planes_guardados     (persona_id)

proceso_actividades ─(sync unidireccional, sin lector)─> workload_actividades

procesos ── proceso_roles (proceso, texto) ── roles_catalogo (independiente, catálogo general)

seguimiento_semanas ──< seguimiento_enfoque (semana_id)

decisiones_estrategicas (tabla independiente, sin FK hacia otras tablas del sistema)

puestos / usuarios (catálogo, sin FK explícita hacia personas en el código revisado; el vínculo persona↔puesto es por texto en el campo personas.puesto)
```

**Importante:** las relaciones "proceso" y "rol" se resuelven **por coincidencia de texto** (nombre del proceso, nombre del rol), no por clave foránea numérica en la mayoría de los casos. Esto significa que renombrar un proceso o un rol en una tabla sin actualizar las demás rompe el vínculo silenciosamente (no hay integridad referencial de base de datos para estos campos). Ver `BUSINESS_RULES.md` y `ROADMAP.md`.

## Regla de integridad ya establecida en `CLAUDE.md`

No cambiar el esquema de estas tablas, ni de ninguna otra, sin avisar antes al usuario y explicar el impacto. No crear tablas nuevas sin justificar por qué son necesarias.
