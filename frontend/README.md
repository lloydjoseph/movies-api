# Joseph’s Movies frontend

Angular 22 single-page application for the account-scoped movie collection.

## Run locally

Copy `backend/.env.example` to the ignored `backend/.env`, set `DB_PASSWORD` to the existing local PostgreSQL volume password, and add your Google OAuth values. Start PostgreSQL and the backend with `SPRING_PROFILES_ACTIVE=local`. The backend needs `SESSION_COOKIE_SECURE=false` for local HTTP and `APP_FRONTEND_URL=http://localhost:4200` (the default). Register `http://localhost:8080/login/oauth2/code/google` as the Google OAuth callback.

Then run:

```bash
npm install
npm start
```

Open <http://localhost:4200>. The Angular development proxy forwards `/api`, `/oauth2`, and `/login` to the backend on port 8080. OAuth uses the backend callback and returns to the frontend collection after sign-in.

## Build

```bash
npm run build
```

The production build uses `/movies/` as its base path for `https://jlloyd.fr/movies/`. Configure `APP_FRONTEND_URL=https://jlloyd.fr/movies/` on the backend. Nginx Proxy Manager routes `/movies` (with or without the trailing slash), `/api/`, `/oauth2/`, and `/login/` to the frontend gateway; that gateway serves the app and proxies API/OAuth requests privately to Spring Boot on the same origin. The production gateway supplies security response headers and fixed forwarded host/protocol values. Production deployment still requires the `movies-proxy` network, NPM routes, protected environment file, production OAuth callback, and verified database backup/restore on the server.

Theme overrides are stored in this browser's local storage. The current backend does not synchronize theme preferences across devices.
