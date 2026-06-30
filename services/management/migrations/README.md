# Database Migrations

Authoritative PostGIS (PostgreSQL 16 + PostGIS 3.4) schema for Fleet Command
Center. Migrations are plain SQL applied in ascending numeric order. Each
migration ships an `*.up.sql` (apply) and a matching `*.down.sql` (rollback)
so the schema can be advanced or reverted deterministically — the same
up/down contract NestJS/TypeORM migrations follow.

## Files

| Order | Migration | Purpose | Requirements |
|-------|-----------|---------|--------------|
| 0001 | `0001_core_relational_tables` | `Driver`, `Vehicle`, `Delivery`, `Assignment`, `Route` + enums, constraints, FKs, timestamps | 1.1, 3.1, 7.1, 8.1, 9.3 |
| 0002 | `0002_geospatial_tables` | `Zone` (Polygon 4326 + GiST), `Location_Ping` (Point 4326 + GiST + btree), `Zone_Event`, `Vehicle_Zone_Membership` | 4.1, 6.1, 6.3, 6.4 |
| 0003 | `0003_delivery_status_history_retention` | `Delivery_Status_History` + ≥365-day retention policy | 16.1, 16.2 |

## Conventions

- Identifiers use `gen_random_uuid()` (PostgreSQL core, no extension needed).
- Enum domains are PostgreSQL `CREATE TYPE ... AS ENUM`, mirroring the
  `@fleet/contracts` enums so the wire representation and the column domain
  stay aligned (`On_Delivery`, `In_Transit`, etc.).
- `createdAt` / `updatedAt` are `timestamptz`. A shared `set_updated_at()`
  trigger advances `updatedAt` on every row update (Property 4).
- All migrations are wrapped in a transaction and are safe to re-run after a
  rollback.

## Applying

The runner is intentionally minimal — apply with `psql` against the database
defined in `docker-compose.yml`:

```sh
# from repo root, with the postgis container running
psql "postgresql://fleet:fleet@localhost:5432/fleet_command_center" \
  -v ON_ERROR_STOP=1 \
  -f services/management/migrations/0001_core_relational_tables.up.sql \
  -f services/management/migrations/0002_geospatial_tables.up.sql \
  -f services/management/migrations/0003_delivery_status_history_retention.up.sql
```

Roll back in reverse order using the matching `*.down.sql` files.
