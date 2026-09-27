-- 0002 — Plataforma: laboratorios (tenants) y catálogo global de permisos.

CREATE TABLE platform.laboratories (
  id          uuid PRIMARY KEY DEFAULT kernel.uuid_v7(),
  code        text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{3,20}$'),
  subdomain   text NOT NULL UNIQUE CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{1,40}[a-z0-9])$'),
  legal_name  text NOT NULL,
  trade_name  text NOT NULL,
  rnc         text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('onboarding', 'active', 'suspended', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- La API necesita resolver el laboratorio por subdominio ANTES de tener contexto.
-- Solo se expone lo mínimo para eso, mediante una vista.
CREATE VIEW platform.laboratory_directory AS
  SELECT id, subdomain, status FROM platform.laboratories;
GRANT SELECT ON platform.laboratory_directory TO microslab_app;

-- Catálogo global de permisos (lo llena la semilla desde packages/contracts).
CREATE TABLE platform.permissions (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_]*)+$'),
  module_key  text NOT NULL,
  description text NOT NULL,
  requires_reason boolean NOT NULL DEFAULT false
);
GRANT SELECT ON platform.permissions TO microslab_app;
