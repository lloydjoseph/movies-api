# Manual deployment guide

Production updates are started from the GitHub Actions **Deploy production** workflow. It checks out and tests the selected commit on `main`, creates and validates a PostgreSQL backup, then updates the existing production Compose services. The backend applies Liquibase migrations during startup, so the workflow stops if the pre-deployment backup fails.

**Current server status (2026-11-01):** Docker reports `movies-production` running frontend, backend, and healthy PostgreSQL services. The PostgreSQL data volume is `movies-production_postgres_data`; the frontend binds `127.0.0.1:8188`. The owner reports the runner is running as a service. A root session confirmed `/etc/movies-api/production.env` is readable, but access by the runner user and its Docker access have not been verified. This is an update to a live stack, not its first startup. The live catalog contents/count, deployed commit, apex certificate/public Nginx route, backup timer installation, and restore procedure still need verification. A separate `movies-api` project has a running MySQL 8 container; do not assume it is the active catalog source or migrate/import its data without comparing it to production PostgreSQL.

Before the next update, review the production Compose configuration, confirm the runner user's Docker, environment-file, and backup-directory access, inspect the current production catalog, and verify a backup restore. Keep the existing volume and Compose project name; never use `down -v`.

## One-time setup and checks before the next release

- The owner reports the repository-scoped Linux x64 self-hosted runner is installed as a service. Confirm it appears **Online** in **Settings → Actions → Runners**, uses the `self-hosted`, `linux`, and `x64` labels, and its service user can run Docker Compose and read `/etc/movies-api/production.env`. Do not reuse the registration token that appeared in chat.
- From an authorized root shell, verify both prerequisites as the service user without printing environment values:

  ```bash
  runuser -u joseph -- sh -c 'test -r /etc/movies-api/production.env && docker ps >/dev/null && docker compose version' \
    && echo "runner prerequisites are accessible"
  ```
- Install the weekly same-server backup timer from an authorized root shell. Confirm `joseph` is the runner service user and has Docker access first:

  ```bash
  install -d -o joseph -g joseph -m 0700 /var/backups/movies-api
  install -m 0644 /home/joseph/movies-api/deploy/systemd/movies-api-backup.service /etc/systemd/system/
  install -m 0644 /home/joseph/movies-api/deploy/systemd/movies-api-backup.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now movies-api-backup.timer
  ```

  Verify the backup directory is accessible to the runner:

  ```bash
  runuser -u joseph -- test -w /var/backups/movies-api \
    && echo "backup directory is writable by the runner"
  ```

  The service runs the script from `/home/joseph/movies-api` every Sunday around 03:00 and prunes weekly and pre-deployment dumps older than 30 days. Run a first backup and check its service log:

  ```bash
  runuser -u joseph -- /home/joseph/movies-api/deploy/backup-production-db.sh weekly
  journalctl -u movies-api-backup.service --no-pager -n 30
  ```

  Update the paths and service user in the unit if the server checkout or runner account differs from these reported values.
- In the repository's **Settings → Environments**, create or retain the `production` environment and configure any required deployment approval. The workflow uses the checked-out commit in the runner workspace; it does not fetch or update a separate server checkout.
- The `joseph` shell account reported that it is not in the sudoers file. The owner confirmed separate root/admin access; run the `/etc`, Nginx, and Certbot setup commands from that authorized administrative session.
- The server already has host Nginx on public ports 80/443. Keep it and its `ask.jlloyd.fr` and `watch.jlloyd.fr` virtual hosts unchanged; do not alter router forwards or NPM.
- DNS for `jlloyd.fr` points to the server's router address. Obtain a separate Let's Encrypt certificate for the apex; the existing certificates cover only `ask.jlloyd.fr` and `watch.jlloyd.fr`.
- Install the temporary ACME config from `deploy/nginx-movies-acme.conf` under `/etc/nginx/sites-available/movies-api`, enable it if not already enabled with `test -e /etc/nginx/sites-enabled/movies-api || ln -s /etc/nginx/sites-available/movies-api /etc/nginx/sites-enabled/movies-api`, validate with `/usr/sbin/nginx -t`, reload host Nginx, then run `certbot certonly --nginx -d jlloyd.fr`.
- After the certificate exists, install the final `deploy/nginx-movies.conf` at `/etc/nginx/sites-available/movies-api`, validate and reload Nginx. The final host config proxies to the Compose frontend gateway on loopback port 8188.
- `/etc/movies-api/production.env` already exists. The root session confirmed it is readable, but confirm runner-user access without printing its contents. Do not overwrite it with the example template; never put actual secrets in Git or command history.
- `TMDB_ACCESS_TOKEN` is optional and enables movie title/year suggestions. If configured, keep it only in the protected production environment file; manual entry remains available without it.
- Keep `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` for PostgreSQL initialization only; the Spring Boot service must receive only the application role in `DB_USERNAME` and `DB_PASSWORD`. The init script is applied only to an empty PostgreSQL volume.
- The backup script writes compressed PostgreSQL custom-format dumps to `/var/backups/movies-api`, with private directory/file permissions and 30-day retention. Backups remain on this server and do not protect against loss of the server or its disks.
- The GitHub Actions deployment workflow takes a `pre-deploy` dump before updating the stack. The weekly systemd timer must be installed and its runner-user Docker and directory access verified.
- Rehearse restoring a dump to a separate test database before relying on the backups.
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

### 2. Inspect the active production database

The active target is the PostgreSQL service in the existing `movies-production` project—not automatically the separate MySQL 8 container. First record the catalog row count and account count without printing movie data. The deployment workflow creates a timestamped, compressed PostgreSQL dump and verifies that PostgreSQL can read its archive before it starts the new stack. For a manual backup, use the same script:

```bash
runuser -u joseph -- /home/joseph/movies-api/deploy/backup-production-db.sh pre-deploy
```

Do not put dumps in the checkout or the PostgreSQL volume. Verify restoration to a separate test database before relying on the backups.

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

Record the verified backup location, tested restore procedure, current and newly deployed commits, and post-deployment catalog counts. The production workflow already provides manual deployment and CI checks.
