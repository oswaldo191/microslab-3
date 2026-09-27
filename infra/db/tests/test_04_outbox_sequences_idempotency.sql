-- Outbox, secuencias e idempotencia con el rol de la aplicación.
BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000a', true);

-- Outbox: se puede agregar un evento propio...
INSERT INTO kernel.outbox_events (laboratory_id, event_type, aggregate_type, aggregate_id)
VALUES ('00000000-0000-7000-8000-00000000000a', 'configuration.BranchCreated', 'branch', 'A1');
-- ...pero no uno de otro laboratorio, ni leer la cola.
DO $$ BEGIN
  BEGIN
    INSERT INTO kernel.outbox_events (laboratory_id, event_type, aggregate_type, aggregate_id)
    VALUES ('00000000-0000-7000-8000-00000000000b', 'configuration.BranchCreated', 'branch', 'B1');
    RAISE EXCEPTION 'FALLA: A publicó un evento de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM kernel.outbox_events;
    RAISE EXCEPTION 'FALLA: la aplicación leyó el outbox';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Secuencias: consecutivas por laboratorio.
DO $$ BEGIN
  IF kernel.next_code('orders', 'ORD1-') <> 'ORD1-0000001' THEN RAISE EXCEPTION 'FALLA: primer código'; END IF;
  IF kernel.next_code('orders', 'ORD1-') <> 'ORD1-0000002' THEN RAISE EXCEPTION 'FALLA: segundo código'; END IF;
END $$;
COMMIT;

BEGIN;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000b', true);
DO $$ BEGIN
  IF kernel.next_code('orders', 'ORD1-') <> 'ORD1-0000001' THEN RAISE EXCEPTION 'FALLA: B no empieza su propia secuencia'; END IF;
END $$;

-- Idempotencia: la misma clave no se registra dos veces.
INSERT INTO kernel.idempotency_keys (key, command, request_hash, response)
VALUES ('clave-prueba-1', 'configuration.branches.create', 'h1', '{}');
DO $$ BEGIN
  BEGIN
    INSERT INTO kernel.idempotency_keys (key, command, request_hash, response)
    VALUES ('clave-prueba-1', 'configuration.branches.create', 'h1', '{}');
    RAISE EXCEPTION 'FALLA: clave de idempotencia duplicada';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
COMMIT;
