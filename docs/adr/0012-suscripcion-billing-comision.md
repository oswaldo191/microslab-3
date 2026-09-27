# ADR 0012 — Suscripción, billing y comisión

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- **Planes** iniciales: FREE (RD$0 + 2 %), PRO (RD$1,500 + 1 %) y ENTERPRISE (RD$3,500 + 0 %). El nombre del plan gratuito es configurable (D-02).
- Precio, comisión, límites y beneficios son datos de plan **versionados**, nunca código.
- **Ciclo** mensual, con la mensualidad cobrada por adelantado. Un cambio de plan aplica en el siguiente ciclo, sin prorrateo y con historial.
- **Estados** de la suscripción:
  - ACTIVE pasa a GRACE_PERIOD cuando vence sin pago;
  - GRACE_PERIOD pasa a SUSPENDED tras 5 días calendario (configurable);
  - al pagar, vuelve a ACTIVE;
  - CANCELLED solo por decisión explícita.
  
  Cada cambio emite evento y auditoría.
- **Suspensión:** una etapa nueva de la tubería de comandos (adenda de ADR 0003) restringe administración, operaciones comerciales nuevas y funciones avanzadas. Nunca bloquea la lista versionada de operaciones esenciales clínicas (D-06).
- **Comisión:**
  - se genera un asiento por **cobro efectivo**, con la tasa, el plan y la versión vigentes en ese momento;
  - no hay comisión sobre facturas pendientes, anuladas o glosadas;
  - un reverso crea un asiento negativo en su ciclo;
  - lo histórico nunca se recalcula.
- **Billing Engine:** emite el estado de cuenta (mensualidad + comisión del ciclo anterior) como e-CF mediante `einvoicing`.

## Consecuencias

Mitiga el riesgo R-06. La etapa de suscripción existe desde F2, antes de cualquier operación comercial.
