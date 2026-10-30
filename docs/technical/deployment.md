# Deployment

**Status:** Target hosting model and public app path are agreed. A production Compose stack, container build files, private app networks, and an Nginx frontend gateway are in the repository. The server's existing host Nginx will route the movie application; NPM and its media stack remain untouched. Production secrets, the apex certificate, data migration, and live verification remain to be completed.

## Agreed target

- The owner operates the application on their own server, located on their network.
- Docker Compose is the intended method for deploying the movie application on that server.
- The movie application's deployment Compose definition should be version-controlled in this repository; server-specific values and secrets stay outside Git.
- The repository has not yet been cloned to the server. Its planned checkout path is `/home/joseph/movies-api`.
- The source repository is hosted on GitHub and is private; the server needs a credential to clone and pull it. The chosen method is a repository-scoped read-only deploy key kept on the server, outside the repository. It has not yet been configured.
- The movie application will have its own PostgreSQL container, managed with its app deployment rather than reusing another service's database.
- The existing movie database must be migrated into the new PostgreSQL database before cutover. The source engine, schema, location, and data volume are not yet recorded.
- The movie application's public entry point will be isolated from the existing media-services Docker network.
- Deployments will be performed manually because updates are expected only every few months. Automated build/deploy workflows are not currently planned.
- The application is reachable over the internet using the owner's domain name.
- The public site path is `https://jlloyd.fr/movies/`. Router ports 80/443 reach the Debian host's Nginx service, which will proxy requests for `jlloyd.fr` to the frontend gateway at `127.0.0.1:8188`. The gateway serves Angular and proxies `/api/`, `/oauth2/`, and `/login/` to Spring Boot on the private app network, preserving same-origin session cookies and CSRF. Nginx Proxy Manager remains on its current `8888`/`4443` host ports for the existing services; its Compose project and the Jellyfin routes are not changed.
- Set backend `APP_FRONTEND_URL=https://jlloyd.fr/movies/` and register `https://jlloyd.fr/login/oauth2/code/google` as the Google OAuth callback.
- The application must work in a browser on phones, tablets, and desktop computers.
- Intended application stack: Angular frontend, Spring Boot backend, and PostgreSQL database.
- Since the application and personal movie data are internet-accessible, production access must be served over HTTPS. Host Nginx with Certbot is the TLS terminator for `jlloyd.fr`. DNS currently resolves the apex to the server's router address, and Certbot's Nginx plugin and renewal timer are installed. Existing certificates cover only `ask.jlloyd.fr` and `watch.jlloyd.fr`; a certificate for `jlloyd.fr` must be obtained before enabling the final virtual host.

## Owner's server

Reported configuration (from `inxi -Fxz`):

- **System:** Dell OptiPlex 3060 desktop.
- **Operating system:** Debian GNU/Linux 13 (trixie), x86_64; Linux kernel 6.12.85+deb13-amd64.
- **CPU:** Intel Core i5-8500T, 6 cores.
- **Memory:** 32 GiB RAM.
- **Storage:** 256 GB NVMe SSD and 1 TB HDD; `inxi` reports approximately 1.14 TiB total and 619.5 GiB used at capture time.
- **Network:** wired Realtek Gigabit Ethernet interface is connected at 1 Gbit/s; Wi-Fi is also present.
- **Router and ingress:** Bouygues Telecom router with enabled port forwarding. The owner provided a current list of rules, including external TCP `80` → server `80`, `443` → `443`, `8080` → `8888`, and `8443` → `4443`; other rules include ports `8096` and `5055`. These are observations only: their current purpose, necessity, and service ownership have not been audited. Do not treat this list as the required configuration for this application.
- **Reverse proxies:** Debian host Nginx is a systemd service listening on host ports 80/443. It currently has separate virtual hosts for `ask.jlloyd.fr` (port 5055) and `watch.jlloyd.fr` (Jellyfin on port 8096). Nginx Proxy Manager is separately running in Docker as `npm`, managed by Compose project `media-stack` using `/mnt/hdd/media-stack/docker-compose.yml`; it is attached to `media-stack_default` and publishes host ports `8888`→80, `4443`→443, and `81`→81. Keep both existing proxy configurations and media services unchanged for this deployment.
- **Docker networks:** `docker inspect` shows NPM and Jellyseerr attached to `media-stack_default`. The host also has networks named `mediastack_default` and `movies-api_default`; membership of the remaining services and intended application network are not yet confirmed. No movie application container has been confirmed on NPM's network.
- **Other Docker services:** the host also runs FlareSolverr, Prowlarr, Sonarr, Radarr, qBittorrent, Jellyseerr, and MySQL. The movie application will share a host with existing workloads.
- **HTTPS:** the host currently serves a Let's Encrypt certificate for `ask.jlloyd.fr` on the default virtual host; the certificate SAN does not include `jlloyd.fr`. Certbot's renewal timer is active, but the apex certificate and public HTTPS route are not yet configured or verified.

