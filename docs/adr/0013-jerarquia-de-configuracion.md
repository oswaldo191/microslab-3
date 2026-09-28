# ADR 0013 — Jerarquía de configuración

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- La configuración tiene cinco niveles: **Platform → Plan → Laboratory → Branch → User**.
- Cada clave se declara en un registro con tipo, esquema, default, niveles permitidos, techo del plan y si exige motivo.
- El valor efectivo es el del nivel más bajo permitido que tenga valor.
- El plan pone techos, no solo defaults.
- Cada cambio es un comando: se versiona y se audita con el valor anterior y el nuevo.
- **Rollback:** volver atrás es un comando nuevo que copia una versión anterior; nunca se borra.
- Umbrales, prioridades, alertas de entrega, políticas de caja, formatos y opciones fiscales permitidas son configuración. Nada de esto va fijo en código.

## Consecuencias

El Configuration Engine se construye en F1, antes de los módulos que lo consumen.
