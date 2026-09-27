# ADR 0021 — Figma como fuente, accesibilidad gana

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- El archivo de Figma *MicroLabs* es la fuente visual principal: estructura, componentes, espaciado, tipografía (Montserrat en controles), iconografía, layout y estados.
- Si un valor de Figma incumple la accesibilidad (WCAG 2.2 AA), se crea una variante accesible en lugar de copiarlo.
- Caso aplicado: el botón de confirmación usa el relleno `success-action` #118431, con 4.8:1 frente a texto blanco. El #31BF48 de Figma (2.4:1) queda para usos no textuales.
- Todo componente tiene:
  - tema claro y oscuro;
  - navegación por teclado;
  - foco visible;
  - estados de error, carga y vacío.
- El estado nunca se comunica solo con color.
- Iconos: Remix Icon (línea) es el set oficial. La sustitución actual es temporal.

## Pendiente

Falta contrastar las pantallas de Figma cuando haya cuota disponible (D-17).
