# ADR 0003 — Una sola tubería de escritura: comandos, auditoría y outbox

**Estado:** aprobado · 27 de septiembre de 2026

## Decisión

Todo cambio de datos es un **comando** ejecutado por `CommandBus`:

```
módulo habilitado → permiso → motivo (si aplica) → validación →
[transacción con RLS: idempotencia → manejador → auditoría → outbox] → resultado
```

La interfaz, la voz, la IA, los equipos y la API pública usan las mismas definiciones de comando.
No existe otro camino para escribir.

## Auditoría

- `audit.audit_events` es de solo inserción: disparadores rechazan `UPDATE`, `DELETE` y `TRUNCATE`.
- Cada evento guarda la huella SHA-256 del anterior del mismo laboratorio; `audit.verify_chain()`
  detecta cualquier alteración, incluso hecha por un superusuario.
- La hora la fija el servidor; los secretos se ocultan antes de guardar.

## Outbox

- Los eventos de dominio se guardan en `kernel.outbox_events` en la misma transacción del cambio.
- `OutboxDispatcher` (rol `microslab_dispatcher`) los publica en BullMQ con `jobId` = id del evento.
- Entrega al menos una vez; los consumidores deben ser idempotentes.

## Kernel sin framework

El kernel (`apps/api/src/kernel`) no depende de NestJS ni de `pg`: define interfaces mínimas
(`PgPoolLike`, `SqlClient`). Así se prueba de forma aislada y la capa HTTP es un adaptador delgado.
