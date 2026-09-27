-- 0004 — Auditoría inmutable con cadena de huellas por laboratorio.
-- Cada evento guarda la huella (SHA-256) del evento anterior del mismo laboratorio.
-- Si alguien alterara un evento antiguo, la cadena dejaría de cuadrar (audit.verify_chain).

CREATE TABLE audit.audit_events (
  id            uuid NOT NULL DEFAULT kernel.uuid_v7(),
  occurred_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  laboratory_id uuid,                      -- NULL solo para eventos de plataforma
  branch_id     uuid,
  chain_seq     bigint NOT NULL,
  prev_hash     bytea,
  hash          bytea NOT NULL,
  actor_type    text NOT NULL CHECK (actor_type IN ('user', 'system', 'voice', 'ai', 'device', 'api', 'support', 'platform')),
  actor_id      text,
  module        text NOT NULL,
  action        text NOT NULL,
  entity_type   text,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  reason        text,
  request_id    text,
  ip            inet,
  user_agent    text,
  device_id     text,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX audit_events_lab_time ON audit.audit_events (laboratory_id, occurred_at DESC);
CREATE INDEX audit_events_entity ON audit.audit_events (laboratory_id, entity_type, entity_id, occurred_at DESC);

-- Particiones mensuales + una por defecto como red de seguridad.
CREATE OR REPLACE FUNCTION audit.ensure_month_partition(p_month date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  text := format('audit_events_%s', to_char(v_start, 'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.audit_events FOR VALUES FROM (%L) TO (%L)',
    v_name, v_start, v_end);
END $$;

CREATE TABLE audit.audit_events_default PARTITION OF audit.audit_events DEFAULT;
SELECT audit.ensure_month_partition((date_trunc('month', now()) + make_interval(months => m))::date)
FROM generate_series(0, 12) AS m;

-- Cabeza de cada cadena (una por laboratorio y una para la plataforma). La aplicación no la ve.
CREATE TABLE audit.chain_heads (
  chain_key text PRIMARY KEY,
  last_seq  bigint NOT NULL,
  last_hash bytea NOT NULL
);

CREATE OR REPLACE FUNCTION audit.compute_hash(p_prev bytea, e audit.audit_events) RETURNS bytea
LANGUAGE sql IMMUTABLE AS $$
  SELECT digest(
    coalesce(p_prev, '\x'::bytea) || convert_to(jsonb_build_object(
      'id', e.id, 'occurred_at', extract(epoch FROM e.occurred_at)::text, 'laboratory_id', e.laboratory_id, 'branch_id', e.branch_id,
      'chain_seq', e.chain_seq, 'actor_type', e.actor_type, 'actor_id', e.actor_id, 'module', e.module,
      'action', e.action, 'entity_type', e.entity_type, 'entity_id', e.entity_id,
      'before_data', e.before_data, 'after_data', e.after_data, 'reason', e.reason,
      'request_id', e.request_id, 'ip', e.ip, 'user_agent', e.user_agent, 'device_id', e.device_id
    )::text, 'UTF8'),
    'sha256')
$$;

-- Encadena cada evento. SECURITY DEFINER: la aplicación inserta eventos pero no toca chain_heads.
CREATE OR REPLACE FUNCTION audit.chain_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, audit, kernel AS $$
DECLARE
  v_key  text := coalesce(NEW.laboratory_id::text, 'platform');
  v_head audit.chain_heads%ROWTYPE;
BEGIN
  IF abs(extract(epoch FROM (NEW.occurred_at - clock_timestamp()))) > 5 THEN
    RAISE EXCEPTION 'audit: occurred_at lo fija el servidor';
  END IF;

  INSERT INTO audit.chain_heads (chain_key, last_seq, last_hash)
  VALUES (v_key, 0, '\x'::bytea)
  ON CONFLICT (chain_key) DO NOTHING;

  SELECT * INTO v_head FROM audit.chain_heads WHERE chain_key = v_key FOR UPDATE;

  NEW.chain_seq := v_head.last_seq + 1;
  NEW.prev_hash := CASE WHEN v_head.last_seq = 0 THEN NULL ELSE v_head.last_hash END;
  NEW.hash := audit.compute_hash(NEW.prev_hash, NEW);

  UPDATE audit.chain_heads SET last_seq = NEW.chain_seq, last_hash = NEW.hash WHERE chain_key = v_key;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_chain BEFORE INSERT ON audit.audit_events
  FOR EACH ROW EXECUTE FUNCTION audit.chain_before_insert();

-- Inmutabilidad: nadie modifica ni borra eventos, ni siquiera por error desde una migración.
CREATE OR REPLACE FUNCTION audit.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit: los eventos de auditoría son inmutables (%)', TG_OP;
END $$;

CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit.audit_events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();

-- Aislamiento: cada laboratorio solo ve y escribe sus eventos.
ALTER TABLE audit.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON audit.audit_events FOR SELECT
  USING (laboratory_id = kernel.current_laboratory_id());
CREATE POLICY tenant_write ON audit.audit_events FOR INSERT
  WITH CHECK (laboratory_id = kernel.current_laboratory_id());

GRANT SELECT, INSERT ON audit.audit_events TO microslab_app;

-- Verificación de la cadena del laboratorio actual. Devuelve el primer eslabón roto, o nada.
CREATE OR REPLACE FUNCTION audit.verify_chain()
RETURNS TABLE (broken_seq bigint, problem text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  e audit.audit_events;
  v_prev bytea := NULL;
  v_expected_seq bigint := 1;
BEGIN
  FOR e IN SELECT * FROM audit.audit_events
           WHERE laboratory_id = kernel.current_laboratory_id()
           ORDER BY chain_seq LOOP
    IF e.chain_seq <> v_expected_seq THEN
      broken_seq := e.chain_seq; problem := 'falta un eslabón'; RETURN NEXT; RETURN;
    END IF;
    IF e.prev_hash IS DISTINCT FROM v_prev OR e.hash <> audit.compute_hash(v_prev, e) THEN
      broken_seq := e.chain_seq; problem := 'huella no coincide'; RETURN NEXT; RETURN;
    END IF;
    v_prev := e.hash;
    v_expected_seq := v_expected_seq + 1;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION audit.verify_chain() TO microslab_app;
