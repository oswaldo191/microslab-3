-- MICROSLAB 3.0 — Bootstrap de la base de datos.
-- Lo ejecuta un superusuario UNA sola vez por entorno (docker init, CI o provisión).
-- Crea los roles y la base. Las migraciones las ejecuta después microslab_owner.
--
-- Roles:
--   microslab_owner      Dueño de todos los objetos. Solo migraciones. Nunca lo usa la aplicación.
--   microslab_app        Rol de la API y los workers. No es dueño de nada y NO puede saltarse RLS.
--   microslab_dispatcher Lee y marca eventos del outbox (todos los laboratorios). Sin acceso a datos clínicos.
--
-- Las contraseñas de ejemplo son solo para desarrollo; en producción vienen del gestor de secretos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'microslab_owner') THEN
    CREATE ROLE microslab_owner LOGIN PASSWORD 'owner_dev_password' NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'microslab_app') THEN
    CREATE ROLE microslab_app LOGIN PASSWORD 'app_dev_password' NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'microslab_dispatcher') THEN
    CREATE ROLE microslab_dispatcher LOGIN PASSWORD 'dispatcher_dev_password' NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

SELECT 'CREATE DATABASE microslab OWNER microslab_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'microslab') \gexec

\connect microslab
CREATE EXTENSION IF NOT EXISTS pgcrypto;
REVOKE ALL ON DATABASE microslab FROM PUBLIC;
GRANT CONNECT ON DATABASE microslab TO microslab_app, microslab_dispatcher;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
