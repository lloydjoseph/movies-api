# Product requirements

**Status:** Current behavior is documented from source. Future requirements remain open until product scope is agreed.

## Agreed target behavior

The following is agreed product scope, but is not all implemented yet:

- The application is for one owner's private catalog of movies they have already watched.
- The owner manually enters movie information. Title and release year are required; ranking is optional. Release year helps distinguish movies with the same title.
- Ranking is an optional integer from 1 to 10, inclusive.
- The owner can add, view, edit, and remove movies.
- The owner can search by partial title matches with a minimum query length of 3 characters.
- The owner can filter by one or more exact ratings and include unrated movies.
- When title and ranking filters are both active, a movie must satisfy both filters to appear (AND behavior).
- The owner signs in with Google; movie content is available only to the owner's specifically authorized Google account.
- The access policy should be extensible to authorize additional Google accounts through a whitelist, without redesigning movie ownership/access checks.
- Each authorized account has its own private movie catalog. Users cannot view or modify another account's movies.
- The application provides both light and dark visual themes.
- By default, the application follows the device's light/dark preference. A user can switch themes manually, and the selected preference is remembered.
- Use a clean, modern, compact catalog layout. Show each 1–10 ranking with its own fixed color in a red-to-green scale; do not interpolate a gradient. Keep the numeric score visible, and use a neutral style for unrated movies so color is not the only indicator.
- The owner can request three movie suggestions based on five randomly selected movies rated 8–10 in their own catalog. If fewer than five qualify, use all qualifying movies. Suggestions are shown separately and are not added to the watched catalog automatically.
- The application is usable in web browsers on phones, tablets, and desktop computers.
- The application is hosted on the owner's own server on their network and is accessible over the internet using the owner's domain name.

The initial owner account and any later allowlisted accounts will be managed through server configuration. The configuration format and deployment mechanism are technical details to specify.

## Current API behavior

### List, search, and filter movies

- `GET /api/movies` requires an authenticated, allowlisted session and returns only that account's catalog in pages of at most 100 records. The default page size is 50 and results are ordered by release year descending, then name and ID ascending.
- Optional `q` searches a case-insensitive title substring; when supplied it must be 3–100 characters.
- `ratingMode` supports `all`, `unrated`, `exact`, and `range`; the last two require their corresponding rating parameters in the 1–10 range. Title and rating filters are combined with AND behavior.
- The response includes `items`, `page`, `size`, `totalItems`, `totalPages`, and `hasNext`.
- `GET /api/auth/me` returns the signed-in Google account's email and name. `/api/movies/**` requests without a valid session return HTTP 401. Google accounts outside the allowlist are returned to the frontend and shown an access-denied message.
- Invalid paging, search, and rating parameters return HTTP 400.

### Create, update, and delete movies

- `POST /api/movies` accepts `{ "name", "releaseYear", "rating" }`, derives ownership from the authenticated account, and returns the created movie with HTTP 201.
- `PUT /api/movies/{id}` accepts the same complete movie fields, updates only a movie owned by the authenticated account, and returns the updated movie with HTTP 200.
- `DELETE /api/movies/{id}` deletes only a movie owned by the authenticated account and returns HTTP 204. A missing or differently owned movie returns HTTP 404.
- Create and update require a non-blank title of at most 255 characters and a positive release year. Rating is optional; when present it must be an integer from 1 through 10.
- Create, update, and delete require an authenticated session and its CSRF token. Clients cannot set or change the owner account.
- Request validation failures return HTTP 400. Write operations do not reveal whether a movie ID belongs to a different account.

## Current UI behavior

- The Angular single-page application checks the existing backend session at startup. Signed-out visitors see a Google sign-in action; authorized sessions see their account-scoped catalog.
- The site is named “Joseph’s Movies” and is intended to be served at `https://jlloyd.fr/movies/`. After Google sign-in, the backend returns the browser to this page and the app loads the signed-in account's catalog.
- The catalog loads `/api/movies` in pages, displays title, release year, rating or an unrated marker, and supports adding, editing, and confirming movie deletion.
- The catalog offers title search and rating filters. Rating filters are multi-select: choose one or more scores, optionally include unrated movies, or select All. Title and rating filters are applied by the backend across the full account catalog and combined with AND behavior. The interface loads more results on request and shows “No matching movies.” when active filters return no results.
- Movie rows show the title, release year, and rating together. Selecting a row reveals Edit and Remove actions over it. Choosing Edit or Remove replaces that row with an inline editor or delete confirmation, respectively; Cancel returns to the row. The row expands or contracts to fit the panel, and panels use subtle motion unless the browser requests reduced motion.
- Add and edit forms use a two-column layout with Title and Year above a full-width rating control. The edit form uses one contiguous button per score; selecting the active score again clears it to unrated. The add form currently uses a rating dropdown. Title and year validation errors are shown below the corresponding input after an invalid edit submission.
- The catalog and forms adapt to phone, tablet, and desktop widths. Movie titles can wrap on mobile, and desktop row actions are shown through the same row-selection overlay.
- Theme defaults to the device preference and a manual override is saved in browser local storage. It is not synchronized across devices.
- Recommendations are not yet available in the interface.

