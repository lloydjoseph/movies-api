# Manual deployment guide

**Status:** Release procedure template for the owner's self-hosted server. The source repository is private on GitHub and the server checkout path is `/home/joseph/movies-api`; the production Compose file is `docker-compose.production.yml`, the external proxy network is `movies-proxy`, and the server-side environment-file path and backup location still need to be finalized. Replace angle-bracket placeholders with actual values before using the commands.

Deployments are manual and expected only every few months. Before first use, review the production Compose configuration, establish the server-side environment file and backup location, and rehearse database restore.

## One-time setup needed before the first release

- Clone this repository to `/home/joseph/movies-api` on the server.
- Configure a repository-scoped read-only GitHub deploy key on the server before cloning. Keep the private key outside the repository with restrictive file permissions; add only the public key to the GitHub repository's deploy keys with read-only access. (Chosen approach; setup remains to be done.)
- Create the external `movies-proxy` Docker network and attach Nginx Proxy Manager to it.
- Keep `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` for PostgreSQL initialization only; the Spring Boot service must receive only the application role in `DB_USERNAME` and `DB_PASSWORD`. The init script is applied only to an empty PostgreSQL volume.
- Keep server-only configuration and credentials in a protected environment/secrets file outside Git. Ensure it is ignored by Git and readable only by the deployment operator.
- Configure NPM locations for `/movies` (including the slashless path), `/api/`, `/oauth2/`, and `/login/` to `frontend:8080`, preserving host `jlloyd.fr`.
- Choose a protected backup location and document how to restore a PostgreSQL backup.
- Complete and rehearse the [data migration plan](data-migration.md) before treating the new PostgreSQL database as authoritative.
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
docker compose --env-file <server-env-file> -f docker-compose.production.yml \
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
docker compose --env-file <server-env-file> -f docker-compose.production.yml config --quiet
```

Then build and start/update the application:

```bash
docker compose --env-file <server-env-file> -f docker-compose.production.yml up -d --build
```

Do not use `docker compose down -v` as a routine update command; removing volumes can delete the database. Do not expose PostgreSQL on a public host port.

### 6. Check the deployment

Use the production Compose services:

```bash
docker compose --env-file <server-env-file> -f docker-compose.production.yml ps
docker compose --env-file <server-env-file> -f docker-compose.production.yml logs --tail=100 frontend backend postgres
```

Then check the application through its public domain:

- The domain opens with a valid HTTPS certificate and no browser certificate warning.
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

Once the server-side environment path, backup storage, NPM routes, and restore procedure exist, replace the remaining placeholders with exact values and record a known-good deployed version. Because releases are infrequent, automated deployment is not required; CI checks can be added independently if useful.
