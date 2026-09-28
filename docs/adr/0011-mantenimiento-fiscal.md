# ADR 0011 — Mantenimiento Fiscal

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

Mantenimiento Fiscal es un módulo interno de `einvoicing` para resolver eventualidades fiscales **sin acceso directo a la base de datos**.

- **Quién lo usa:** Super Admin, el administrador autorizado, el supervisor fiscal y los roles con permisos `einvoicing.*`.
- **Dónde aparece:** en Configuración de la app web y en la consola.
- **Áreas:**
  - configuración versionada;
  - certificados;
  - monitor fiscal;
  - cola de transmisión (ver, inspeccionar, reintentar, pausar, reanudar);
  - reintentos con backoff, circuit breaker y clasificación temporal o permanente;
  - Rejected Documents Center;
  - Reconciliation Center;
  - monitor de secuencias;
  - Fiscal Diagnostics (PASS / WARNING / ERROR);
  - Fiscal Emergency Mode.
- **Permisos:** `einvoicing.view`, `.configure`, `.retry`, `.contingency.manage`, `.reconciliation`, `.certificate.manage`, `.sequence.view`, `.sequence.manage`, `.diagnostics`, `.audit.view`, `.queue.pause`, `.emergency` y `.export`.
- **Emergency Mode** exige permiso especial, motivo, confirmación, auditoría y alerta. Solo habilita acciones de contención que ya existen (D-19).
- **Acciones que no existen como comandos:**
  - editar un e-NCF emitido;
  - cambiar manualmente un estado a ACCEPTED;
  - borrar facturas fiscales, XML, respuestas o auditoría;
  - inventar secuencias;
  - eliminar errores sin trazabilidad;
  - modificar documentos históricos fuera del mecanismo fiscal (nota de crédito o documento nuevo).
- La reconciliación siempre agrega registros; nunca borra.

## Consecuencias

El soporte fiscal se hace con herramientas auditadas y no con SQL manual.

## Estado regulatorio

Las reglas fiscales que esta ADR asume (autorización de rangos, contingencia y sus plazos, certificados, firma o estados, según corresponda) están **PENDIENTE DE VALIDACIÓN OFICIAL**. La arquitectura queda preparada. La implementación depende de la validación oficial ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 14.1).
