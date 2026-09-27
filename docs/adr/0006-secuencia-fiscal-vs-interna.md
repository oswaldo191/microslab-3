# ADR 0006 — Autorización fiscal frente a secuencia interna

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

Los números fiscales (e-NCF) provienen de rangos autorizados por la DGII. Los códigos internos (orden, muestra, factura comercial) se generan con `kernel.next_code`. Mezclarlos produce huecos, duplicados o números inventados.

## Decisión

- `fiscal_sequence_authorizations` guarda el rango aprobado por la DGII por tipo de e-CF, con su vigencia y su fuente.
- `sequence_allocations` registra la asignación atómica de cada número a un documento y a un punto de emisión (`emission_points`), con restricción única.
- No existe la "reserva de NCF por equipo" en el navegador. Un número fiscal solo se asigna en el servidor o en un nodo fiscal local autorizado (ADR 0007 y 0009).
- Los códigos internos pueden reservarse por bloques para operar sin conexión, pero **nunca son números fiscales**.
- Un número fiscal nunca se inventa, reutiliza ni edita. Los huecos se explican con registros en el Reconciliation Center.

## Consecuencias

- El monitor de secuencias puede mostrar rango, actual, siguiente, usados, huecos y conflictos sin ambigüedad.
- Mitiga el riesgo R-04.

## Estado regulatorio

Las reglas fiscales que esta ADR asume (autorización de rangos, contingencia y sus plazos, certificados, firma o estados, según corresponda) están **PENDIENTE DE VALIDACIÓN OFICIAL**. La arquitectura queda preparada. La implementación depende de la validación oficial ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 14.1).
