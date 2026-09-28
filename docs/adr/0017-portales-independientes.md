# ADR 0017 — Portales independientes y QR público

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- `patient-portal` y `doctor-portal` son aplicaciones independientes. Cada uno tiene sus propios elementos, separados de los usuarios del laboratorio:
  - autenticación;
  - sesiones;
  - permisos;
  - auditoría;
  - contratos de API (`/portal/patient/v1`, `/portal/doctor/v1`);
  - identidades.
- `verify` es pública y confirma la autenticidad y la integridad de un documento. Muestra solo código, fecha, laboratorio, hash y vigencia, sin datos clínicos innecesarios (D-11).
- El QR mínimo llega en F6. Los portales y el QR completo llegan en F16.
