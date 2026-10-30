# Development setup

## Required tools

Versions below are taken from repository configuration where available. Install compatible versions if using a different environment.

## Developer workstation

- **Host OS:** Windows 10 desktop.
- **Linux development environment:** Ubuntu under WSL 2.
- **Project/IDE workflow:** IntelliJ runs on Windows and opens the project from the Ubuntu WSL filesystem; development commands and toolchains are run in Ubuntu WSL. The working checkout in this workspace is `/home/lloyd/movies-api`.
- **Container runtime:** Ubuntu WSL 2 uses a Docker Engine that reports `Ubuntu 24.04.3 LTS` (`docker context show` reports `default`). `docker ps` succeeded and showed no containers at the time checked. A Docker Desktop WSL distribution is also installed, but it is not the engine currently used by the Ubuntu CLI.
- **IDE:** IntelliJ IDEA Ultimate 2026.1.4, build `IU-261.26222.65`, running on Windows 10 with JetBrains Runtime `25.0.3`.
- **Codex IDE plugin:** `com.intellij.ml.llm`, Codex version `0.137.0`, ACP server `0.0.46` (reported by the owner on 2026-10-29).
- IntelliJ's JetBrains Runtime runs the IDE; project builds currently use OpenJDK 21 from Ubuntu WSL.
- The production host is a separate Debian 13 OptiPlex server; see [deployment](deployment.md). Do not assume the development workstation has the server's hardware or operating system.
- **Observed versions in Ubuntu WSL:** OpenJDK `21.0.12`, Node.js `26.13.0`, npm `11.20.0`, and Docker Compose `v5.4.0` (reported by the owner on 2026-10-29).

| Tool | Version / source | Use |
|---|---|---|
| Java JDK | Project requires 21; development environment has OpenJDK `21.0.12`. Java 21 is an LTS release; Java 25 is the newer LTS release as of 2026-10-29. | Run and build the backend. Staying on 21 keeps the current build target and environment aligned. |
| Maven | Wrapper included (`backend/mvnw`) | Build and test backend; wrapper downloads the configured Maven distribution if needed. |
| Node.js | Angular 22 compatibility range: `^22.22.3`, `^24.15.0`, or `^26.0.0` (checked 2026-10-29). Development environment has `26.13.0`. | Run Angular CLI and frontend scripts. |
| npm | Project and development environment use npm `11.20.0`. | Install frontend dependencies. |
| TypeScript | `~6.0.2` in `frontend/package.json`; Angular 22 supports `>=6.0.0 <6.1.0`. | Compile the frontend. |
| RxJS | `~7.8.0` in `frontend/package.json`; within Angular 22's supported `^7.4.0` range. | Frontend reactive utilities. |
| PostgreSQL | 17 container image in Compose | Local backend database. |
| Docker Compose | `v5.4.0` in Ubuntu WSL 2; deployment server has `docker compose` available, exact version not recorded. | Run the local database during development and the deployment stack on the server. |

The development OS context is Windows 10 with Ubuntu on WSL 2; workstation hardware is **not documented yet**. IntelliJ runs on Windows and opens the WSL checkout; build tools and Docker Engine run in Ubuntu WSL. The Docker Desktop engine is not currently used by the Ubuntu CLI. Since Docker and Compose already work, keep using this engine unless there is a specific reason to migrate; avoid running two Docker engines against the same development workflow. The observed Java, Node, and npm versions meet the configured project requirements. Node.js `26.13.0` is an LTS release and is supported by Angular 22. Java 21 is also LTS; Java 25 is newer, but changing the project's Java target is not needed just to use an LTS release.

## Start local database

Copy `backend/.env.example` to `backend/.env` and set `DB_PASSWORD` to the password already configured in the local Postgres volume. A new volume can use a locally generated value. `.env` is ignored by Git and used by both Compose and the Spring `local` profile.

From the repository root:

```bash
cd backend
docker compose up -d postgres
```

