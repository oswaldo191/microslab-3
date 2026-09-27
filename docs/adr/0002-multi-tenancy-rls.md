# ADR 0002 — Multi-tenancy con tablas compartidas y Row-Level Security

**Estado:** aprobado · 27 de septiembre de 2026

## Decisión

Todos los laboratorios comparten tablas. Cada fila lleva `laboratory_id` y PostgreSQL aplica
Row-Level Security **forzado** (también para el dueño de las tablas).

## Cómo funciona

1. La API abre cada transacción con `SET LOCAL app.laboratory_id`, `app.branch_ids` y `app.all_branches`.
2. Las políticas `tenant_isolation` (laboratorio) y `branch_scope` (sucursal) filtran lectura y escritura.
3. Sin contexto, las funciones devuelven `NULL` y no se ve nada: el sistema falla cerrado.
4. Las claves foráneas son compuestas (`laboratory_id`, `id`), así que es imposible enlazar datos de
   dos laboratorios.

## Roles de base de datos

| Rol                    | Uso                    | Puede                                                    |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `microslab_owner`      | Migraciones            | Crear y modificar objetos                                |
| `microslab_app`        | API y workers          | Leer y escribir dentro de RLS; nunca borrar entidades    |
| `microslab_dispatcher` | Despachador del outbox | Leer y marcar eventos; sin acceso a datos de laboratorio |

## Verificación

`infra/db/tests` prueba contra PostgreSQL real que un laboratorio no puede leer, escribir, modificar,
mover ni enlazar datos de otro, que el alcance por sucursal funciona y que la aplicación no puede apagar RLS.
