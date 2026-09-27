# ADR 0027 — Centro de Comunicación con Pacientes

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión (D-27)

- Es una superficie de `notifications`, **no un módulo nuevo**.
- **Canales:** WhatsApp, correo y SMS mediante adaptadores. El proveedor de cada canal se decide en D-35.
- **Consentimiento y preferencia de canal por paciente:** se registran quién, cuándo y cómo se obtuvieron, y se pueden revocar.
- **Plantillas versionadas:** por defecto no incluyen valores clínicos. Enviar un informe por un canal exige configuración explícita y consentimiento.
- **Registro de cada mensaje:** estado del proveedor, reintentos y costo. Los límites vienen del plan.
- Todo envío sale del outbox con idempotencia.
- **Fases:**
  - F6: salida, consentimiento, plantillas y registro;
  - F16: conversaciones de ida y vuelta;
  - F14: Automation puede disparar mensajes con las mismas plantillas y reglas de consentimiento.
