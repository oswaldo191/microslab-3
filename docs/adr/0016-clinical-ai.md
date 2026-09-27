# ADR 0016 — Clinical AI como asistente

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- El módulo `ai` se renombra `clinical-ai`. No existe un dominio "Copilot".
- La IA sugiere, resume, detecta anomalías, explica, prioriza y genera borradores.
- **Nunca es la autoridad clínica final** y nunca valida un resultado. Toda salida exige la acción de un humano autorizado y queda auditada como sugerencia.
- No se envían datos de pacientes a proveedores externos hasta definir el proveedor y las condiciones de privacidad (D-15). Desde entonces rige la minimización de datos.
- Fase: F17+.
