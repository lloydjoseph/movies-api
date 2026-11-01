# Session handoff

Updated: 2026-10-30

## Latest handoff (2026-10-31)

- The user is setting up one-click manual production deployment via GitHub Actions. Commit `41eff9f` adds `.github/workflows/deploy-production.yml` and documents the required GitHub `production` environment secrets. Backend tests, frontend tests (8), and frontend build passed when the workflow was added.
- The hosted-runner deployment failed because GitHub cannot reach the server over SSH (port 22 connection timed out). Do not recommend exposing SSH publicly as the quick fix. User was advised to use a self-hosted GitHub Actions runner on the server.
- Next: have the user register a Linux x64 self-hosted runner at **Repository → Settings → Actions → Runners → New self-hosted runner**, following the commands GitHub displays directly on the server. Keep its temporary registration token on the server. Install/run the service as the deployment user (likely `joseph`, not root); ensure it has Docker/Compose access. Restrict runner access to this private repository and trusted deployment workflow/branch.
- Then update the workflow: run on the self-hosted runner (with matching labels) instead of `ubuntu-latest`; keep the `main` branch gate, manual trigger, production environment/backup confirmation, tests, and concurrency guard. Remove SSH setup/secrets and deploy directly from the checked-out workflow workspace on the server using `/etc/movies-api/production.env`, `docker-compose.production.yml`, and Compose project `movies-production`. `actions/checkout` provides the selected commit in the runner workspace, so do not fetch/merge a separate server checkout as the current SSH workflow does.
- The actual production Compose stack is named `movies-production` and currently runs frontend/backend/Postgres; the gateway binds `127.0.0.1:8188`. Preserve the existing Postgres volume and do not use `down -v`. Workflow must continue requiring a current backup before the user confirms deployment.
- After switching to the self-hosted runner and verifying a successful deployment, remove the now-unused `PRODUCTION_SSH_*` GitHub secrets and the temporary SSH deployment key if the user agrees. Never ask them to paste secrets or tokens.
- Recent relevant commits: `41984d6` adds the orange Lucide clapperboard favicon; `2210a70` removes unrelated IDE files inadvertently included in that commit; `41eff9f` adds the first GitHub deployment workflow. Check whether these commits are pushed before proceeding.
- The local worktree has unrelated IntelliJ modifications/untracked files and `backend/.m2/`; do not commit or clean them. Check `git status` before editing or committing.

## Latest handoff (2026-10-30)

- The user is handing work over to Gemini. Read `PROJECT_CONTEXT.md` and this file first. They work from Ubuntu/WSL and use the command line.
- Recent local commits on `main`: `7ca7920` host-Nginx deployment routing; `d135553` catalog documentation; `dcae126` catalog controls and inline editing; `fe8eceb` sorting and rating filters. At the last local check, no push or server deployment had been confirmed; check status before proceeding.
- The root [README](../README.md) explains the app, local setup, launch, and docs.
- Fira Sans is now bundled as local WOFF2 assets in `frontend/src/fonts/`, with its OFL license. Google Fonts links and external font CSP allowances were removed. `npm run build` succeeded after this change.
- Default catalog sorting and sort controls implemented:
  - Catalog sorts by default by movie rating descending (10 down to 1), with unrated movies placed at the end (`NULLS LAST`), followed by release year descending and name ascending as tie-breakers.
  - Sorting is configurable via `sort` param on `GET /api/movies`: `rating_desc` (default), `rating_asc`, `year_desc`, `year_asc`, `title_asc`, `title_desc`.
  - Placed column sorting headers with dynamic arrows (`Name ↕`, `Year ↕`, and `Rating ↓`) directly above the movie list columns: active sort displays `↓` or `↑` in orange, while inactive columns display `↕`.
  - Replaced the rating dropdown with Option 3 interactive rating number pills (`10` down to `1`, `All`, and `Unrated`): supports selecting single or multiple rating numbers simultaneously.
  - Extended backend `MovieRepository` and `MovieController` to natively accept `ratings=...` (CSV or list) and `includeUnrated=true` while maintaining full backwards compatibility for legacy range/exact filters.
  - Removed the dedicated Sort toolbar line so the top toolbar only contains the full-width search bar and the rating number filter pills.
  - Fixed UI flickering on button click / reload: configured `scrollbar-gutter: stable; overflow-y: scroll;` on `html` in `styles.css` so the scrollbar track never disappears, and preserved the existing movie list with subtle opacity during reloads instead of unmounting the list.
  - Vitest test environment compatibility fix: added guards around `localStorage` in `App.readThemePreference` and `App.toggleTheme`.
  - Query fix for absent search query retained: `MovieServiceImpl` passes `""` and `MovieRepository` checks `:title = ''` to prevent `lower(bytea)` errors.
  - All 11 backend tests (`./mvnw test`) and 3 frontend tests (`npm test`) pass; `npm run build` succeeds.
- Local launch troubleshooting: running `./mvnw spring-boot:run` without `SPRING_PROFILES_ACTIVE=local` left `${DB_URL}` unresolved. Starting with the local profile then revealed a mismatch between `DB_PASSWORD` in `backend/.env` and the password stored in the persistent Postgres volume. The user subsequently reported Spring Boot started successfully at 12:55. Never ask for or record the password. Current launch command, from `backend/`: `SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run`.
- `backend/.m2/` appears as an untracked local cache; leave it out of commits. Inspect `git status` before further edits.
- Runtime check needed: restart the local backend (`SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run`) to test the new sorting endpoint live in the browser.

