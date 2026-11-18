# Project context

For the fuller product and engineering notes, start with [`docs/README.md`](docs/README.md). It links to the product brief, requirements, architecture, development setup, deployment notes, and decision records.

## Purpose

This repository contains a movie application with a Spring Boot REST API and an Angular frontend.

## Structure

- `backend/`: Java 21 / Spring Boot 4.1 application. The current code is organized into controller, DTO, entity, mapper, repository, service, and security packages under `com.example.movie`.
- `frontend/`: Angular 22 single-page application, written in TypeScript. Standalone collection and watchlist features live under `src/app/collection/` and `src/app/watchlist/`; the app shell owns sign-in, navigation, and movie-editor coordination. Production path is `/movies/`; movie API paths use `/api/movies`.
- `backend/docker-compose.yml`: local service configuration (inspect before changing or relying on it).

## Working conventions

- Preserve the existing architecture and naming unless the task calls for a deliberate change.
- Keep API and frontend changes aligned when a feature crosses the backend/frontend boundary.
- Do not assume behavior that is not represented in the code or documentation; inspect the relevant implementation first.
- Keep secrets and credentials out of tracked files. Use configuration/environment variables for sensitive or machine-specific values.
- Prefer focused changes and explain any assumptions when project behavior is unclear.

## Useful commands

- Local development stack: `./dev.sh` (checks/starts PostgreSQL, then runs backend and frontend)
- Backend tests: `cd backend && ./mvnw test`
- Backend run: `cd backend && ./mvnw spring-boot:run`
- Frontend dev server: `cd frontend && npm start`
- Frontend build: `cd frontend && npm run build`
- Frontend tests: `cd frontend && npm test`

Run checks relevant to the change when asked to verify it, or when verification is needed to complete the task.

## Current scope notes

- Google OIDC login/session handling and account-scoped movie CRUD are implemented. Google credentials and the verified-email allowlist are environment supplied; an empty allowlist denies access. Each allowlisted account has a separate catalog. The 345 existing local movies have release years and owner assignments; do not re-import the CSV. Liquibase has applied the local schema constraints; Hibernate validates the schema at startup. See [architecture](docs/technical/architecture.md), [data migration](docs/technical/data-migration.md), and [development setup](docs/technical/development-setup.md).
- Each account also has a separate watchlist with titles, optional notes, and Low/Medium/High priority, available beside the existing Movies page; marking a title as seen transfers it to the movie catalog after the user completes the movie form. The collection feature owns catalog loading, search, filters, sorting, pagination, CSV export, and undoable deletion; the app shell persists view preferences per account in the current browser tab.
- The owner reports the production app is running on the server. A 2026-11-01 Docker inventory confirmed the `movies-production` frontend/backend/PostgreSQL stack, with PostgreSQL volume `movies-production_postgres_data` and frontend bound to `127.0.0.1:8188`; a separate `movies-api` MySQL 8 container also runs. The repository defines weekly same-server PostgreSQL dumps retained for 30 days and a pre-deployment dump, but the systemd timer and restore procedure still need server verification. The runner service is reported installed; its `joseph` user's Docker and production-env access remain unverified. Production catalog contents and public host-Nginx/HTTPS routing also remain unverified. Preserve router forwarding, Nginx Proxy Manager, Jellyfin, media networks, and the production database volume. See [deployment](docs/technical/deployment.md), [deployment guide](docs/technical/deployment-guide.md), and [data migration](docs/technical/data-migration.md).
- The root README provides the app overview, local launch steps, and links to the detailed product, architecture, migration, and deployment documentation.
