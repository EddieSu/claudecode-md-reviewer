## ADDED Requirements

### Requirement: Open a markdown file via an in-app file browser
The reviewer SHALL provide a `…` control next to the path input that opens an
in-app file browser (a modal) for navigating the filesystem and selecting a `.md`
file, loading it by absolute path. Directory listings SHALL come from a
token-protected `GET /api/browse`.

#### Scenario: Pick a file
- **WHEN** the user clicks `…`, navigates to a folder, and clicks a `.md` file
- **THEN** the reviewer loads that file (its absolute path appears in the path
  input and its content renders) and the modal closes

#### Scenario: Navigate folders
- **WHEN** the user clicks a folder row (or the `..` parent row)
- **THEN** the browser lists that directory's subfolders and `.md` files

#### Scenario: Dismiss without choosing
- **WHEN** the user closes the modal (✕, backdrop click, or Esc)
- **THEN** nothing is loaded

### Requirement: Cross-platform directory listing
The browse endpoint SHALL list a directory's immediate subfolders and `.md` files
on any platform. On Windows, the top level SHALL offer the available drive roots.

#### Scenario: Windows drives at the top
- **WHEN** the user navigates above a drive root on Windows
- **THEN** the browser lists the available drives (e.g. `C:\`, `D:\`)

#### Scenario: Unreadable directory
- **WHEN** a directory cannot be read
- **THEN** the browser shows an error message instead of failing silently

### Requirement: Browse requires a valid token
`GET /api/browse` SHALL require the correct token.

#### Scenario: Token required
- **WHEN** `/api/browse` is requested without the correct token
- **THEN** the server responds 403 and returns no listing
