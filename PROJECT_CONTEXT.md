# Project context

For the fuller product and engineering notes, start with [`docs/README.md`](docs/README.md). It links to the product brief, requirements, architecture, development setup, deployment notes, and decision records.

## Purpose

This repository contains a movie application with a Spring Boot REST API and an Angular frontend.

## Structure

- `backend/`: Java 21 / Spring Boot 4.1 application. The current code is organized into controller, DTO, entity, mapper, repository, service, and security packages under `com.example.movie`.
- `frontend/`: Angular 22 single-page application, written in TypeScript. Production path is `/movies/`; movie API paths use `/api/movies`.
- `backend/docker-compose.yml`: local service configuration (inspect before changing or relying on it).

## Working conventions

- Preserve the existing architecture and naming unless the task calls for a deliberate change.
- Keep API and frontend changes aligned when a feature crosses the backend/frontend boundary.
- Do not assume behavior that is not represented in the code or documentation; inspect the relevant implementation first.
- Keep secrets and credentials out of tracked files. Use configuration/environment variables for sensitive or machine-specific values.
- Prefer focused changes and explain any assumptions when project behavior is unclear.

## Useful commands

- Backend tests: `cd backend && ./mvnw test`
- Backend run: `cd backend && ./mvnw spring-boot:run`
- Frontend dev server: `cd frontend && npm start`
- Frontend build: `cd frontend && npm run build`
- Frontend tests: `cd frontend && npm test`

Run checks relevant to the change when asked to verify it, or when verification is needed to complete the task.

## Current scope notes

- Google OIDC login/session handling and account-scoped movie CRUD are implemented. Google credentials and the verified-email allowlist are environment supplied; an empty allowlist denies access. Each allowlisted account has a separate catalog. The 345 existing local movies have release years and owner assignments; do not re-import the CSV. Liquibase has applied the local schema constraints; Hibernate validates the schema at startup. See [architecture](docs/technical/architecture.md), [data migration](docs/technical/data-migration.md), and [development setup](docs/technical/development-setup.md).
- Production ingress is planned through the existing Debian host Nginx to a frontend gateway bound to `127.0.0.1:8188`. Preserve router forwarding, Nginx Proxy Manager, Jellyfin, and media networks. Server observations, deployment status, and cutover prerequisites are documented in [deployment](docs/technical/deployment.md) and the [deployment guide](docs/technical/deployment-guide.md).
- The root README provides the app overview, local launch steps, and links to the detailed product, architecture, migration, and deployment documentation.
