# Joseph’s Movies

A private movie watch-history app for keeping a personal catalog of watched films. Sign in with Google to add, search, filter, edit, and remove movies. Each approved account has its own catalog. Movie entries include a title, release year, and optional rating from 1 to 10.

The app uses an Angular and Tailwind frontend, a Java 21 / Spring Boot API, and PostgreSQL. The production site path is <https://jlloyd.fr/movies/>; the API is under `/api/movies`.

## Run locally

You’ll need Java 21, Node.js supported by Angular 22, npm, and Docker Compose.

### 1. Configure local credentials

From the repository root, copy the backend environment template and edit it:

```bash
cp -n backend/.env.example backend/.env
```

Set `DB_PASSWORD` to the password used by your local PostgreSQL volume. For Google sign-in, set `GOOGLE_OAUTH_ENABLED=true`, add your Google OAuth client ID and secret, and include your verified Google email in `APP_ALLOWED_GOOGLE_EMAILS`. Keep `backend/.env` private; it is ignored by Git.

In Google Cloud, add this local redirect URI to the OAuth client:

```text
http://localhost:8080/login/oauth2/code/google
```

### 2. Start PostgreSQL

```bash
cd backend
docker compose up -d postgres
```

### 3. Start the backend

In a terminal from `backend/`:

```bash
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

Liquibase applies database migrations at startup. The API is available at <http://localhost:8080>.

### 4. Start the frontend

In another terminal:

```bash
cd frontend
npm ci
npm start
```

Open <http://localhost:4200>, sign in with an allowlisted Google account, and manage your catalog. The Angular development server proxies API and sign-in requests to the backend.

## Build and checks

```bash
(cd backend && ./mvnw test)
(cd frontend && npm test)
(cd frontend && npm run build)
```

The backend integration suite uses Testcontainers and requires Docker. See [development setup](docs/technical/development-setup.md) for configuration details and [deployment](docs/technical/deployment.md) for the self-hosted production setup.

## Project docs

- [Product and current requirements](docs/product/requirements.md)
- [Architecture and API contract](docs/technical/architecture.md)
- [Data migration notes](docs/technical/data-migration.md)
- [Manual deployment guide](docs/technical/deployment-guide.md)
