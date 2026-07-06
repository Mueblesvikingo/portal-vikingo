# Changelog — Portal Estratégico Vikingo

> Reconstruido a partir de `git log` del repositorio (rama `main`) al momento de este análisis. Los mensajes de commit se listan tal como están, agrupados por fecha, del más reciente al más antiguo. A partir de ahora, este archivo debe actualizarse manualmente con cada cambio funcional relevante (ver `DEVELOPMENT_RULES.md`, sección "forma de entrega").

## 2026-07-02

- `4b93de7` Corregir validación de programación de asignaciones
- `554693a` Ajustar Balance de Carga

## 2026-07-01

- `8888bac` Actualizar Balance de Carga

## 2026-06-30

- `beee0d2` Ajuste roles diseño organizacional

## 2026-06-29

- `e7580d5` Ajuste catálogo roles diseño organizacional

## 2026-06-24

- `3789a50` Corregir embed video Balance de Carga
- `a51c411` Corregir enlace de video Balance de Carga
- `064f78b` Agregar video y manual en Balance de Carga
- `c8a16a4` Agregar manual PDF en Diseño Organizacional

## 2026-06-23

- `89c2212` Fix Vercel build - source directory casing
- `9a01d89` Fix Vercel build - main.jsx path

## 2026-06-14

- `07b3e5e` Fix workload scheduling duration and role assignment

## 2026-06-13

- `2170095` Corrige carriles en diseño organizacional

## 2026-06-11

- `e126e79` Implementa guardado semanal y mensual en Supabase

## 2026-06-10

- `2f30fc7`, `a0ed1a7`, `c479ba2` Ajustes portal vikingo
- `a7aa3e8` Configura deployment de Vercel

## 2026-06-09

- `41b7ab6`, `875c4c1`, `6c09b18` Ajustes portal vikingo

## 2026-06-08

- `9af34a9` Guardar cambios de numeración en bloques
- `4e50051` Corregir ruta main usando SRC
- `dafafa6` Forzar redeploy
- `31331b0` Ajustar entrada main para Vercel
- `3630a0e` Validar build correcto para Vercel
- `03c64f4` Redeploy con autor autorizado
- `d3aa94b` Configuración Vercel y Login
- `08a3b11` Primer despliegue Portal Estratégico Vikingo

## 2026-05-11

- `f338881` Fix gitignore
- `5acd305` Fix build and clean dependencies
- `73b18ab` Eliminar node_modules del repositorio
- `9bb1c7f` Quitar node_modules del repositorio
- `2272d7c` primer deploy

## Lectura de esta historia

- El proyecto arrancó como despliegue en Vercel con ajustes sucesivos de configuración de build (múltiples commits "Fix Vercel build", "Ajustar entrada main", "Forzar redeploy") antes de estabilizarse.
- El módulo de Balance de Carga concentra la mayoría de los ajustes recientes: guardado semanal/mensual en Supabase, corrección de carriles, corrección de duración/rol en la programación, validación de programación de asignaciones — coherente con que es uno de los dos módulos críticos del proyecto.
- No hay commits de "setup de tests" ni "setup de linting" en todo el historial — confirma lo señalado en `DEVELOPMENT_RULES.md` sobre la ausencia de estas herramientas desde el origen del proyecto.
