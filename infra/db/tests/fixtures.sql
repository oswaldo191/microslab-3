-- Datos de prueba: dos laboratorios con sus sucursales y usuarios.
-- Se cargan como microslab_owner; como RLS está forzado también para el dueño,
-- hay que fijar el contexto de cada laboratorio antes de insertar.

INSERT INTO platform.laboratories (id, code, subdomain, legal_name, trade_name) VALUES
  ('00000000-0000-7000-8000-00000000000a', 'LAB-A', 'lab-a', 'Laboratorio A SRL', 'Laboratorio A'),
  ('00000000-0000-7000-8000-00000000000b', 'LAB-B', 'lab-b', 'Laboratorio B SRL', 'Laboratorio B');

BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000a', true),
       set_config('app.all_branches', 'true', true);
INSERT INTO app.branches (id, code, name) VALUES
  ('00000000-0000-7000-8000-0000000000a1', 'A1', 'Sucursal A1'),
  ('00000000-0000-7000-8000-0000000000a2', 'A2', 'Sucursal A2');
INSERT INTO app.users (id, email, full_name) VALUES
  ('00000000-0000-7000-8000-0000000000aa', 'admin@lab-a.test', 'Admin A');
COMMIT;

BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000b', true),
       set_config('app.all_branches', 'true', true);
INSERT INTO app.branches (id, code, name) VALUES
  ('00000000-0000-7000-8000-0000000000b1', 'B1', 'Sucursal B1');
INSERT INTO app.users (id, email, full_name) VALUES
  ('00000000-0000-7000-8000-0000000000bb', 'admin@lab-b.test', 'Admin B');
COMMIT;
