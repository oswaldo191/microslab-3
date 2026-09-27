# ADR 0015 — Calidad en tres niveles

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- Calidad se prepara para el Ministerio de Salud Pública y para acreditación estilo ISO 15189, sin requisitos legales inventados. Las reglas regulatorias se versionan (ADR 0008).
- **Quality V1 mínimo** (F7B): lo define ADR 0010.
- **Quality I** (F11):
  - control documental completo, con estados Draft, In Review, Approved y Obsolete; un documento aprobado nunca se sobrescribe;
  - manuales;
  - bitácoras;
  - capacitación ligada a HR;
  - checklist de cumplimiento.
- **Quality II** (F13): EQC, CAPA, auditorías internas, riesgos, competencias, acreditación, equipos, reactivos y tablero avanzado.
- `biosafety` es un módulo nuevo para incidentes, exposiciones, cortopunzantes y desechos. Tiene acceso restringido porque contiene datos de salud del personal.
- La liberación de resultados consulta la política de `quality` por su interfaz pública. `quality` no conoce a `results`, así que no hay ciclo.
