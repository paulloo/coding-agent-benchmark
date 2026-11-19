-- Control plane database is created by POSTGRES_DB.
-- The execution plane uses a separate database and a role that has no
-- access to the control plane.

CREATE ROLE cab_agent LOGIN PASSWORD 'cab_agent_local' NOSUPERUSER NOCREATEDB;
CREATE DATABASE cab_dogwalk OWNER cab;

\connect cab_dogwalk

GRANT USAGE, CREATE ON SCHEMA public TO cab_agent;
ALTER SCHEMA public OWNER TO cab;
