-- Aislamiento entre laboratorios con el rol de la aplicación (microslab_app).
\set lab_a '00000000-0000-7000-8000-00000000000a'
\set lab_b '00000000-0000-7000-8000-00000000000b'

-- 1. Sin contexto de laboratorio no se ve nada (falla cerrado).
DO $$ BEGIN
  IF (SELECT count(*) FROM app.branches) <> 0 THEN RAISE EXCEPTION 'FALLA: sin contexto se ven sucursales'; END IF;
  IF (SELECT count(*) FROM app.users) <> 0 THEN RAISE EXCEPTION 'FALLA: sin contexto se ven usuarios'; END IF;
END $$;

-- 2. Sin contexto no se puede insertar.
DO $$ BEGIN
  BEGIN
    INSERT INTO app.branches (laboratory_id, code, name)
    VALUES ('00000000-0000-7000-8000-00000000000a', 'X1', 'Intruso');
    RAISE EXCEPTION 'FALLA: se insertó sin contexto';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- 3. Con contexto A solo se ven datos de A.
BEGIN;
SELECT set_config('app.laboratory_id', :'lab_a', true), set_config('app.all_branches', 'true', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM app.branches) <> 2 THEN RAISE EXCEPTION 'FALLA: A debería ver 2 sucursales'; END IF;
  IF EXISTS (SELECT 1 FROM app.branches WHERE code = 'B1') THEN RAISE EXCEPTION 'FALLA: A ve sucursal de B'; END IF;
  IF EXISTS (SELECT 1 FROM app.users WHERE email = 'admin@lab-b.test') THEN RAISE EXCEPTION 'FALLA: A ve usuario de B'; END IF;
END $$;

-- 4. A no puede escribir filas marcadas como de B.
DO $$ BEGIN
  BEGIN
    INSERT INTO app.branches (laboratory_id, code, name)
    VALUES ('00000000-0000-7000-8000-00000000000b', 'B9', 'Inyectada en B');
    RAISE EXCEPTION 'FALLA: A insertó en B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- 5. A no puede modificar filas de B (no las ve: 0 filas afectadas).
DO $$
DECLARE n int;
BEGIN
  UPDATE app.branches SET name = 'hackeada' WHERE code = 'B1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALLA: A modificó una sucursal de B'; END IF;
END $$;

-- 6. A no puede "mudar" una fila suya a B.
DO $$ BEGIN
  BEGIN
    UPDATE app.branches SET laboratory_id = '00000000-0000-7000-8000-00000000000b' WHERE code = 'A1';
    RAISE EXCEPTION 'FALLA: A movió una fila a B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- 7. Claves foráneas compuestas: no se puede enlazar un usuario de A con una sucursal de B.
DO $$ BEGIN
  BEGIN
    INSERT INTO app.user_branches (user_id, branch_id)
    VALUES ('00000000-0000-7000-8000-0000000000aa', '00000000-0000-7000-8000-0000000000b1');
    RAISE EXCEPTION 'FALLA: se enlazó una sucursal de otro laboratorio';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- 8. La aplicación nunca borra entidades.
DO $$ BEGIN
  BEGIN
    DELETE FROM app.branches WHERE code = 'A2';
    RAISE EXCEPTION 'FALLA: la aplicación pudo borrar una sucursal';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- 9. El contexto de B ve solo lo suyo.
BEGIN;
SELECT set_config('app.laboratory_id', :'lab_b', true), set_config('app.all_branches', 'true', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM app.branches) <> 1 THEN RAISE EXCEPTION 'FALLA: B debería ver 1 sucursal'; END IF;
  IF (SELECT name FROM app.branches WHERE code = 'B1') <> 'Sucursal B1' THEN RAISE EXCEPTION 'FALLA: B1 fue alterada'; END IF;
END $$;
COMMIT;

-- 10. La aplicación no puede apagar RLS.
DO $$ BEGIN
  BEGIN
    SET LOCAL row_security = off;
    PERFORM count(*) FROM app.branches;
    RAISE EXCEPTION 'FALLA: se pudo leer con row_security = off';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
