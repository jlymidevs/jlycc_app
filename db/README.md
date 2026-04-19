# JLY Church Database — Local Development

## Prerequisites
- Docker Desktop (Windows/macOS) or Docker Engine + Compose v2
- Git Bash (Windows) or any POSIX shell

## Start everything
```bash
cd db
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
```

## Run tests
```bash
./tests/run_tests.sh
```

## Reset database (wipes all data)
```bash
docker compose down -v
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
```

## Connect with psql
```bash
docker exec -it jly_postgres psql -U jly_admin -d jly
```

## Production deploy (Cloud SQL)

The `db/migrations/` SQL files are environment-agnostic and apply cleanly to any PostgreSQL 16 instance. For Cloud SQL:

1. Override Flyway connection details at invocation time — do NOT edit `flyway.conf`. Use environment variables (`FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`) or CLI flags (`-url=`, `-user=`, `-password=`).
2. Skip the `pgtap_installer` service entirely. It mounts the host Docker socket and `apt-get install`s the pgtap package inside the local postgres container — neither is possible against managed Cloud SQL. Cloud SQL's pgTAP support (or lack thereof) is governed by the [Cloud SQL extensions allow-list](https://cloud.google.com/sql/docs/postgres/extensions); if pgTAP is unavailable there, the migrations still apply, but tests must be run against the local Docker stack only.
3. The `docker-compose.yml` in this directory is for local development only.
