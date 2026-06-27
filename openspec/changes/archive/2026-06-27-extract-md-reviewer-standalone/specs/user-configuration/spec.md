## ADDED Requirements

### Requirement: Pins resolved from user-writable config with bundled fallback
The server SHALL resolve the pinned-documents list from the user-writable path `~/.md-reviewer/pins.json` when it exists, and otherwise fall back to the package-bundled `pins.example.json`. The install directory SHALL NOT be required to be writable.

#### Scenario: User pins present
- **WHEN** `~/.md-reviewer/pins.json` exists and is valid
- **THEN** the sidebar's pinned section is built from the user's pins

#### Scenario: No user pins
- **WHEN** `~/.md-reviewer/pins.json` does not exist
- **THEN** the server falls back to the bundled `pins.example.json` without error

### Requirement: Bundled example ships with no personal pins
The bundled `pins.example.json` SHALL contain commented guidance and an empty active `pins` array, so a fresh install surfaces no pre-configured personal documents.

#### Scenario: Fresh install pinned section
- **WHEN** the package is installed and no user config exists
- **THEN** the pinned "Claude 全域文件" section is empty (no author-specific paths)

### Requirement: Home-directory expansion in pin paths
Pin entries SHALL support a leading `~` that expands to the user's home directory, for both single `.md` files and directories (directory entries listing only the immediate `.md` children, non-recursive).

#### Scenario: Tilde expansion
- **WHEN** a pin entry begins with `~/`
- **THEN** it is expanded against the current user's home directory before being resolved

### Requirement: User data lives in the user home directory
History (`history.json`) and user pins (`pins.json`) SHALL be stored under `~/.md-reviewer/`, never inside the install/package directory.

#### Scenario: History persists across sessions
- **WHEN** a user opens documents and later restarts the server
- **THEN** previously opened documents are read back from `~/.md-reviewer/history.json`
