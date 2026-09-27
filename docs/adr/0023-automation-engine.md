# ADR 0023 — Automation Engine por comandos

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- `automation` (F14) define reglas **Trigger → Conditions → Actions**, versionadas y auditadas.
- Los triggers son eventos del outbox o momentos en el tiempo. Ejemplos: resultado crítico, factura vencida, certificado por vencer, temperatura fuera de rango, entrega en riesgo.
- Las acciones son notificación (WhatsApp, email, SMS), webhook o tarea interna.
- Toda acción que escribe datos emite un comando por la tubería normal, con actor `system` y la regla como motivo. Nunca escribe directo en tablas y respeta permisos, suscripción y auditoría.
- Hay protección contra bucles: una regla no se dispara por eventos que ella misma causó en la misma cadena de correlación.
