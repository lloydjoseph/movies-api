# Manual deployment guide

Production deployment can be started from the GitHub Actions **Deploy production** workflow. Before dispatching, create and verify a current database backup. The workflow checks out and tests the selected commit on `main`, requires confirmation of that backup, then uses a self-hosted runner on the server to rebuild the production Compose services.

**Status:** Release procedure for the owner's self-hosted server. The source repository is private on GitHub. The production Compose file is `docker-compose.production.yml`, using the `movies-production` project; host Nginx routes the apex domain to the frontend gateway bound at `127.0.0.1:8188`. NPM, its media network, and existing Jellyfin routes stay unchanged. The production environment path is `/etc/movies-api/production.env`; choose and verify a protected database backup location before migration/cutover.

Deployments are expected only every few months. Before using the workflow, review the production Compose configuration, register and secure the self-hosted runner described below, and rehearse database restore.

## One-time setup needed before the first release

- In the repository's **Settings → Actions → Runners**, add a Linux x64 self-hosted runner and follow GitHub's displayed setup instructions directly on the server. Keep the temporary registration token on the server. Install the runner as a service for the deployment user (not root), restrict it to this private repository, and ensure the user can access Docker and `/etc/movies-api/production.env`. Use the default `self-hosted`, `linux`, and `x64` labels expected by the workflow.
- In the repository's **Settings → Environments**, create or retain the `production` environment and configure any required deployment approval. The workflow uses the checked-out commit in the runner workspace; it does not fetch or update a separate server checkout.
- The `joseph` shell account reported that it is not in the sudoers file. The owner confirmed separate root/admin access; run the `/etc`, Nginx, and Certbot setup commands from that authorized administrative session.
- The server already has host Nginx on public ports 80/443. Keep it and its `ask.jlloyd.fr` and `watch.jlloyd.fr` virtual hosts unchanged; do not alter router forwards or NPM.
- DNS for `jlloyd.fr` points to the server's router address. Obtain a separate Let's Encrypt certificate for the apex; the existing certificates cover only `ask.jlloyd.fr` and `watch.jlloyd.fr`.
- Install the temporary ACME config from `deploy/nginx-movies-acme.conf` under `/etc/nginx/sites-available/movies-api`, enable it if not already enabled with `test -e /etc/nginx/sites-enabled/movies-api || ln -s /etc/nginx/sites-available/movies-api /etc/nginx/sites-enabled/movies-api`, validate with `/usr/sbin/nginx -t`, reload host Nginx, then run `certbot certonly --nginx -d jlloyd.fr`.
- After the certificate exists, install the final `deploy/nginx-movies.conf` at `/etc/nginx/sites-available/movies-api`, validate and reload Nginx. The final host config proxies to the Compose frontend gateway on loopback port 8188.
- Copy `production.env.example` to `/etc/movies-api/production.env`, restrict permissions, and edit it with a protected editor. Never put actual secrets in Git or command history.
- Keep `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` for PostgreSQL initialization only; the Spring Boot service must receive only the application role in `DB_USERNAME` and `DB_PASSWORD`. The init script is applied only to an empty PostgreSQL volume.
- Choose a protected backup location and document how to restore a PostgreSQL backup.
- Resolve the source of the existing 345-movie catalog and complete/rehearse the [data migration plan](data-migration.md) before treating the production database as authoritative. Do not start using a new empty catalog as the replacement.
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

### 2. Back up the database

Before a release that can affect data or schema, take a PostgreSQL dump. This command is a template; replace the server environment-file path and protected backup path:

```bash
umask 077
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > <protected-backup-directory>/movies-<date-and-time>.sql
```

Check that the dump exists and is non-empty. Keep a copy outside the server if the catalog is important. A backup is useful only if it can be restored; document and periodically rehearse restoration separately.

### 3. Validate configuration and deploy

From the repository root, validate the production Compose configuration. Keep rendered configuration output private because it may contain expanded values:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production config --quiet
```

Confirm that the frontend publishes only `127.0.0.1:8188->8080`; do not publish the backend or database ports.

Then build and start/update the application:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml -p movies-production up -d --build
```

Do not use `docker compose down -v` as a routine update command; removing volumes can delete the database. Do not expose PostgreSQL on a public host port.

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

Once the backup location and restore procedure are established, replace remaining placeholders and record a known-good deployed version. Because releases are infrequent, automated deployment is not required; CI checks can be added independently if useful.
