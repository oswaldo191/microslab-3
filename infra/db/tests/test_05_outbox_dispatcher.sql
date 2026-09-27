-- El despachador ve la cola de todos los laboratorios y puede marcar eventos como publicados.
DO $$ BEGIN
  IF (SELECT count(*) FROM kernel.outbox_events WHERE published_at IS NULL) < 1 THEN
    RAISE EXCEPTION 'FALLA: el despachador no ve eventos pendientes';
  END IF;
  UPDATE kernel.outbox_events SET published_at = now(), attempts = attempts + 1 WHERE published_at IS NULL;
  -- Pero no tiene acceso a datos del laboratorio.
  BEGIN
    PERFORM count(*) FROM app.branches;
    RAISE EXCEPTION 'FALLA: el despachador leyó datos de laboratorios';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
