# ADR 0005 — e-invoicing interno consumido por Caja y Facturación

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Contexto

Desde el 1 de noviembre de 2026 los Grandes Locales y Medianos solo pueden emitir e-CF, y el plazo de los demás contribuyentes vence el 15 de noviembre de 2026 (aviso DGII de agosto de 2026; Ley 32-23; Reglamento 587-24). La facturación electrónica es obligatoria, pero el personal no debe ver un "módulo fiscal" aparte.

## Decisión

- `einvoicing` es un motor interno de primera clase. No aparece como módulo principal en la navegación.
- El personal usa **Caja y Facturación** (`cashier`). Para cada factura, `cashier` solicita un documento fiscal (`fiscal_requests`) y guarda solo el enlace (`invoice_fiscal_links`).
- El número fiscal, el XML, la firma, la transmisión, la respuesta y el estado viven en `einvoicing`.
- Cada documento tiene dos estados:
  - un estado interno (DRAFT, READY, SIGNED, PENDING_TRANSMISSION, TRANSMITTED, ACCEPTED, REJECTED, VOIDED, CONTINGENCY, PENDING_RETRY, FAILED; lista provisional);
  - `external_status`, el literal que devuelve DGII o el proveedor.
  
  Un mapeo versionado por proveedor traduce el estado externo al interno.
- La transmisión usa la interfaz `FiscalGateway`, con adaptadores `DGII_DIRECT`, `SANDBOX`, `PROVIDER_A`, `PROVIDER_B` y futuros. El primer conector que se construye lo fija la decisión D-03.
- `einvoicing` no depende de ningún módulo comercial. Firma y transmisión ocurren después del commit, desde el outbox, en una cola fiscal propia.
- La factura de suscripción de MicroSlab usa el mismo motor, con otra configuración fiscal.

## Consecuencias

- Una sola implementación fiscal sirve para Caja, CxC, notas de crédito y débito, y la factura de MicroSlab.
- El cajero nunca recibe permisos `einvoicing.*`.
- Los estados deben validarse contra la documentación oficial vigente antes de F7 (riesgo R-01).

## D-03 — Adaptadores (revisión 2, sin implementar)

- **Puerto único:** `FiscalGateway`, con las operaciones `submit`, `status`, `void`, `healthcheck` y `capabilities`.
- **Adaptadores:** `AUTHORIZED_PROVIDER` (instancias `PROVIDER_A`, `PROVIDER_B`, …), `DGII_DIRECT`, `SANDBOX` (simulador para pruebas y CI, nunca en producción) y futuros.
- **Propuesta para V1:** un proveedor autorizado. DGII directo queda para después de V1. El proveedor concreto es D-20.
- **Elección del adaptador:** por configuración fiscal del emisor y ambiente. Cambiarlo es un comando con motivo, auditoría y doble autorización.
- **Afinidad:** un documento termina su ciclo en el adaptador que lo transmitió.
- **Mapeo:** hay un mapeo versionado del estado externo al interno por adaptador.
- **Cambiar de proveedor no altera el dominio fiscal ni Caja y Facturación.**
