# ADR 0025 — Motor de reglas clínicas y valores críticos, separado de IA

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión

- `rules-engine` es la **única autoridad determinista** sobre:
  - rangos de referencia, altos y bajos;
  - valores críticos y de pánico;
  - delta check;
  - reglas de reflejo y de bloqueo;
  - fórmulas (mediante `packages/expressions`).
- **Valores críticos configurables (D-25):**
  - Se definen por parámetro, con rangos por edad, sexo y condición, y niveles crítico y pánico.
  - Cada definición es versionada y requiere aprobación antes de usarse.
- **Protocolo de notificación de críticos (D-25):**
  - Es configurable: a quién se notifica, plazo máximo, lectura de vuelta obligatoria, escalamiento si vence el plazo y medios permitidos.
  - `results` registra cada evento y cada notificación, con usuario, hora, medio y confirmación.
- **`clinical-ai` solo sugiere (D-30):**
  - No cambia estados clínicos, no marca críticos y no valida.
  - Sus sugerencias se muestran con un estilo distinto y se auditan aparte.
- Cada evaluación guarda la versión de la regla que la produjo.

## Consecuencias

Las alertas clínicas son reproducibles y auditables. La IA puede añadirse (F17+) sin tocar la lógica clínica.
