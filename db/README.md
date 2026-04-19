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
Update `flyway.conf` with the Cloud SQL connection string and run `flyway migrate`. The migrations are environment-agnostic.