## Data shape

- `id`: generated integer identifier, primary key.
- `account`: required owner relation; each query is scoped to this account.
- `name`: required string.
- `releaseYear`: required integer; all imported rows must have a year before import.
- `rating`: nullable integer; the target range is 1–10.

## Acceptance criteria for the existing foundation

- An authenticated request to `GET /api/movies?page=0&size=50` returns only the signed-in account's movie rows in the documented page shape and stable order.
- An authenticated title or rating filter returns matching rows only from that account; pagination applies after filtering.
- An unauthenticated movie API request returns HTTP 401.
- A supplied blank search term or a term shorter than 3 or longer than 100 characters is rejected.

These criteria describe intended observable behavior from current code; they are not a claim that automated tests already cover each case.

## Target acceptance criteria

- The owner can create a movie with a title and no ranking.
- The owner must provide a release year when adding a movie.
- The owner can create or edit a movie with an optional integer ranking from 1 through 10; values outside that range are rejected.
- The owner can view the movie catalog and edit or delete an existing movie.
- Before deleting a movie, the application asks the owner to confirm the action.
- After confirmation, the movie is permanently deleted and is not recoverable through the application.
- A title query of at least 3 characters returns movies whose titles contain that text, ignoring letter case. Shorter queries are not submitted as title filters.
- An exact ranking filter returns only movies with that score.
- A ranking range returns movies whose scores are between the selected endpoints, including both endpoints.
- The unrated filter returns movies that have no ranking.
- When title and ranking filters are both selected, only movies matching both are returned.
- A user who is not signed in cannot access movie content or perform movie operations.
- In the initial release, a signed-in Google account other than the owner's authorized account cannot access movie content or perform movie operations.
- An authenticated but unauthorized account sees an access-denied message and can sign out.
- The authorization policy can later allow more Google accounts through a whitelist without changing the catalog's access-control model.
- Each account's movie operations affect only that account's catalog, including after additional accounts are allowlisted.
- By default, the UI matches the device's light/dark preference. A user's manual override is stored in that user's account settings and applies across devices.
- The movie application is usable from a phone, tablet, or desktop web browser.
- The application can be reached over the internet through the owner's domain while hosted on the owner's server.
- Each recommendation request uses five randomly selected watched movies rated 8–10 from the signed-in user's catalog, or all qualifying movies if fewer than five exist.
- The app returns three distinct suggestions that are not already in that user's catalog.
- Suggestions exclude movies already in the owner's catalog and remain separate from watched movies until the owner chooses to add them after watching.
- A failed or unavailable recommendation lookup does not affect catalog viewing or editing and offers a way to retry.

The catalog uses title and release year as the movie's identifying details. No additional disambiguating field (such as director) is planned. The owner has confirmed that a known case of two different movies sharing both title and release year does not need to be represented in this personal catalog.

## Recommendation decisions to settle

- Choose an API provider. TMDb is a candidate: its API supports searching movies by title and release year, then retrieving recommendations for a movie ID. Its developer FAQ requires visible attribution for non-commercial use. See [TMDb movie search](https://developer.themoviedb.org/reference/search-movie), [movie recommendations](https://developer.themoviedb.org/reference/movie-recommendations), and [API FAQ](https://developer.themoviedb.org/docs/faq).
- Decide how to rank and combine provider results, and whether each suggestion shows a poster, synopsis, and/or the highly rated movie that influenced it. Keep provider credentials on the server.

## Future requirements template

For each agreed feature, record:

- **ID and priority:**
- **User and need:** As a [user], I want [capability] so that [outcome].
- **Behavior:** Include normal, empty, invalid, and failure cases that matter.
- **Acceptance criteria:** Specific outcomes that can be checked.
- **Data/security implications:** Data added, access rules, retention, and privacy considerations.
- **Dependencies and unresolved decisions:**
