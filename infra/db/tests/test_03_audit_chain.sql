-- Auditoría: encadenada, inmutable y aislada por laboratorio.
BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000a', true);
INSERT INTO audit.audit_events (laboratory_id, actor_type, actor_id, module, action, entity_type, entity_id, after_data)
VALUES
  ('00000000-0000-7000-8000-00000000000a', 'user', 'u-a', 'configuration', 'branches.create', 'branch', 'A1', '{"code":"A1"}'),
  ('00000000-0000-7000-8000-00000000000a', 'user', 'u-a', 'configuration', 'branches.update', 'branch', 'A1', '{"name":"x"}'),
  ('00000000-0000-7000-8000-00000000000a', 'user', 'u-a', 'configuration', 'branches.update', 'branch', 'A2', '{"name":"y"}');
DO $$ BEGIN
  IF (SELECT max(chain_seq) FROM audit.audit_events) <> 3 THEN RAISE EXCEPTION 'FALLA: la secuencia de A debería ser 3'; END IF;
  IF EXISTS (SELECT 1 FROM audit.audit_events WHERE chain_seq > 1 AND prev_hash IS NULL) THEN
    RAISE EXCEPTION 'FALLA: hay eslabones sin huella anterior';
  END IF;
  IF EXISTS (SELECT 1 FROM audit.verify_chain()) THEN RAISE EXCEPTION 'FALLA: la cadena de A no verifica'; END IF;
END $$;

-- No se puede modificar ni borrar.
DO $$ BEGIN
  BEGIN
    UPDATE audit.audit_events SET reason = 'alterado' WHERE chain_seq = 1;
    RAISE EXCEPTION 'FALLA: se modificó un evento de auditoría';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FALLA%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM audit.audit_events WHERE chain_seq = 1;
    RAISE EXCEPTION 'FALLA: se borró un evento de auditoría';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FALLA%' THEN RAISE; END IF;
  END;
END $$;

-- No se puede registrar un evento a nombre de otro laboratorio.
DO $$ BEGIN
  BEGIN
    INSERT INTO audit.audit_events (laboratory_id, actor_type, module, action)
    VALUES ('00000000-0000-7000-8000-00000000000b', 'user', 'configuration', 'falso');
    RAISE EXCEPTION 'FALLA: A registró auditoría como B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- La hora la fija el servidor.
DO $$ BEGIN
  BEGIN
    INSERT INTO audit.audit_events (laboratory_id, occurred_at, actor_type, module, action)
    VALUES ('00000000-0000-7000-8000-00000000000a', now() - interval '1 day', 'user', 'configuration', 'retroactivo');
    RAISE EXCEPTION 'FALLA: se aceptó una fecha fabricada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLA%' THEN RAISE; END IF;
  END;
END $$;
COMMIT;

-- B tiene su propia cadena y no ve la de A.
BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000b', true);
INSERT INTO audit.audit_events (laboratory_id, actor_type, module, action)
VALUES ('00000000-0000-7000-8000-00000000000b', 'user', 'configuration', 'branches.create');
DO $$ BEGIN
  IF (SELECT count(*) FROM audit.audit_events) <> 1 THEN RAISE EXCEPTION 'FALLA: B ve eventos de A'; END IF;
  IF (SELECT chain_seq FROM audit.audit_events) <> 1 THEN RAISE EXCEPTION 'FALLA: la cadena de B no empieza en 1'; END IF;
END $$;
COMMIT;
