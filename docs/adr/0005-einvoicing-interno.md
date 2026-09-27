# ADR 0005 — e-invoicing interno y Fiscal Connector Architecture

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

Según fuentes secundarias leídas el 27/09/2026 (**PENDIENTE DE VALIDACIÓN OFICIAL**):

- desde el 1 de noviembre de 2026, los Grandes Locales y Medianos solo podrían emitir e-CF;
- el plazo de los demás contribuyentes vencería el 15 de noviembre de 2026.

Esas fuentes remiten al aviso DGII de agosto de 2026, la Ley 32-23 y el Reglamento 587-24.

La arquitectura se prepara para la obligatoriedad. Las fechas, requisitos, estados, formatos, validaciones, certificados, firma y contingencia dependen de validación oficial ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 14.1).

El personal no debe ver un "módulo fiscal" aparte.

## Decisión

- `einvoicing` es un motor interno de primera clase. No aparece como módulo principal en la navegación.
- El personal usa **Caja y Facturación** (`cashier`). Para cada factura, `cashier` solicita un documento fiscal (`fiscal_requests`) y guarda solo el enlace (`invoice_fiscal_links`).
- El número fiscal, el XML, la firma, la transmisión, la respuesta y el estado viven en `einvoicing`.
- Cada documento tiene dos estados:
  - un estado interno (DRAFT, READY, SIGNED, PENDING_TRANSMISSION, TRANSMITTED, ACCEPTED, REJECTED, VOIDED, CONTINGENCY, PENDING_RETRY, FAILED; lista provisional, **PENDIENTE DE VALIDACIÓN OFICIAL**);
  - `external_status`, el literal que devuelve DGII o el proveedor.
  
  Un mapeo versionado por proveedor traduce el estado externo al interno.
- La transmisión usa la interfaz `FiscalGateway`, con adaptadores `DGII_DIRECT`, `SANDBOX`, `PROVIDER_A`, `PROVIDER_B` y futuros. D-03 aprueba solo esta arquitectura. Qué conector se implementa y con qué proveedor es D-20 (con D-22 si aplica).
- `einvoicing` no depende de ningún módulo comercial. Firma y transmisión ocurren después del commit, desde el outbox, en una cola fiscal propia.
- La factura de suscripción de MicroSlab usa el mismo motor, con otra configuración fiscal.

## Consecuencias

- Una sola implementación fiscal sirve para Caja, CxC, notas de crédito y débito, y la factura de MicroSlab.
- El cajero nunca recibe permisos `einvoicing.*`.
- Ninguna regla fiscal se implementa sin validación oficial (riesgo R-01). Una regla sin fuente oficial cargada queda desactivada.

## D-03 — Fiscal Connector Architecture (sin implementar)

- **Puerto único:** `FiscalGateway`, con las operaciones `submit`, `status`, `void`, `healthcheck` y `capabilities`.
- **Adaptadores:** `AUTHORIZED_PROVIDER` (instancias `PROVIDER_A`, `PROVIDER_B`, …), `DGII_DIRECT`, `SANDBOX` (simulador para pruebas y CI, nunca en producción) y futuros.
- **Sin selección:** D-03 no selecciona proveedor ni decide implementación.
  - La selección concreta y la implementación quedan **pendientes** en D-20 y, si aplica, en D-22.
  - La idea "proveedor autorizado para V1; DGII directo después" es solo una orientación para evaluar en D-20.
- **Elección del adaptador:** por configuración fiscal del emisor y ambiente. Cambiarlo es un comando con motivo, auditoría y doble autorización.
- **Afinidad:** un documento termina su ciclo en el adaptador que lo transmitió.
- **Mapeo:** hay un mapeo versionado del estado externo al interno por adaptador.
- **Cambiar de proveedor no altera el dominio fiscal ni Caja y Facturación.**

## Revisión CTO v2.1 (aclarada en v2.2)

**D-03 — Fiscal Connector Architecture: aprobada la arquitectura.**

- Queda preparada para DGII Direct, sandbox o entorno de pruebas, proveedor autorizado y futuros proveedores o adapters.
- **No se ha aprobado ningún proveedor concreto** y no se implementa ninguno todavía.
- D-20 (selección e implementación) y D-22 (custodia del certificado) siguen pendientes.

Esta ADR sigue en Propuesta.