The Compose service publishes PostgreSQL on `localhost:5432`; its database password comes from the ignored `backend/.env`.

## Run the backend

```bash
cd backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

The base configuration requires `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`; the local profile imports them from the ignored `backend/.env`. The local database password must match the existing Postgres volume.

Liquibase applies versioned schema changes at backend startup. Hibernate validates the resulting schema and does not update it automatically.

Google sign-in uses these environment variables. Set them in a local, unshared IntelliJ run configuration or the WSL process environment; never commit the client secret:

| Variable | Purpose |
|---|---|
| `DB_URL` | Database JDBC URL; required outside the local profile. |
| `DB_USERNAME` | Database username; required outside the local profile. |
| `DB_PASSWORD` | Database password; required in all profiles and must remain in the ignored `.env` or a protected server-side secret. |
| `GOOGLE_OAUTH_ENABLED` | Set to `true` to enable Google sign-in. |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth web client ID from Google Cloud. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth client secret; keep private. |
| `APP_ALLOWED_GOOGLE_EMAILS` | Comma-separated verified Google email addresses authorized to sign in. Each account has a separate catalog. |
| `SESSION_COOKIE_SECURE` | Defaults to `true`; set to `false` only for local HTTP. |
| `APP_FRONTEND_URL` | Post-login destination; defaults to `http://localhost:4200` for local Angular development. Production value: `https://jlloyd.fr/movies/`. |

The app defaults to OAuth disabled and an empty allowlist. In that state, protected movie endpoints deny access. Keep the Google credentials and allowlist in `backend/.env` locally or in a protected server-side environment file for production. The production Compose stack uses separate `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD` and `DB_USERNAME`/`DB_PASSWORD` credentials; only the latter are passed to Spring Boot.

The local callback URI is `http://localhost:8080/login/oauth2/code/google`. For deployment at `jlloyd.fr`, register `https://jlloyd.fr/login/oauth2/code/google` as an additional Google OAuth callback and route `/login/` to the backend. Production must use `SPRING_PROFILES_ACTIVE=production`, a protected secret file, and a private backend network reachable only through the trusted reverse proxy. The production profile enables forwarded-header support for HTTPS OAuth URLs.

## Run the frontend

```bash
cd frontend
npm install
npm start
```

Angular CLI serves the app locally, normally at `http://localhost:4200`. Its development proxy forwards authentication and API requests to the backend at `http://localhost:8080`; start the backend with Google OAuth configured to use the same local callback URI documented above.

## Checks

```bash
cd backend && ./mvnw test
cd frontend && npm test
cd frontend && npm run build
```

Run the commands from their module directories if shell command chaining is unavailable. The backend suite covers allowlist behavior, Liquibase schema setup, movie API behavior, validation, account isolation, authentication, and CSRF. The frontend has a component test for loading the signed-in movie collection.

The backend test suite uses Testcontainers to start a disposable PostgreSQL 17 database. Docker must be available; the suite does not connect to or modify the developer's `movie` database. `npm run build` compiles the Angular app.

## Environment configuration gaps

- Pin/document supported Node.js version (for example, with `.nvmrc` or `package.json` `engines`).
- Record whether IntelliJ uses WSL toolchains for Java and Node if useful for onboarding; the versions reported so far were checked in Ubuntu WSL.
- Keep local credentials in the ignored environment file described above; do not move them back into tracked application properties.
- Record numeric developer hardware requirements only after measuring or defining the intended supported setup.
- The local Compose file is under `backend/`. `docker-compose.production.yml` defines the production stack, binds its frontend gateway to host loopback `127.0.0.1:8188` for the existing host Nginx, and uses a protected environment file.

Angular compatibility reference: [Angular version compatibility](https://angular.dev/reference/versions). Recheck this table when upgrading Angular or changing the Node.js version.

LTS references: [Node.js release schedule](https://nodejs.org/en/about/previous-releases) and [Java SE support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html). Recheck these when planning runtime upgrades.
