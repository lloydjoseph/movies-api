# Manual deployment guide

Production updates are started from the GitHub Actions **Deploy production** workflow. Before dispatching, create and verify a current backup of the active production PostgreSQL database. The workflow checks out and tests the selected commit on `main`, requires confirmation of that backup, then uses a self-hosted runner on the server to rebuild the existing production Compose services. The confirmation input is only an acknowledgement; the workflow does not create or validate a backup.

**Current server status (2026-11-01):** Docker reports `movies-production` running frontend, backend, and healthy PostgreSQL services. The PostgreSQL data volume is `movies-production_postgres_data`; the frontend binds `127.0.0.1:8188`. The owner reports the runner is running as a service. A root session confirmed `/etc/movies-api/production.env` is readable, but access by the runner user and its Docker access have not been verified. This is an update to a live stack, not its first startup. The live catalog contents/count, deployed commit, apex certificate/public Nginx route, and backup/restore procedure still need verification. A separate `movies-api` project has a running MySQL 8 container; do not assume it is the active catalog source or migrate/import its data without comparing it to production PostgreSQL.

Before the next update, review the production Compose configuration, confirm the runner user's Docker and environment-file access, inspect the current production catalog, and create a verified backup. Keep the existing volume and Compose project name; never use `down -v`.

## One-time setup and checks before the next release

- The owner reports the repository-scoped Linux x64 self-hosted runner is installed as a service. Confirm it appears **Online** in **Settings → Actions → Runners**, uses the `self-hosted`, `linux`, and `x64` labels, and its service user can run Docker Compose and read `/etc/movies-api/production.env`. Do not reuse the registration token that appeared in chat.
- From an authorized root shell, verify both prerequisites as the service user without printing environment values:

  ```bash
  runuser -u joseph -- sh -c 'test -r /etc/movies-api/production.env && docker ps >/dev/null && docker compose version' \
    && echo "runner prerequisites are accessible"
  ```
- In the repository's **Settings → Environments**, create or retain the `production` environment and configure any required deployment approval. The workflow uses the checked-out commit in the runner workspace; it does not fetch or update a separate server checkout.
- The `joseph` shell account reported that it is not in the sudoers file. The owner confirmed separate root/admin access; run the `/etc`, Nginx, and Certbot setup commands from that authorized administrative session.
- The server already has host Nginx on public ports 80/443. Keep it and its `ask.jlloyd.fr` and `watch.jlloyd.fr` virtual hosts unchanged; do not alter router forwards or NPM.
- DNS for `jlloyd.fr` points to the server's router address. Obtain a separate Let's Encrypt certificate for the apex; the existing certificates cover only `ask.jlloyd.fr` and `watch.jlloyd.fr`.
- Install the temporary ACME config from `deploy/nginx-movies-acme.conf` under `/etc/nginx/sites-available/movies-api`, enable it if not already enabled with `test -e /etc/nginx/sites-enabled/movies-api || ln -s /etc/nginx/sites-available/movies-api /etc/nginx/sites-enabled/movies-api`, validate with `/usr/sbin/nginx -t`, reload host Nginx, then run `certbot certonly --nginx -d jlloyd.fr`.
- After the certificate exists, install the final `deploy/nginx-movies.conf` at `/etc/nginx/sites-available/movies-api`, validate and reload Nginx. The final host config proxies to the Compose frontend gateway on loopback port 8188.
- `/etc/movies-api/production.env` already exists. The root session confirmed it is readable, but confirm runner-user access without printing its contents. Do not overwrite it with the example template; never put actual secrets in Git or command history.
- Keep `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` for PostgreSQL initialization only; the Spring Boot service must receive only the application role in `DB_USERNAME` and `DB_PASSWORD`. The init script is applied only to an empty PostgreSQL volume.
- Choose a protected backup location and document/rehearse how to restore the active production PostgreSQL database.
- Compare the live production PostgreSQL catalog with the local catalog and the separate MySQL 8 service. Migrate only if comparison shows data is missing from production and after rehearsing the migration; do not import into or replace a catalog that is already correct.
- Register `https://jlloyd.fr/login/oauth2/code/google` as an allowed Google OAuth callback.
- Decide the production branch or release-tag convention and record the deployed Git commit.

## Release checklist

### 1. Prepare the release

1. Review the changes and make sure the intended release is ready.
2. Run the relevant backend/frontend checks before deployment:

   ```bash
   (cd backend && ./mvnw test)
   (cd frontend && npm test)
   (cd frontend && npm run build)
   ```

3. Record the commit or release tag that will be deployed.
4. Confirm that the server has enough free disk space for the application images and a database backup.

### 2. Inspect and back up the active production database

The active target is the PostgreSQL service in the existing `movies-production` project—not automatically the separate MySQL 8 container. First record the catalog row count and account count without printing movie data. Before a release that can affect data or schema, take a PostgreSQL dump. Replace the protected backup path with a real directory; do not put the dump in the checkout:

```bash
umask 077
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > <protected-backup-directory>/movies-<date-and-time>.sql
```

Check that the dump exists and is non-empty, and verify restoration to a separate test database before relying on it. Keep an off-server copy if the catalog is important. The workflow's `backup_confirmed` checkbox does not perform any of these checks.

### 3. Validate configuration and deploy

From the checked-out release workspace, validate the production Compose configuration. This must use the existing project name so Compose reuses `movies-production_postgres_data`. Keep rendered configuration output private because it may contain expanded values:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production config --quiet
```

Confirm that the frontend publishes only `127.0.0.1:8188->8080`; do not publish the backend or database ports.

Then build and start/update the application:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production up -d --build
```

Confirm the current project still reports the expected PostgreSQL volume before proceeding. Do not use `docker compose down -v` as a routine update command; removing volumes can delete the database. Do not expose PostgreSQL on a public host port.

### 4. Check the deployment

Use the production Compose services:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production ps
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production logs --tail=100 frontend backend postgres
```

Install the final host Nginx config from `deploy/nginx-movies.conf` only after the apex certificate exists and the Compose frontend is responding on `127.0.0.1:8188`. Validate and reload Nginx:

```bash
install -m 0644 deploy/nginx-movies.conf /etc/nginx/sites-available/movies-api
/usr/sbin/nginx -t
systemctl reload nginx
```

Then check the application through its public domain:

- `https://jlloyd.fr/movies/` opens with a certificate whose SAN includes `jlloyd.fr` and no browser certificate warning.
- Existing `ask.jlloyd.fr`, `watch.jlloyd.fr`, Jellyfin, and NPM routes still work.
- Google sign-in works for an allowlisted account.
- An authenticated user sees only their own movie catalog.
- Add, view, search, filter, edit, and confirmed permanent delete work as expected.
- An unauthenticated visitor cannot access movie data.
- The light/dark theme follows the device by default; a manual choice persists through sign-out/sign-in and on another device.

Avoid testing permanent deletion on real catalog data; use a disposable test entry and remove it only after confirming the prompt.

### 5. If the release fails

- Capture the relevant Compose logs and note the deployed commit before making further changes.
- If the failure is limited to application code and the database schema remains compatible, restore the previous commit and rebuild/recreate the application services.
- If the release changed database schema or data, do not assume an application rollback is safe. Follow the documented database restore/migration recovery procedure; this procedure still needs to be defined and tested.
- Do not remove Docker volumes while troubleshooting.

## Future refinement

Record the verified backup location, restore procedure, current and newly deployed commits, and post-deployment catalog counts. The production workflow already provides manual deployment and CI checks.
