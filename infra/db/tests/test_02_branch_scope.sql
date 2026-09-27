-- Alcance por sucursal dentro del mismo laboratorio.
BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000a', true),
       set_config('app.branch_ids', '00000000-0000-7000-8000-0000000000a1', true),
       set_config('app.all_branches', 'false', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM app.branches) <> 1 THEN RAISE EXCEPTION 'FALLA: con alcance A1 se ven otras sucursales'; END IF;
  IF (SELECT code FROM app.branches) <> 'A1' THEN RAISE EXCEPTION 'FALLA: la sucursal visible no es A1'; END IF;
END $$;
-- Un usuario limitado a A1 no puede crear otra sucursal (necesita alcance de todas).
DO $$ BEGIN
  BEGIN
    INSERT INTO app.branches (code, name) VALUES ('A9', 'No permitida');
    RAISE EXCEPTION 'FALLA: usuario limitado creó una sucursal';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;
