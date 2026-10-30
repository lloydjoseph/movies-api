# Project documentation

This documentation records the movie application's product intent, current behavior, technical design, and operating assumptions. Facts observed in the repository are labeled **Current**; decisions that still need an owner are labeled **Open**. Update the relevant document when implementation or agreed scope changes.

## Documents

- [Session handoff](SESSION_HANDOFF.md): current work state and next steps when resuming.
- [Product brief](product/product-brief.md): purpose, intended users, goals, non-goals, and product questions.
- [Requirements](product/requirements.md): current behavior and proposed outcomes with acceptance criteria.
- [Architecture](technical/architecture.md): components, data model, API, and cross-cutting concerns.
- [Data migration](technical/data-migration.md): plan and safeguards for moving the existing catalog into the new database.
- [Development setup](technical/development-setup.md): tools, versions, local services, and commands.
- [Deployment](technical/deployment.md): target runtime and operations.
- [Manual deployment guide](technical/deployment-guide.md): release checklist for the owner's server; server-specific paths and credentials remain to be configured.
- [Architecture decisions](technical/decisions/README.md): durable technical decisions and their rationale.

## Source of truth

Use source code and build configuration for what the application currently does. Use product documents for agreed intent and future requirements. If they conflict, record the discrepancy and resolve it; do not silently treat a proposed requirement as implemented behavior.

Keep `AGENTS.md` and `GEMINI.md` concise. They point tools to `PROJECT_CONTEXT.md`; this index points them to the detailed docs relevant to a task.
