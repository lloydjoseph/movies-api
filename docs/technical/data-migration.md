# Data migration plan

**Status:** The local PostgreSQL catalog backfill and Liquibase schema migration are complete and verified. The migration plan remains required before production cutover. The inspected dump identifies MariaDB 11.8.6 and a single `movie` table; the live source location, backup/restore path, and cutover process still need confirmation.

## Goal

Move the previous application's existing movie catalog and ratings into the new application's dedicated PostgreSQL database while preserving the owner's data. The application must not become the source of truth until the migrated data has been checked and the source can be restored if needed.

## Known target

- Target database: the dedicated PostgreSQL container in the movie app's Docker Compose deployment.
- Every movie requires a title and release year; ranking is an optional integer from 1 to 10. The completed local working CSV had all 345 release years filled before the backfill.
- Target ownership: each movie belongs to an account. Existing personal records should be associated with the owner's account; additional accounts have separate catalogs.
- The current JPA model includes an Account keyed by Google `sub` and Movie fields for title, release year, optional rating, and account ownership. The JPA mapping and local database now require movie name, release year, and account ownership. Liquibase enforces these constraints and the 1–10 optional rating range; Hibernate validates the schema at startup. The product/API must also require a release year for every new or edited movie.

## Source details to establish

- Database engine/version in the dump: MariaDB 11.8.6. This does not establish whether the home server's MySQL 8 container hosts the live source; confirm before planning a live export.
- Dumped table: `movie(id INT NOT NULL, name VARCHAR(255) NOT NULL, rating INT NULL)`, using InnoDB and `utf8mb4_unicode_ci`. The dump has no release-year column.
- The local PostgreSQL movie table contains 345 rows and 344 distinct titles. Its legacy columns were `id`, `name`, and nullable `rating`; release-year and account ownership were added later.
- Ratings range from 0 to 10. The owner confirmed that 0 means unrated, so map 0 to null. The replacement CSV contains 206 rated records and 139 unrated records.
- The completed working CSV contains all 345 rows and years; it lives at `~/movies-import.csv` on the owner's machine and is not in Git. It was rebuilt from the local PostgreSQL table after the first SQL-dump parser omitted eight rows. The earlier 337-row CSV is incomplete and must not be used.
- A transactional local backfill matched all 345 IDs and populated `release_year` and `account_id`; post-checks confirmed 345 populated years and 345 rows assigned to the owner's account. A follow-up guarded transaction converted all 139 legacy `rating = 0` values to `NULL`; the remaining 206 ratings are within the supported 1–10 range. Do not discard the database volume or rerun an insert-only import.
- Duplicate titles, title encoding, live record count, and records requiring cleanup remain to be checked.
- Whether any application currently writes to the source and whether writes can be paused during final cutover.
- Source backup mechanism and a verified restore path.

Do not put credentials, connection strings containing secrets, or exported personal data in this document or Git.

## Mapping decisions still needed

- Map source `name` to target title, preserving the original text unless an explicit correction is approved.
- Map source `rating` to the optional 1–10 target ranking. Map confirmed source value 0 (unrated) to null; never silently clamp or discard any other out-of-range values.
- The owner completed the missing years in the working CSV before the local backfill. Candidate years from research are references and must not be selected automatically in any future migration.
- Associate all existing records with the owner's initial account.
- Define handling for duplicate records and invalid rows before importing. Preserve a source-to-target ID map if references or auditability require it.

## Safe migration sequence

1. Inventory the source schema and data without modifying it.
2. Agree on a field mapping and explicit rules for missing or invalid values.
3. Make a full source backup and verify that it can be restored.
4. Build an idempotent export/import process for production and run it against a disposable PostgreSQL database.
5. Compare source and target row counts; validate title/year completeness, ranking range, account ownership, and representative records. Reconcile every skipped or transformed row.
6. Repeat the migration from a fresh target database to prove the procedure is reproducible.
7. At cutover, pause source writes, take a final backup/export, run the migration, validate the target, then point the application at PostgreSQL.
8. Keep the source unchanged and available until the new app has been used successfully and the owner accepts the migration. Define the rollback decision and restore steps before cutover.

## Acceptance criteria

- Every in-scope source record is present in the target or is accounted for in an explicit owner-approved exception list.
- Every migrated record has a valid title and release year, an optional ranking in range, and the correct owner account association.
- All 345 local rows have a release year and owner assignment; no year was silently invented or discarded. Production migration still needs independent validation.
- The source backup and target restore procedures have been exercised before cutover.
- A repeatable migration artifact and execution log exist without embedding secrets or exporting personal data into the repository.

## Open questions

- Where does the live source database run? Is it the server's MySQL 8 container, or does the dump come from another database?
- Can writes be paused during final migration, and how long is acceptable for cutover?
