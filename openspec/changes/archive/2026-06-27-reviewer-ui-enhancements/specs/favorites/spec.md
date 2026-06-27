## ADDED Requirements

### Requirement: Star toggle on sidebar rows
Every document row in the sidebar SHALL show a star control that toggles the
document's favorite state with a single click, reflecting the current state
(favorited vs not) visually.

#### Scenario: Favorite a document
- **WHEN** the user clicks the empty star on a sidebar row
- **THEN** the document is added to favorites, the star fills, and a **Favorites**
  section row for it appears

#### Scenario: Unfavorite a document
- **WHEN** the user clicks a filled star
- **THEN** the document is removed from favorites and its Favorites-section row
  disappears

### Requirement: Favorites persist server-side
Favorites SHALL be stored in the user-writable file `~/.md-reviewer/favorites.json`
and survive browser restarts and machine/browser changes. Toggling SHALL go
through a token-protected `POST /api/favorite`.

#### Scenario: Persistence across sessions
- **WHEN** a user favorites a document and later reopens the reviewer (even in a
  different browser on the same machine)
- **THEN** the document still appears in the Favorites section

#### Scenario: Toggle requires a valid token
- **WHEN** a `POST /api/favorite` arrives without the correct token
- **THEN** the server responds 403 and does not modify `favorites.json`

### Requirement: Dedicated Favorites section
The sidebar SHALL render a dedicated Favorites section, populated from a
`favorites` array returned by `GET /api/sidebar`, each row carrying the same
filename / folder·project tag / unresolved-count badge as other sections.

#### Scenario: Favorites listed with metadata
- **WHEN** the sidebar loads and favorites exist
- **THEN** each favorite shows its name, folder·project tag, and unresolved
  annotation badge, and clicking it opens the document

### Requirement: Favorites coexist with pins
Favorites SHALL be independent of the read-only 📌 pinned section; a document MAY
be both pinned and favorited, and removing one SHALL NOT affect the other.

#### Scenario: A document that is both pinned and favorited
- **WHEN** a pinned document is also favorited and then unfavorited
- **THEN** it disappears from Favorites but remains in the pinned section
