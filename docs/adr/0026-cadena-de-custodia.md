# ADR 0026 — Cadena de custodia de muestras

**Estado:** propuesta · 27 de septiembre de 2026 · Architecture Freeze v2.1, revisión CTO ([informe](../architecture/ARCHITECTURE_FREEZE.md), sección 35.3)

## Decisión (D-23)

- `samples` registra cada eslabón como un evento inmutable (`sample_custody_events`). Cada evento guarda:
  - la acción;
  - quién la hizo y quién recibe;
  - el lugar;
  - la hora del servidor y del dispositivo;
  - la condición de la muestra (temperatura, integridad);
  - el contenedor;
  - el motivo, cuando aplica.
- **Eslabones:** toma, etiquetado, empaque, salida, transporte, llegada, recepción, aceptación o rechazo, alícuota, procesamiento, almacenamiento, recuperación, envío a laboratorio de referencia y descarte.
- Cada entrega de manos se confirma por escaneo. Una corrección es un evento nuevo, nunca una edición.
- **Fases:**
  - F3: toma y etiquetado;
  - F5: cadena completa en sede y entre sucursales;
  - F17+: rutas y transporte con `logistics` (D-18).
