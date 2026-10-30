# Decision: Account isolation and movie data

- Status: Accepted
- Date: 2026-10-29

## Context

The application begins as a personal movie watch-history catalog. Google sign-in is required, and the owner may later authorize more people. The application must remain private as additional people are added.

## Decision

- Initially, only the owner's Google account is authorized. The allowlist is managed through server configuration.
- The design must support adding more Google accounts through a whitelist later.
- Each authorized account has its own private movie catalog; users cannot view or modify another account's entries.
- Movie details are entered manually. Title and release year are required; ranking is optional and is an integer from 1 to 10.
- Release year is the only additional identifying movie field. A known case of two films sharing both title and year will not be represented in this personal catalog.
- Users can filter by partial, case-insensitive title matches (minimum three characters) and by exact ranking, inclusive ranking range, or unrated status. When both filters are active, both must match.
- Deletion requires confirmation and is permanent.
- The UI follows the device's light/dark preference by default. A manual theme override is stored in the user's account settings and applies across devices.

## Consequences

- Movie records must be associated with an account, and every read/write path must enforce that association on the server.
- Account authorization and movie ownership checks must not depend solely on frontend visibility.
- The account record needs to persist theme preference.
- A later allowlist entry creates a separate catalog rather than granting access to the owner's existing catalog.

## Alternatives considered

- A shared catalog for all allowlisted accounts was not selected; the owner wants each person's catalog to remain private.
- External movie metadata lookup and additional disambiguating fields such as director were not selected for the initial scope.
