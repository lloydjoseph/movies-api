# Technical architecture

**Status:** Intended technology stack is agreed. Google OIDC authentication, account-scoped movie CRUD, and the Angular movie interface are implemented locally. The 345-row local catalog has been backfilled with release years and owner assignments. Liquibase migrations have been applied to the local database and Hibernate validates the schema at startup. Production hosting and internet deployment remain to be configured.

## Intended stack

- **Frontend:** Angular and TypeScript, delivered as a responsive web application for phone, tablet, and desktop browsers.
- **Backend:** Java 21 with Spring Boot, exposing an HTTP API consumed by the frontend.
- **Database:** PostgreSQL, accessed through Spring Data JPA.
- **Hosting:** The owner's own server on their network, reachable over the internet through the owner's domain.
- **Deployment method:** Docker Compose defined in this repository and run on the owner's server, with a dedicated PostgreSQL container for the movie application. Server-specific configuration and secrets remain outside Git. The movie app will not reuse another service's database.

The repository currently uses Angular 22, TypeScript 6, Spring Boot 4.1.0, Java 21, and a PostgreSQL 17 local container. Revisit versions deliberately when upgrading; the stack choice does not imply that all desired product features are already implemented.

## Authentication boundary (baseline implemented)

- Google sign-in is handled by Spring Security OpenID Connect using the authorization-code flow. The browser uses an HTTP session cookie; OAuth client credentials stay on the backend.
- After successful login, the backend redirects to `APP_FRONTEND_URL` (defaults to `http://localhost:4200` for local Angular development); production destination is `https://jlloyd.fr/movies/`.
- The backend accepts only Google identities with a verified email that matches the server-configured allowlist. An empty allowlist denies every account.
- Every movie read and write path is scoped to the authenticated account. The allowlist may contain multiple verified accounts, each with a separate catalog.
- CSRF protection remains enabled for state-changing requests. Session cookies are HttpOnly and SameSite=Lax; `SESSION_COOKIE_SECURE` defaults to true and may be set false only for local HTTP development.
- OAuth login is disabled unless `GOOGLE_OAUTH_ENABLED=true` and both OAuth credentials are supplied. The application remains inaccessible without a valid authenticated session.

## Intended logical system

```text
Phone / tablet / desktop browser
       │ HTTPS
       ▼
Nginx Proxy Manager ──> Nginx frontend gateway ──> Angular app
                                      │ /api, /oauth2, /login
                                      ▼ private network
                                  Spring Boot API ──> PostgreSQL
                                      ├─ Google identity verification
                                      └─ account-scoped authorization
```

The owner already uses Nginx Proxy Manager in Docker as a reverse proxy; it shares `media-stack_default` with Jellyseerr. The movie application is isolated from that media network by the production Compose design: only its Nginx gateway joins the dedicated external `movies-proxy` network, while the backend and PostgreSQL remain on private application networks. NPM must join the dedicated network during a planned maintenance step. Production uses same-origin paths and HTTPS.

## Product data model (target)

- **Account:** is keyed by Google's stable `sub` claim, stores the current email and display name, is matched against a server-side configured allowlist, and will store the account's light/dark theme override.
- **Movie:** belongs to one account and is visible only in that account's catalog. The product requires a title, release year, optional rating integer from 1 to 10, and account ownership. Liquibase and the JPA mapping enforce required title, year, and ownership fields.
- Movie list/search/filter/create/update/delete operations are scoped to the authenticated account. Future allowlisted accounts receive separate catalogs, not shared access.
- Current JPA entities include Account and Movie ownership/release-year fields. Movie CRUD is implemented; theme preference persistence and production deployment of the schema migration remain outstanding.

## Backend (current implementation)

- Entry point: `com.example.movie.MovieApplication`.
- Spring Boot 4.1.0 and Java 21.
- `MovieController` exposes account-scoped list, search, create, update, and delete operations.
- Movie operations require an authenticated OIDC user and resolve the persisted account by Google `sub`; repository queries include that account ID.
- `GET /api/auth/me` returns the current user's email and name; `GET /api/auth/csrf` supplies the CSRF token; logout is a CSRF-protected `POST /api/auth/logout`.
- `MovieService` and `MovieServiceImpl` implement account-scoped paginated catalog operations.
- `MovieRepository` extends `JpaRepository<Movie, Integer>` and provides account-scoped title and rating filters.
- `MovieMapper` maps the JPA entity to `MovieDto` and trims movie names at write time.
- Optional title search accepts 3–100 characters; page size is capped at 100. Ordering is stable by release year descending, then title and ID ascending.
- Spring Security uses Google OIDC, a verified-email allowlist, session authentication, and CSRF protection. See the authentication boundary above.

## Frontend (current implementation)

