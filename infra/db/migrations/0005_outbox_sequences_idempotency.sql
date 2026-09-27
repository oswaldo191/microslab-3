-- 0005 — Outbox transaccional, secuencias de códigos visibles e idempotencia de comandos.

-- Outbox: los eventos de dominio se guardan en la MISMA transacción que el cambio.
-- Un proceso aparte (microslab_dispatcher) los publica en las colas. Si la transacción
-- se revierte, el evento tampoco existe. Los eventos llevan identificadores, no datos clínicos.
CREATE TABLE kernel.outbox_events (
  id             uuid PRIMARY KEY DEFAULT kernel.uuid_v7(),
  laboratory_id  uuid NOT NULL,
  event_type     text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9]+$'),
  aggregate_type text NOT NULL,
  aggregate_id   text NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id     text,
  occurred_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at   timestamptz,
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text
);
CREATE INDEX outbox_pending ON kernel.outbox_events (occurred_at) WHERE published_at IS NULL;

-- La aplicación solo puede AGREGAR eventos de su laboratorio; no los lee ni los modifica.
ALTER TABLE kernel.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel.outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON kernel.outbox_events FOR INSERT TO microslab_app
  WITH CHECK (laboratory_id = kernel.current_laboratory_id());
CREATE POLICY dispatcher_all ON kernel.outbox_events FOR ALL TO microslab_dispatcher
  USING (true) WITH CHECK (true);
GRANT INSERT ON kernel.outbox_events TO microslab_app;
GRANT SELECT, UPDATE ON kernel.outbox_events TO microslab_dispatcher;
GRANT EXECUTE ON FUNCTION kernel.uuid_v7(), kernel.current_laboratory_id() TO microslab_dispatcher;

-- Secuencias para códigos visibles (ORD1-0000123, MUT-0010716...), por laboratorio y opcionalmente sucursal.
CREATE TABLE kernel.sequences (
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id(),
  sequence_key  text NOT NULL,                       -- p. ej. 'orders', 'samples'
  scope_key     text NOT NULL DEFAULT '',            -- '' = todo el laboratorio; o el id de la sucursal
  prefix        text NOT NULL,
  padding       integer NOT NULL DEFAULT 7 CHECK (padding BETWEEN 1 AND 12),
  next_value    bigint NOT NULL DEFAULT 1 CHECK (next_value > 0),
  PRIMARY KEY (laboratory_id, sequence_key, scope_key)
);
SELECT kernel.enable_tenant_rls('kernel.sequences');
GRANT SELECT, INSERT, UPDATE ON kernel.sequences TO microslab_app;

-- Entrega el siguiente código de forma atómica (sin huecos por concurrencia dentro de la transacción).
CREATE OR REPLACE FUNCTION kernel.next_code(p_sequence_key text, p_prefix text, p_scope_key text DEFAULT '')
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_value bigint;
  v_prefix text;
  v_padding integer;
BEGIN
  INSERT INTO kernel.sequences (sequence_key, scope_key, prefix)
  VALUES (p_sequence_key, p_scope_key, p_prefix)
  ON CONFLICT (laboratory_id, sequence_key, scope_key) DO NOTHING;

  UPDATE kernel.sequences
     SET next_value = next_value + 1
   WHERE laboratory_id = kernel.current_laboratory_id()
     AND sequence_key = p_sequence_key AND scope_key = p_scope_key
  RETURNING next_value - 1, prefix, padding INTO v_value, v_prefix, v_padding;

  RETURN v_prefix || lpad(v_value::text, v_padding, '0');
END $$;
GRANT EXECUTE ON FUNCTION kernel.next_code(text, text, text) TO microslab_app;

-- Idempotencia: la misma petición repetida (doble clic, reintento de red) no ejecuta dos veces.
CREATE TABLE kernel.idempotency_keys (
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id(),
  key           text NOT NULL CHECK (length(key) BETWEEN 8 AND 200),
  command       text NOT NULL,
  request_hash  text NOT NULL,
  response      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (laboratory_id, key)
);
SELECT kernel.enable_tenant_rls('kernel.idempotency_keys');
GRANT SELECT, INSERT ON kernel.idempotency_keys TO microslab_app;
