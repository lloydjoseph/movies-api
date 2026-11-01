# Deployment

**Status (2026-11-01):** The owner reports the movie app is already running on the server. A Docker inventory confirmed the `movies-production` Compose project has frontend, backend, and healthy PostgreSQL containers; the frontend is bound to `127.0.0.1:8188`, and PostgreSQL uses the named volume `movies-production_postgres_data`. The root session confirmed `/etc/movies-api/production.env` is readable, but access by the runner user has not been verified. The GitHub Actions self-hosted runner has been installed and started as a service, per the owner's report. The live catalog contents/count, deployed commit, runner-user Docker access, apex certificate, public Nginx route, and backup/restore status have not been verified. Do not treat this as a first-time deployment or assume the database is empty.

## Agreed target

- The owner operates the application on their own server, located on their network.
- Docker Compose is the intended method for deploying the movie application on that server.
- The movie application's deployment Compose definition should be version-controlled in this repository; server-specific values and secrets stay outside Git.
- The server Compose inventory lists `/home/joseph/movies-api/docker-compose.production.yml` for `movies-production`. The deployment workflow checks out the selected commit in the runner workspace and targets this same Compose project name.
- The running `movies-production` PostgreSQL container uses `movies-production_postgres_data`. Preserve this volume during updates; never use `docker compose down -v` for routine deployment or troubleshooting.
- The server also reports Compose project `movies-api` as `created(1), exited(2), running(1)` with config paths `/home/joseph/movies-api/docker-compose.production.yml` and `/root/movies-api/docker-compose.yml`. Its running `mysql:8` container is labeled project `movies-api`, service `mysql`, and has loopback-only port `3306`. Its relationship to the movie catalog is unknown. An inspected dump identifies MariaDB 11.8.6, but neither establishes that MySQL as the source nor proves that the active PostgreSQL catalog needs migration. Inspect and compare the live catalogs before any import or migration. See the [data migration plan](data-migration.md).
- The movie application's public entry point will be isolated from the existing media-services Docker network.
- Production updates are manually dispatched through GitHub Actions; the workflow tests the checked-out commit and updates the `movies-production` Compose stack on the self-hosted runner.
- The target public site is `https://jlloyd.fr/movies/`; public reachability of the movie app has not been confirmed.
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
- **Router and ingress:** Bouygues Telecom router with enabled port forwarding. Reported rules include external TCP `80` → server `80`, `443` → `443`, `8080` → `8888`, and `8443` → `4443`; other rules include ports `8096` and `5055`. Their purpose, necessity, and service ownership have not been fully audited. Do not change them for this application.
- **Reverse proxies:** Debian host Nginx is a systemd service listening on host ports 80/443. Its `ask.jlloyd.fr` virtual host proxies to `127.0.0.1:5055`; `watch.jlloyd.fr` proxies to Jellyfin at `192.168.1.71:8096`. Nginx Proxy Manager is separately running in Docker as `npm`, managed by Compose project `media-stack` using `/mnt/hdd/media-stack/docker-compose.yml`; it is attached to `media-stack_default` and publishes host ports `8888`→80, `4443`→443, and `81`→81. Keep both existing proxy configurations and media services unchanged for this deployment.
- **Docker containers observed with `docker ps` on 2026-10-30:** all listed containers reported `Up 2 months`. Published ports below are host-side mappings as shown by Docker at that time.

  | Container | Image | Published ports |
  |---|---|---|
  | `npm` | `jc21/nginx-proxy-manager:latest` | `0.0.0.0` and `[::]`: host `81→81`, `8888→80`, `4443→443` |
  | `flaresolverr` | `ghcr.io/flaresolverr/flaresolverr:latest` | `0.0.0.0:8191→8191`; container port `8192/tcp` is not published |
  | `prowlarr` | `lscr.io/linuxserver/prowlarr:latest` | `0.0.0.0:9696→9696` |
  | `sonarr` | `lscr.io/linuxserver/sonarr:latest` | `0.0.0.0:8989→8989` |
  | `radarr` | `lscr.io/linuxserver/radarr:latest` | `0.0.0.0:7878→7878` |
  | `qbittorrent` | `lscr.io/linuxserver/qbittorrent:latest` | `0.0.0.0` and `[::]`: host `6881→6881` TCP/UDP, `8080→8080` TCP |
  | `jellyseerr` | `fallenbagel/jellyseerr:latest` | `0.0.0.0:5055→5055` |
  | `mysql` | `mysql:8` | `127.0.0.1:3306→3306`; container port `33060/tcp` is not published |

