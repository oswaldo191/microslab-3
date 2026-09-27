# ADR 0009 — Llaves de firma solo en servidor o nodo seguro

**Estado:** propuesta · 27 de septiembre de 2026 · parte del Architecture Freeze ([informe](../architecture/ARCHITECTURE_FREEZE.md))

## Decisión

- La llave privada del certificado de firma vive en el gestor de llaves administrado del proveedor de nube (supuesto A-06). Solo la usa la identidad de servicio del worker fiscal.
- En un nodo fiscal local, la llave vive en el almacén seguro del sistema operativo.
- Las llaves privadas **nunca** están en el frontend, `localStorage`, el navegador, los logs, las respuestas de API ni los archivos públicos.
- Mantenimiento Fiscal muestra metadatos del certificado (estado, emisión, expiración, días restantes, ambiente, última prueba y última rotación), nunca la llave.
- Cargar, rotar, reemplazar, activar o desactivar un certificado exige:
  - MFA;
  - reautenticación;
  - motivo;
  - auditoría;
  - doble autorización configurable (propuesta en D-07).
- Hay alertas por vencimiento, por fallas de firma y por uso anómalo.

## Consecuencias

Mitiga el riesgo R-03. La infraestructura (D-10) debe ofrecer un gestor de llaves antes de F7.

## Pendiente (D-22)

Si el proveedor autorizado de V1 firma con el certificado del laboratorio, la llave queda bajo custodia contractual del proveedor. Esa excepción a esta ADR requiere tu decisión explícita. Aun así, la llave nunca pasa por el frontend, los logs ni la API de MicroSlab.
