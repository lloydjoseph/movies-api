# Manual deployment guide

Production deployment can be started from the GitHub Actions **Deploy production** workflow. Before dispatching, create and verify a current database backup. The workflow tests the selected commit on `main`, requires confirmation of that backup, then connects to the server over SSH and rebuilds the production Compose services.

**Status:** Release procedure for the owner's self-hosted server. The source repository is private on GitHub and the server checkout path is `/home/joseph/movies-api`. The production Compose file is `docker-compose.production.yml`; host Nginx will route the apex domain to the frontend gateway bound at `127.0.0.1:8188`. NPM, its media network, and existing Jellyfin routes stay unchanged. The production environment path is `/etc/movies-api/production.env`; choose and verify a protected database backup location before migration/cutover.

Deployments are expected only every few months. Before using the workflow, review the production Compose configuration, establish its GitHub environment secrets, prepare the server SSH access described below, and rehearse database restore.

## One-time setup needed before the first release

- Clone this repository to `/home/joseph/movies-api` on the server.
- Configure a repository-scoped read-only GitHub deploy key on the server before cloning. Keep the private key outside the repository with restrictive file permissions; add only the public key to the GitHub repository's deploy keys with read-only access. (Chosen approach; setup remains to be done.)
- Create a dedicated SSH key for GitHub Actions and authorize its public key for the deployment user on the server. In the repository's **Settings → Environments**, create an environment named `production` and add these environment secrets: `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_PRIVATE_KEY`, and `PRODUCTION_SSH_KNOWN_HOSTS`. Store a verified host-key entry in `PRODUCTION_SSH_KNOWN_HOSTS`; do not disable SSH host-key checking. The deployment user must be able to run Git and Docker Compose, and the server checkout must remain clean on branch `main`.
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

### 2. Connect and inspect the server checkout

On the server, go to the repository clone and confirm it is on the intended branch with no unexpected local changes:

```bash
cd <server-repository-path>
git status --short
git branch --show-current
git rev-parse --short HEAD
```

If there are uncommitted changes, stop and understand them before updating. Keep production environment files out of the repository checkout or ensure they are ignored and never overwritten by Git.

### 3. Back up the database

Before a release that can affect data or schema, take a PostgreSQL dump. This command is a template; replace the server environment-file path and protected backup path:

```bash
umask 077
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > <protected-backup-directory>/movies-<date-and-time>.sql
```

Check that the dump exists and is non-empty. Keep a copy outside the server if the catalog is important. A backup is useful only if it can be restored; document and periodically rehearse restoration separately.

### 4. Update the checkout

Save the currently deployed commit, then fast-forward to the reviewed release. Replace `<production-branch>` with the agreed branch name:

```bash
previous_commit=$(git rev-parse HEAD)
git fetch --tags origin
git pull --ff-only origin <production-branch>
git log --oneline "$previous_commit"..HEAD
```

Review the listed changes. If they are not the intended release, stop before applying the Compose update.

### 5. Validate configuration and deploy

From the repository root, validate the production Compose configuration. Keep rendered configuration output private because it may contain expanded values:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml config --quiet
```

Confirm that the frontend publishes only `127.0.0.1:8188->8080`; do not publish the backend or database ports.

Then build and start/update the application:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml up -d --build
```

Do not use `docker compose down -v` as a routine update command; removing volumes can delete the database. Do not expose PostgreSQL on a public host port.

### 6. Check the deployment

Use the production Compose services:

```bash
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml ps
docker compose --env-file /etc/movies-api/production.env -f docker-compose.production.yml logs --tail=100 frontend backend postgres
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

### 7. If the release fails

- Capture the relevant Compose logs and note the deployed commit before making further changes.
- If the failure is limited to application code and the database schema remains compatible, restore the previous commit and rebuild/recreate the application services.
- If the release changed database schema or data, do not assume an application rollback is safe. Follow the documented database restore/migration recovery procedure; this procedure still needs to be defined and tested.
- Do not remove Docker volumes while troubleshooting.

## Future refinement

Once the backup location and restore procedure are established, replace remaining placeholders and record a known-good deployed version. Because releases are infrequent, automated deployment is not required; CI checks can be added independently if useful.
