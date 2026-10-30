# Architecture decisions

Record decisions that are expensive to rediscover or likely to affect later work. Keep entries short: context, decision, consequences, and status. Do not record every implementation detail.

## Decision index

- [2026-10-29: Account isolation and movie data](2026-10-29-account-isolation-and-movie-data.md) — accepted product and data-model constraints.
- [2026-10-29: Self-hosted Compose deployment](2026-10-29-self-hosted-compose-deployment.md) — accepted hosting, network isolation, release, and source-access approach.

The current stack was also confirmed as the intended stack by the owner; the exact versions visible in the repository are documented in [architecture](../architecture.md).

- Java 21 and Spring Boot 4.1.0 for the backend.
- PostgreSQL 17 for the configured local database.
- Angular 22 for the frontend.

## Suggested record format

Create a file named `YYYY-MM-DD-short-title.md` with:

```markdown
# Decision: Short title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD

## Context
What problem or constraint requires a decision?

## Decision
What was chosen?

## Consequences
What becomes easier, harder, or constrained?

## Alternatives considered
What reasonable options were considered, and why were they not selected?
```
