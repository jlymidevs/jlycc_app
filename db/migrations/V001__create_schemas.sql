CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS membership;

COMMENT ON SCHEMA core IS 'Foundation entities: persons, branches, regions, households, kinship';
COMMENT ON SCHEMA membership IS 'Member records, lifecycle stages, roles, pastoral care assignments';
