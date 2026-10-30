# Product brief

**Status:** Draft based on the owner's stated intent; implementation and operational details remain open.

## Product summary

This is a personal movie watch-history application. It lets its owner keep track of movies they have watched, find entries later, and assign each movie a ranking. The owner wants to sign in with Google. Initially, only the owner's account should have access; the access design should allow additional accounts to be added through a whitelist later, with a separate private catalog for each account. The app should work in web browsers on phones, tablets, and desktop computers. It should offer light and dark themes, follow the device preference by default, and store any manual theme choice in the user's account settings so it applies across devices.

The application provides an Angular interface backed by a Spring Boot API and PostgreSQL. It supports Google sign-in, account-scoped movie CRUD, title and rating filters, and paginated browsing. Recommendations and cross-device theme preferences remain future features.

## Problem and audience

- **Problem being solved:** The owner wants to remember which movies they have watched and how they ranked them.
- **Primary user:** The owner, for personal use. Additional users may be allowlisted later; each will have a separate private catalog.
- **Usage context:** A personal, self-hosted application running on the owner's server on their network and available over the internet through the owner's domain name.

## Goals

### Existing technical foundation

- Retrieve all movie records through the API.
- Search movie names without case sensitivity.
- Provide an Angular client foundation.

### Agreed product goals

- Maintain a private catalog of movies the user has already watched, with create, read, update, and permanent delete actions.
- Manually enter a required title and release year, plus an optional integer ranking from 1 to 10.
- Request three movie suggestions based on five randomly selected watched movies rated 8–10 (or all such movies if fewer than five exist). Suggestions are shown separately and are not automatically added to the watched catalog.
- Find movies using partial, case-insensitive title matches of at least three characters and ranking filters (exact score, inclusive range, or unrated). When both filters are active, apply both.
- Require Google sign-in and restrict access to accounts in a server-configured allowlist. Initially, only the owner's account is authorized; each subsequently allowlisted account has a separate private catalog.
- Provide light and dark themes. Follow the device setting by default; save a manual choice to the user's account so it follows them across devices.
- Use a clean, modern, compact catalog layout across phone, tablet, and desktop sizes.
- Work in web browsers on phones, tablets, and desktop computers, hosted on the owner's server and reachable over the internet through the owner's domain.

## Initial non-goals

 - A shared catalog across accounts is out of scope; each authorized account has a private catalog.
 - Tracking movies the owner plans to watch (a watchlist) is out of scope for the initial product; the purpose is to record movies already watched.
 - Reviews, watchlists, and broad external movie browsing are out of scope. A focused external lookup to suggest three movies from highly rated catalog entries is in scope.

## Success conditions

 - An authorized user can add, view, search, filter, edit, and delete their watched movies.
 - Each movie retains its title and release year and, when provided, its ranking.
 - Unauthenticated and unauthorized users cannot access movie records.
 - Each account can access only its own movie catalog.

## Constraints and assumptions

- The current implementation uses a Java/Spring backend, PostgreSQL, and Angular; see [architecture](../technical/architecture.md).
- Google account sign-in is implemented in the backend and frontend.
- The target client is a web browser on phone, tablet, or desktop; responsive layout is expected.
- The owner will host the application on their own server on their network, make it available over the internet, and use their own domain name.
- A previous version of the movie application already contains movie and rating data entered by the owner; that data must be migrated into the new application.
- The repository does not define expected traffic, server specifications, network ingress setup, or production availability requirements.
- The recommendation API provider and its attribution/licensing details are not yet selected. TMDb is a candidate; its API documents per-movie recommendations and requires attribution for non-commercial API use.

## Remaining product questions

- Choose the recommendation API provider and decide how its results and attribution appear in the app. Server hardware, operating system, ingress, and operations belong in the technical deployment document.
