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

## Foundation status

The foundation schema (Plan 1) is complete. 25 versioned migrations + 2 repeatable seeds, verified by 106 pgTAP tests across 23 test files.

### Schemas
- **core** — region, branch, address, person, contact_info, person_address, household, household_member, kinship (+ bidirectional view)
- **membership** — lifecycle_stage, role, member, lifecycle_stage_history, branch_membership_history, member_role, regular_member_application, pastoral_care_assignment

### Key features
- Soft-delete (`deleted_at`) on person, household, member with `_active` views
- Generic `record_history()` trigger auto-populates lifecycle and branch transfer history
- PII column grants via `app_general` / `app_pastoral` / `app_full` database roles
- Repeatable seed migrations for lifecycle stages (FTV→OGV→RA→REGULAR_MEMBER, DFL) and roles
- Bidirectional kinship view (auto-flips PARENT_OF↔CHILD_OF)
- PCM assignment with partial unique index (one active carer per member)

### Tagged at
`git tag plan-1-foundation-complete`

---

## Production deploy (Cloud SQL)

The `db/migrations/` SQL files are environment-agnostic and apply cleanly to any PostgreSQL 16 instance. For Cloud SQL:

1. Override Flyway connection details at invocation time — do NOT edit `flyway.conf`. Use environment variables (`FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`) or CLI flags (`-url=`, `-user=`, `-password=`).
2. Skip the `pgtap_installer` service entirely. It mounts the host Docker socket and `apt-get install`s the pgtap package inside the local postgres container — neither is possible against managed Cloud SQL. Cloud SQL's pgTAP support (or lack thereof) is governed by the [Cloud SQL extensions allow-list](https://cloud.google.com/sql/docs/postgres/extensions); if pgTAP is unavailable there, the migrations still apply, but tests must be run against the local Docker stack only.
3. The `docker-compose.yml` in this directory is for local development only.