These are observed hardware details, not a measured minimum requirement or capacity guarantee. Machine serial numbers and network addresses are intentionally omitted.

## Current local topology

- Angular development server runs separately from the backend.
- Spring Boot API connects to PostgreSQL.
- PostgreSQL can be started with the Compose file in `backend/`; it binds only to host loopback for local development. Production Compose publishes no database or backend ports.

## Server and network details to capture

- Production Compose deployment on the host remains to be done.
- DNS A records for `jlloyd.fr` and `movies.jlloyd.fr` resolve to the server's current router WAN address.
- Router forwards external 80/443 to the Debian host's 80/443; external 8080/8443 reach NPM's published ports 8888/4443. Do not alter these rules for this deployment.
- Host Nginx is the public service on 80/443 and already hosts separate `ask` and `watch` virtual hosts. Add only a new `jlloyd.fr` virtual host after obtaining its certificate.
- Bind the movie frontend gateway to `127.0.0.1:8188`; proxy to it from host Nginx. Do not attach the movie stack to `media-stack_default` or modify NPM.
- Keep backend and PostgreSQL traffic on private application networks; do not expose PostgreSQL publicly.
- Use the repository's `docker-compose.production.yml` for the frontend gateway, backend, and dedicated database. It binds the gateway to host loopback `127.0.0.1:8188`; do not create a proxy network or attach NPM.
- Keep production secrets and server-specific configuration in protected server-side environment/secrets files; commit only safe placeholders/documentation, never credential values.
- Obtain and verify a Let's Encrypt certificate for `jlloyd.fr` using the existing Certbot Nginx plugin, then enable the repository's host-Nginx site config.
- Verify public HTTPS and Certbot renewal for the apex domain.
- Whether frontend, API, and database run on the same host; database must remain private to the application/network.
- Expected catalog size, number of accounts, and expected usage.

## Operations and recovery — Open

- Database backup schedule, retention, off-server copy, and restore procedure.
- Application update and rollback process.
- Monitoring, logs, health checks, and alerting appropriate for a personally operated service.
- Secret storage and rotation, including Google OAuth client credentials and the account allowlist.
- Availability expectations and recovery objectives.
- Source database inventory, field mapping, migration rehearsal, and cutover/rollback plan.

## Deployment procedure

See the [manual deployment guide](deployment-guide.md) for the release checklist. Server-side environment-file and backup paths remain placeholders until they are established on the host.

The existing database must be migrated before cutover; see the [data migration plan](data-migration.md).

## Production readiness gaps in the current repository

- Copy [production.env.example](../../production.env.example) to a protected server-side environment file outside the checkout. Supply database and OAuth credentials there; never use the local Compose stack as production.
- The production environment file has separate database bootstrap-admin and application-role credentials. Keep both private; the backend receives only `DB_USERNAME` and `DB_PASSWORD`. PostgreSQL creates the app role from the initialization script only for a new empty volume. If a database volume already exists, provision/grant the app role through an administrator before starting the backend.
- Apply and verify Liquibase against the production database before cutover. Hibernate validates the resulting schema at startup.
- Configure host Nginx for `jlloyd.fr` to proxy requests to `127.0.0.1:8188`. The production Compose file binds only the frontend gateway to this loopback port; PostgreSQL and backend ports are not published. Do not change NPM or the existing media-stack networks.
- Set `APP_FRONTEND_URL=https://jlloyd.fr/movies/`, register the production Google OAuth callback, and keep `SESSION_COOKIE_SECURE=true`.
- Verify the frontend gateway's HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and Permissions Policy headers through the public HTTPS host Nginx route.
- Define the deployed commit, update/rollback procedure, and image update schedule.
- Add backups and verify restoration before relying on the catalog as the sole record of watch history.

The exact implementation choices should follow inspection of the existing server and network setup rather than assumptions about a generic cloud platform.
