# ADR 0028 — Operations Center

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión

- Es una superficie sobre `analytics` que **responde automáticamente** indicadores de estos dominios:
  - operativos;
  - clínicos;
  - financieros;
  - calidad;
  - inventario;
  - RR. HH.;
  - entrega de resultados;
  - regulatorio.
- **Cálculo:** proyecciones alimentadas por eventos del outbox, casi en tiempo real. Nunca consulta en caliente tablas ajenas.
- **Alertas:** umbrales configurables. Cada indicador permite bajar al detalle y a la acción.
- **Permisos:** uno por panel (`analytics.view.<dominio>`), con alcance por sucursal.
- **Preguntas en lenguaje natural (F17+, D-15):** solo sobre indicadores ya calculados y con los permisos del usuario.
- **Fases:**
  - F10: base, con los dominios disponibles;
  - F11: regulatorio;
  - F12: RR. HH.;
  - F13: calidad avanzada.
- BI sigue separado (ADR 0019).
