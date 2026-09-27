-- 0003 — Fundaciones del laboratorio: sucursales, usuarios, roles y permisos, con RLS forzado.

-- Ayudante único para aplicar el aislamiento a cualquier tabla de laboratorio (sin duplicar SQL).
--   p_branch_column: si la tabla pertenece a una sucursal, se agrega una política restrictiva
--   que además exige que la sucursal esté entre las permitidas al usuario.
CREATE OR REPLACE FUNCTION kernel.enable_tenant_rls(p_table regclass, p_branch_column text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s
       USING (laboratory_id = kernel.current_laboratory_id())
       WITH CHECK (laboratory_id = kernel.current_laboratory_id())', p_table);
  IF p_branch_column IS NOT NULL THEN
    EXECUTE format(
      'CREATE POLICY branch_scope ON %s AS RESTRICTIVE
         USING (kernel.branch_visible(%I))
         WITH CHECK (kernel.branch_visible(%I))', p_table, p_branch_column, p_branch_column);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION kernel.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Sucursales ---------------------------------------------------------------
CREATE TABLE app.branches (
  id            uuid NOT NULL DEFAULT kernel.uuid_v7(),
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id()
                REFERENCES platform.laboratories (id),
  code          text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
  name          text NOT NULL CHECK (length(trim(name)) > 0),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  version       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE (laboratory_id, id),          -- permite claves foráneas compuestas
  UNIQUE (laboratory_id, code)
);
CREATE TRIGGER branches_touch BEFORE UPDATE ON app.branches
  FOR EACH ROW EXECUTE FUNCTION kernel.touch_updated_at();
SELECT kernel.enable_tenant_rls('app.branches', 'id');

-- Usuarios del laboratorio (la autenticación completa llega en F1) ---------
CREATE TABLE app.users (
  id            uuid NOT NULL DEFAULT kernel.uuid_v7(),
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id()
                REFERENCES platform.laboratories (id),
  email         text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'locked', 'inactive')),
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE (laboratory_id, id)
);
CREATE UNIQUE INDEX users_email_per_lab ON app.users (laboratory_id, lower(email));
CREATE TRIGGER users_touch BEFORE UPDATE ON app.users
  FOR EACH ROW EXECUTE FUNCTION kernel.touch_updated_at();
SELECT kernel.enable_tenant_rls('app.users');

CREATE TABLE app.user_branches (
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id(),
  user_id       uuid NOT NULL,
  branch_id     uuid NOT NULL,
  PRIMARY KEY (laboratory_id, user_id, branch_id),
  FOREIGN KEY (laboratory_id, user_id) REFERENCES app.users (laboratory_id, id),
  FOREIGN KEY (laboratory_id, branch_id) REFERENCES app.branches (laboratory_id, id)
);
SELECT kernel.enable_tenant_rls('app.user_branches');

-- Roles y permisos --------------------------------------------------------
CREATE TABLE app.roles (
  id            uuid NOT NULL DEFAULT kernel.uuid_v7(),
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id()
                REFERENCES platform.laboratories (id),
  key           text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name          text NOT NULL,
  description   text,
  is_template   boolean NOT NULL DEFAULT false,
  all_branches  boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE (laboratory_id, id),
  UNIQUE (laboratory_id, key)
);
CREATE TRIGGER roles_touch BEFORE UPDATE ON app.roles
  FOR EACH ROW EXECUTE FUNCTION kernel.touch_updated_at();
SELECT kernel.enable_tenant_rls('app.roles');

CREATE TABLE app.role_permissions (
  laboratory_id  uuid NOT NULL DEFAULT kernel.current_laboratory_id(),
  role_id        uuid NOT NULL,
  permission_key text NOT NULL REFERENCES platform.permissions (key),
  limits         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- p. ej. {"max_discount_percent": 10}
  PRIMARY KEY (laboratory_id, role_id, permission_key),
  FOREIGN KEY (laboratory_id, role_id) REFERENCES app.roles (laboratory_id, id)
);
SELECT kernel.enable_tenant_rls('app.role_permissions');

CREATE TABLE app.user_roles (
  laboratory_id uuid NOT NULL DEFAULT kernel.current_laboratory_id(),
  user_id       uuid NOT NULL,
  role_id       uuid NOT NULL,
  PRIMARY KEY (laboratory_id, user_id, role_id),
  FOREIGN KEY (laboratory_id, user_id) REFERENCES app.users (laboratory_id, id),
  FOREIGN KEY (laboratory_id, role_id) REFERENCES app.roles (laboratory_id, id)
);
SELECT kernel.enable_tenant_rls('app.user_roles');

-- Permisos del rol de aplicación: nunca DELETE sobre entidades; solo sobre tablas de asignación.
GRANT SELECT, INSERT, UPDATE ON app.branches, app.users, app.roles TO microslab_app;
GRANT SELECT, INSERT, DELETE ON app.user_branches, app.user_roles, app.role_permissions TO microslab_app;
