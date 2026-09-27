-- 0001 — Kernel: esquemas, identificadores UUID v7 y contexto de laboratorio para RLS.

CREATE SCHEMA IF NOT EXISTS kernel;   -- piezas técnicas compartidas (contexto, outbox, secuencias)
CREATE SCHEMA IF NOT EXISTS platform; -- datos de la plataforma MicroSlab (laboratorios, planes)
CREATE SCHEMA IF NOT EXISTS app;      -- datos de cada laboratorio (siempre con laboratory_id + RLS)
CREATE SCHEMA IF NOT EXISTS audit;    -- auditoría inmutable

GRANT USAGE ON SCHEMA kernel, platform, app, audit TO microslab_app;
GRANT USAGE ON SCHEMA kernel TO microslab_dispatcher;

-- UUID v7: ordenable por tiempo (mejores índices que v4). PostgreSQL 16 no lo trae de fábrica.
CREATE OR REPLACE FUNCTION kernel.uuid_v7() RETURNS uuid
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  ts_ms bytea;
  b bytea;
BEGIN
  ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  b := ts_ms || gen_random_bytes(10);
  b := set_byte(b, 6, (b'0111' || get_byte(b, 6)::bit(4))::bit(8)::int);  -- versión 7
  b := set_byte(b, 8, (b'10' || get_byte(b, 8)::bit(6))::bit(8)::int);    -- variante RFC 4122
  RETURN encode(b, 'hex')::uuid;
END $$;

-- Contexto de la petición. La API lo fija con SET LOCAL al abrir cada transacción:
--   app.laboratory_id  uuid del laboratorio (obligatorio para ver cualquier fila de "app")
--   app.branch_ids     lista de sucursales permitidas, separadas por coma
--   app.all_branches   'true' si el rol del usuario abarca todas las sucursales
--   app.actor_type / app.actor_id  quién actúa (para la auditoría)
-- Si falta el laboratorio, las funciones devuelven NULL y las políticas no dejan ver nada (falla cerrado).

CREATE OR REPLACE FUNCTION kernel.current_laboratory_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.laboratory_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION kernel.current_branch_ids() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    string_to_array(nullif(current_setting('app.branch_ids', true), ''), ',')::uuid[],
    ARRAY[]::uuid[]
  )
$$;

CREATE OR REPLACE FUNCTION kernel.all_branches() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.all_branches', true), '')::boolean, false)
$$;

-- ¿Puede el contexto actual ver filas de esta sucursal?
CREATE OR REPLACE FUNCTION kernel.branch_visible(p_branch_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_branch_id IS NULL OR kernel.all_branches() OR p_branch_id = ANY (kernel.current_branch_ids())
$$;

GRANT EXECUTE ON FUNCTION kernel.uuid_v7(), kernel.current_laboratory_id(), kernel.current_branch_ids(),
  kernel.all_branches(), kernel.branch_visible(uuid) TO microslab_app;
