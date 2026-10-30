# Decision: Self-hosted Compose deployment

- Status: Superseded for ingress routing; remaining deployment decisions are still accepted
- Date: 2026-10-29

## Context

The owner operates a Debian 13 home server and already runs Docker services behind Nginx Proxy Manager. The movie application should be available over the internet through the owner's domain, but updates are expected only every few months.

## Decision

- Continue with the repository's intended stack: Angular/TypeScript, Java 21/Spring Boot, and PostgreSQL.
- Host the application on the owner's server using Docker Compose. The movie app will have its own PostgreSQL container and persistent database storage.
- Keep the production Compose definition version-controlled in this repository. Server-only configuration and credentials stay outside Git.
- Isolate the movie app from the existing media-services Docker network. The ingress routing choice in this decision was superseded after inspecting the server; see [host Nginx ingress](2026-10-30-host-nginx-movie-ingress.md).
- Use manual deployments. Automated build/deploy workflows are not justified by the expected low release frequency.
- The private GitHub repository will be cloned to `/home/joseph/movies-api` using a repository-scoped read-only deploy key kept on the server.

## Consequences

- The public app path is `https://jlloyd.fr/movies/`. Host Nginx serves the domain; do not change existing router rules or NPM configuration.
- `docker-compose.production.yml` defines the frontend gateway, backend, and private PostgreSQL service. The production environment file, backup location, data migration, and restore procedure must be completed before production cutover.
- Manual release steps and database backup guidance are recorded in the [deployment guide](../deployment-guide.md).

## Alternatives considered

- Reusing `media-stack_default` was not selected because the owner wants the movie app isolated from the existing media services.
- Reusing another service's database was not selected; the app will have a dedicated PostgreSQL container.
- Scheduled or self-hosted-runner deployment automation was not selected because updates are expected only every few months.
