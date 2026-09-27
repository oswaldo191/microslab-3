-- Detección de alteraciones: incluso si alguien con privilegios máximos altera un evento
-- (desactivando los disparadores), la verificación de la cadena lo detecta.
BEGIN;
ALTER TABLE audit.audit_events_default DISABLE TRIGGER USER;
DO $$
DECLARE part text;
BEGIN
  -- Alteramos el segundo evento de A en la partición donde esté.
  SELECT tableoid::regclass::text INTO part FROM audit.audit_events
   WHERE laboratory_id = '00000000-0000-7000-8000-00000000000a' AND chain_seq = 2;
  EXECUTE format('ALTER TABLE %s DISABLE TRIGGER USER', part);
  EXECUTE format($q$UPDATE %s SET after_data = '{"name":"alterado"}'
                   WHERE laboratory_id = '00000000-0000-7000-8000-00000000000a' AND chain_seq = 2$q$, part);
END $$;
SET LOCAL ROLE microslab_app;
SELECT set_config('app.laboratory_id', '00000000-0000-7000-8000-00000000000a', true);
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM audit.verify_chain();
  IF r.broken_seq IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FALLA: la alteración no fue detectada (resultado: %)', r;
  END IF;
END $$;
ROLLBACK;