- **Compose projects:** `npm` has Compose labels identifying project `media-stack`, service `npm`, and config `/mnt/hdd/media-stack/docker-compose.yml`. Running `docker compose -f /mnt/hdd/media-stack/docker-compose.yml config --services` reported `flaresolverr`, `jellyseerr`, `prowlarr`, `qbittorrent`, `radarr`, and `sonarr`.
- **Docker networks:** `docker network ls` reported `bridge`, `host`, `media-stack_default`, `mediastack_default`, `movies-api_default`, and `none`. `docker inspect npm` confirmed that NPM is attached to `media-stack_default`. The similarly named `mediastack_default` is a distinct network; membership of the other containers was not established. Keep the movie deployment separate from these media networks.
- **Host listeners:** the user's `ss -ltnp` output showed listeners on `80`, `443`, `81`, `8888`, `4443`, `8080`, and `8096`. Docker publishes NPM on `81`/`8888`/`4443` and qBittorrent on `8080`; `8096` is the reported Jellyfin port. A process listing showed a host Nginx master and additional Nginx processes; do not conflate the host service with NPM's containerized Nginx. The `docker ps` snapshot did not include a container named Jellyfin.
- **Administrator access:** the `joseph` shell account reported `joseph is not in the sudoers file` when trying `sudo`. The owner also confirmed having root/admin access. Use an authorized root/admin session for system Nginx, Certbot, and `/etc` changes; do not assume `sudo` works for `joseph`.
- **HTTPS:** the host currently serves a Let's Encrypt certificate for `ask.jlloyd.fr` on the default virtual host; the certificate SAN does not include `jlloyd.fr`. Certbot's renewal timer is active, but the apex certificate and public HTTPS route are not yet configured or verified.

These are observed hardware details, not a measured minimum requirement or capacity guarantee. Machine serial numbers and network addresses are intentionally omitted.

## Current local topology

- Angular development server runs separately from the backend.
- Spring Boot API connects to PostgreSQL.
- PostgreSQL can be started with the Compose file in `backend/`; it binds only to host loopback for local development. Production Compose publishes no database or backend ports.

## Deployment state and remaining checks

- The `movies-production` stack and repository Compose path were confirmed in the server inventory on 2026-11-01. The owner reports the runner service runs. A root session confirmed the production environment file is readable; runner-user access remains unverified. The apex certificate, host-Nginx movie site, public route, current deployed commit, and production catalog contents/count remain unverified.
- DNS A records for `jlloyd.fr` and `movies.jlloyd.fr` resolve to the router's public address. This was reported as observed; public HTTPS for the apex is not yet verified.
- Preserve router forwarding and existing `ask`/`watch` virtual hosts. Add only the new `jlloyd.fr` host-Nginx virtual host after obtaining and verifying its certificate.
- The committed production Compose file binds the movie frontend gateway to `127.0.0.1:8188`; proxy to it from host Nginx. Do not attach the movie stack to `media-stack_default`, create an NPM route, or modify NPM.
- Keep backend and PostgreSQL traffic on private application networks; do not expose PostgreSQL publicly.
- Keep production secrets and server-specific configuration in protected server-side files, never in Git or chat.
- Obtain and verify a Let's Encrypt certificate for `jlloyd.fr` using the existing Certbot Nginx plugin, then enable the repository's host-Nginx site config.
- Verify public HTTPS and Certbot renewal for the apex domain.
- Confirm production catalog size and account count before and after the next update. Determine whether the separate `movies-api` MySQL container contains any catalog data not already in the production PostgreSQL database.

## Operations and recovery — Open

- Database backup schedule, retention, off-server copy, and restore procedure.
- Application update and rollback process.
- Monitoring, logs, health checks, and alerting appropriate for a personally operated service.
- Secret storage and rotation, including Google OAuth client credentials and the account allowlist.
- Availability expectations and recovery objectives.
- Source database inventory, field mapping, migration rehearsal, and cutover/rollback plan.

## Deployment procedure

See the [manual deployment guide](deployment-guide.md) for the release checklist. The production environment-file path is established; the protected backup location still needs to be selected and verified.

The active production database is the PostgreSQL service in `movies-production`. Do not plan a migration or cutover until its contents have been compared with the separate MySQL service and the local catalog; see the [data migration plan](data-migration.md).

## Production readiness gaps in the current repository

- `/etc/movies-api/production.env` exists. The root session confirmed it is readable, but verify that the runner service user can read it; do not overwrite it by copying the example template over it. Keep credentials there, outside Git, and never print or share its contents.
- The production environment file has separate database bootstrap-admin and application-role credentials. Keep both private; the backend receives only `DB_USERNAME` and `DB_PASSWORD`. PostgreSQL creates the app role from the initialization script only for a new empty volume. If a database volume already exists, provision/grant the app role through an administrator before starting the backend.
- The production PostgreSQL service is already running. A deployment may update its schema through Liquibase; back up the active database and verify the catalog before running an update.
- Configure host Nginx for `jlloyd.fr` to proxy requests to `127.0.0.1:8188`. The production Compose file binds only the frontend gateway to this loopback port; PostgreSQL and backend ports are not published. Do not change NPM or the existing media-stack networks.
- Set `APP_FRONTEND_URL=https://jlloyd.fr/movies/`, register the production Google OAuth callback, and keep `SESSION_COOKIE_SECURE=true`.
- Verify the frontend gateway's HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and Permissions Policy headers through the public HTTPS host Nginx route.
- Define the deployed commit, update/rollback procedure, and image update schedule.
- Add backups and verify restoration before relying on the catalog as the sole record of watch history.

The exact implementation choices should follow inspection of the existing server and network setup rather than assumptions about a generic cloud platform.
