# ADR 0004 — Ajustes técnicos de la Fase 0

**Estado:** aprobado · 27 de septiembre de 2026

- **Migraciones en SQL puro** ejecutadas con `psql` (`infra/db/migrate.mjs`), en lugar de generarlas
  con un ORM: RLS, disparadores y particiones se expresan mejor en SQL y el migrador no tiene dependencias.
  Drizzle se incorpora para consultas tipadas cuando crezcan los módulos (F1–F2), sin cambiar las migraciones.
- **Pruebas con `node:test`** en el backend (sin dependencias). Vitest queda para el frontend.
- **ESLint** se agrega en F1 junto con el sistema de diseño; en F0 el estilo lo controla Prettier y las
  fronteras entre módulos `tools/check-modules.mjs`.
- **Permisos en el token (solo F0)** para probar la tubería. En F1 se resuelven desde los roles en la base (F1-TD-02 en el [informe del Freeze](../architecture/ARCHITECTURE_FREEZE.md), sección 38).