- Angular 22, TypeScript 6, standalone application configuration. The root component implements a responsive sign-in view and account-scoped movie catalog with create, edit, confirmed delete, title search, and exact, inclusive-range, and unrated rating filters.
- Startup checks `/api/auth/me`; writes fetch a CSRF token from `/api/auth/csrf` and send the backend-provided header. Google OAuth begins at `/oauth2/authorization/google`.
- Catalog search, rating filters, ordering, and pagination are handled by the account-scoped `GET /api/movies` endpoint; the client requests at most 50 rows per page.
- Theme defaults to `prefers-color-scheme`; manual override is stored in local storage on that browser. Cross-device account preference persistence is not implemented.
- Angular's development server proxies `/api`, `/oauth2`, and `/login` to `http://localhost:8080`. Production builds use `/movies/` as the app base path; movie endpoints are under `/api/movies` so they do not conflict with the site path. NPM routes the site and API prefixes to the frontend gateway; it proxies API/OAuth requests to the backend over the private app network.
- Recommendation lookup is not implemented.

## Persistence (current implementation and target)

- Local PostgreSQL database `movie`; Docker Compose uses PostgreSQL 17 and binds host port 5432 to loopback. Production Compose does not publish database or backend ports.
- Current JPA model has a generated integer movie ID, required name, optional rating, release year, and required account relation. The local 345 rows have release years and account ownership. Liquibase enforces required fields, rating range, and movie ID generation. Account-scoped reads return the owner's assigned rows. See the [data migration plan](data-migration.md).
- Hibernate uses `ddl-auto=validate` and Liquibase manages schema changes. Database constraints enforce required movie fields, the rating range, positive release years, and generated movie IDs.
- Database URL, username, and password are environment supplied. Local values are read from the ignored `backend/.env` under the explicit `local` profile; production uses the explicit `production` profile and protected server-side secrets.
- In production, PostgreSQL initializes a separate non-superuser `DB_USERNAME` role for the backend. `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` are bootstrap credentials used only by the database container; do not provide them to the backend. The initialization script runs only for an empty database volume.
- Liquibase is configured for schema migration. No seed data, backup policy, or retention policy is currently configured. The account table and movie ownership relation are present in the current JPA model.
- An existing database must be migrated into the target PostgreSQL-backed application before cutover. Its source engine, schema, location, and data volume are not yet recorded; see the [data migration plan](data-migration.md).

## Target behavior by component

| Component | Responsibility |
|---|---|
| Angular client | Google sign-in experience, responsive compact movie catalog UI, CRUD, title/rating filters, three movie suggestions, and light/dark theme. Default theme follows the device; a manual choice is saved to the account and follows it across devices. |
| Spring Boot API | Authenticate/verify signed-in Google identities, enforce the server-side allowlist, scope every movie operation to its account, validate movie data, expose catalog operations, and broker recommendation lookups using five randomly selected account-owned movies rated 8–10 without exposing API credentials to the browser. |
| PostgreSQL | Persist account identity/access settings, per-account movie records, and account theme preference in a database dedicated to this application. |
| Owner's server/network | Host the application and dedicated database with Docker Compose; Nginx Proxy Manager is the existing reverse proxy. Expose the app through the owner's domain using HTTPS. A dedicated proxy network will isolate it from the existing media-services network. |
| Recommendation API (proposed) | Resolve selected highly rated catalog movies to provider movie IDs and return recommendation candidates. The application combines results, removes entries already in the user's catalog, and returns three distinct suggestions. Provider, result-ranking strategy, and attribution UI remain open. |

## Current API contract

| Method and path | Behavior |
|---|---|
| `GET /api/movies?page=0&size=50` | Requires an authenticated, allowlisted session; returns a stable, account-scoped page with at most 100 rows. Results sort by release year descending, then name and ID ascending. |
| `GET /api/movies?q={term}&ratingMode={mode}` | Optional filters: title `q` (3–100 chars), `ratingMode=all\|unrated\|exact\|range`, `rating` for exact match, or `minRating` and `maxRating` for inclusive range. Filters combine with AND. Response contains `items`, `page`, `size`, `totalItems`, `totalPages`, and `hasNext`. |
| `POST /api/movies` | Requires authentication and CSRF. Creates `{name, releaseYear, rating}` under the authenticated account; returns HTTP 201 and the created DTO. |
| `PUT /api/movies/{id}` | Requires authentication and CSRF. Replaces the supplied movie fields only when the ID belongs to the authenticated account; returns HTTP 200 or 404. |
| `DELETE /api/movies/{id}` | Requires authentication and CSRF. Deletes only an account-owned movie; returns HTTP 204 or 404. |
| `GET /api/auth/me` | Returns the authenticated Google account email and display name. |
| `GET /api/auth/csrf` | Returns the CSRF token and header name for the session. |
| `POST /api/auth/logout` | Invalidates the session; requires the CSRF token. |

Every route that reads or changes account data enforces authentication and account ownership on the server. Invalid filter and paging parameters return HTTP 400; error bodies use Spring's default error format.

## Open architecture decisions

- Decide the secure deployment mechanism for the server-side allowlist configuration; do not store actual account identifiers in tracked documentation or source.
- Define account lifecycle behavior if a Google account email changes; persistence uses the stable Google `sub` claim while the allowlist currently matches verified email.
- Configure and verify the Nginx Proxy Manager routes, trusted network, and HTTPS callback on the owner's server.
- Plan the production Liquibase rollout against the production database state.
- Define HTTPS termination, secret storage, backups/restore, logs, and health monitoring in the deployment plan.
- Choose the movie recommendation provider, define how provider results are ranked and deduplicated, and document the provider's privacy, attribution, and failure behavior.
