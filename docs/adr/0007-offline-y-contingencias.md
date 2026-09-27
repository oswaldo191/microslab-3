# ADR 0007 — Offline y contingencias separadas

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

"Sin internet" mezclaba cuatro problemas distintos. Tratarlos como uno llevaba a firmar en el navegador o a reservar números fiscales en el equipo.

## Decisión

Se definen cuatro situaciones, cada una con su respuesta:

| Situación | Respuesta |
| --- | --- |
| Operational Offline | Caja, Recepción y Órdenes siguen con una cola local cifrada, ids generados en el cliente, idempotencia, sincronización ordenada, bandeja de conflictos y auditoría con `client_time` y marca `offline` |
| Fiscal Contingency — Connectivity | El servidor sigue firmando. Los documentos quedan en CONTINGENCY o PENDING_TRANSMISSION y se transmiten dentro del plazo de la `FiscalContingencyPolicy` vigente |
| Fiscal Contingency — Technical | Se detiene la emisión afectada, se alerta y se usa solo el mecanismo que la norma vigente permita, incluido el comprobante no electrónico si está permitido y declarado |
| Network / Technical Failure | Reintentos, circuit breaker, degradación por módulo y recuperación desde el outbox |

- Una sucursal sin internet solo emite e-CF si tiene un **nodo fiscal local** (en `connector`) con llave protegida. Sin ese nodo, la venta queda "pendiente de comprobante".
- Cada contingencia registra en `fiscal_contingency_periods` el inicio, la causa, la sucursal, los dispositivos, los documentos, las acciones, el fin y la retransmisión.
- El modo sin conexión se construye en su propia fase (D-05). Desde F1, todo comando acepta un id del cliente y es idempotente.

## Consecuencias

El navegador nunca firma ni numera documentos fiscales. Lo operacional y lo fiscal se prueban por separado.

## Estado regulatorio

Las reglas fiscales que esta ADR asume (autorización de rangos, contingencia y sus plazos, certificados, firma o estados, según corresponda) están **PENDIENTE DE VALIDACIÓN OFICIAL**. La arquitectura queda preparada. La implementación depende de la validación oficial ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 14.1).
