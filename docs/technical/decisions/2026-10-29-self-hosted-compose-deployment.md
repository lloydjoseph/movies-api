# Decision: Self-hosted Compose deployment

- Status: Accepted
- Date: 2026-10-29

## Context

The owner operates a Debian 13 home server and already runs Docker services behind Nginx Proxy Manager. The movie application should be available over the internet through the owner's domain, but updates are expected only every few months.

## Decision

- Continue with the repository's intended stack: Angular/TypeScript, Java 21/Spring Boot, and PostgreSQL.
- Host the application on the owner's server using Docker Compose. The movie app will have its own PostgreSQL container and persistent database storage.
- Keep the production Compose definition version-controlled in this repository. Server-only configuration and credentials stay outside Git.
- Isolate the movie app's public web entry point from the existing media-services Docker network by using a dedicated proxy network shared with Nginx Proxy Manager. Keep backend and database traffic on private app networks. Do not rename or repurpose the existing media network.
- Use manual deployments. Automated build/deploy workflows are not justified by the expected low release frequency.
- The private GitHub repository will be cloned to `/home/joseph/movies-api` using a repository-scoped read-only deploy key kept on the server.

## Consequences

- The Nginx Proxy Manager Compose configuration must be updated to join the dedicated proxy network, then recreated during a planned maintenance step; this may briefly interrupt proxy service.
- The public app path is now agreed as `https://jlloyd.fr/movies/`; the existing router rules and NPM host port mappings still need audit before they are changed.
- `docker-compose.production.yml` defines the frontend gateway, backend, private PostgreSQL service, and required external `movies-proxy` network. The production environment-file path, live NPM route setup, backup location, and restore procedure still need to be finalized before a production release.
- Manual release steps and database backup guidance are recorded in the [deployment guide](../deployment-guide.md).

## Alternatives considered

- Reusing `media-stack_default` was not selected because the owner wants the movie app isolated from the existing media services.
- Reusing another service's database was not selected; the app will have a dedicated PostgreSQL container.
- Scheduled or self-hosted-runner deployment automation was not selected because updates are expected only every few months.