## Current state

- The local PostgreSQL `movie` table has 345 rows and 344 distinct titles. All 345 rows now have a release year and are assigned to the owner's account. A transactional backfill matched all CSV IDs and updated only `release_year` and `account_id`; verification confirmed 345 populated years (range 1937–2026) and 345 owner assignments. The owner confirmed the catalog data is present; the current paginated endpoint is `GET /api/movies`.
- The 139 legacy `rating = 0` values were converted to `NULL` in a guarded transaction, following the agreed meaning of zero as unrated. Verification confirmed no zero or out-of-range ratings remain.
- The completed working CSV is at `~/movies-import.csv` on the owner's machine, outside the repository. It must not be re-imported; existing rows were updated in place. The owner declined a database backup before the backfill.
- OAuth sign-in works from the command line after loading local environment variables and restarting the backend. Never copy credential values into documentation or Git.
- The JPA mapping requires movie name, release year, and account. Liquibase created its changelog history, retained the existing tables, enforced the required fields and rating range, and added movie ID generation. Hibernate initialized successfully with `ddl-auto=validate`. The database still has all 345 movies.
- After the migration, the backend restarted normally, Google sign-in worked, and the owner confirmed the account endpoint and catalog data.
- Account-scoped movie create, update, and delete endpoints are implemented. Every allowlisted account now receives a separate catalog.
- Backend test sources cover account allowlisting and PostgreSQL-backed API integration for Liquibase, CRUD, ownership isolation, validation, authentication, and CSRF. Before the latest paging/security changes, all 9 tests passed; the current tests have not been rerun.
- The Angular frontend now has Google sign-in, account/session detection, responsive catalog display, create/edit/delete flows, server-side title/rating filters, paging, and light/dark themes.
- The movie list uses selectable rows to reveal Edit/Remove actions on both mobile and desktop. Edit and delete confirmation replace the selected row inline; row height animates to fit the panel and back. Add/edit panels and action overlays have subtle animations, disabled when reduced motion is requested.
- The inline edit form places Title and a compact Year input side by side, with a full-width segmented rating control below. Selecting the chosen rating again clears it to unrated. The Add Movie form shares the Title/Year plus rating layout but still uses a dropdown. Invalid edit submissions show title/year errors directly below their inputs.
- Active title or rating filters with no results show “No matching movies.” Frontend currently has 8 passing tests and `npm run build` succeeds.
- Backend database properties now require `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. Local development uses an ignored `backend/.env` and the `local` profile. Production OAuth callback URLs use forwarded headers only in the `production` profile; keep backend traffic restricted to the trusted proxy network.
- Product direction: “Joseph’s Movies”, orange accent, Fira Sans, larger relative text, and Tailwind styling. Production URL: `https://jlloyd.fr/movies/`. The app build uses that base path; movie APIs are under `/api/movies` to avoid a URL collision. Configure production `APP_FRONTEND_URL=https://jlloyd.fr/movies/`.
- The repository includes production Dockerfiles, a private-network Compose stack, and an Nginx gateway with security headers. The agreed ingress is Debian host Nginx proxying to the gateway on `127.0.0.1:8188`; do not change the router rules, NPM, or media network. The server still needs the apex certificate, protected production environment file, OAuth callback, data migration, and a tested backup/restore procedure.
- Server observations and deployment facts from 2026-10-30 are recorded in [deployment](technical/deployment.md): host Nginx owns ports 80/443; NPM is the `npm` container in Compose project `media-stack`, attached to `media-stack_default`, with host ports 81/8888/4443; the media containers and their observed ports are listed there. The `joseph` account cannot use `sudo`, so use the owner's separate root/admin access for host changes.
- The inspected source dump identifies MariaDB 11.8.6. The server has a `mysql:8` container with loopback-only port 3306, but it is not confirmed as the live source of the movie catalog.
- One CSV title differed from the database only by a leading space. The backfill did not update titles, preserving the database's original title.

## Next steps

1. Do not drop the Docker volume, truncate the table, or re-run an insert-only import.
2. Restart the backend with `SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run` and verify the signed-in movie list loads without the `lower(bytea)` SQL error. Then manually verify search, filters, and CRUD.
3. Commit the pending query fix only after reviewing the diff. Keep `backend/.m2/` out of Git.
4. Push the reviewed commits if desired, then configure the host-Nginx certificate/site and protected production environment using [the deployment guide](technical/deployment-guide.md). Do not alter router forwarding, NPM, Jellyfin, or media networks.
5. Before production cutover, identify the live source database, rehearse and validate migration, and verify database backup/restore. Do not treat an empty production database as authoritative.
6. Remaining product work includes cross-device theme preference and movie recommendations.

## Repository notes

- There are many uncommitted initial-project and implementation files. Do not stage, commit, or clean them without the owner's request.
- OAuth credentials and the allowed account identity are configured locally; never request them or copy them into repository documentation.
- Detailed product, architecture, and data migration notes are in `docs/product/` and `docs/technical/`.
