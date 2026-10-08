## MODIFIED Requirements

### Requirement: Favorites persist server-side
Favorites SHALL be stored in the user-writable file `~/.md-reviewer/favorites.json`
and survive browser restarts and switching browsers on the same machine. They are
machine-local: they SHALL NOT be described as shared across machines. Toggling SHALL
go through a token-protected `POST /api/favorite`.

#### Scenario: Persistence across sessions
- **WHEN** a user favorites a document and later reopens the reviewer (even in a
  different browser on the same machine)
- **THEN** the document still appears in the Favorites section

#### Scenario: Toggle requires a valid token
- **WHEN** a `POST /api/favorite` arrives without the correct token
- **THEN** the server responds 403 and does not modify `favorites.json`

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-08
