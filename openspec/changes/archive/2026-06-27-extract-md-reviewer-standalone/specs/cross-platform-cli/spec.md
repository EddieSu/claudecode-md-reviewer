## ADDED Requirements

### Requirement: CLI ensures the local server is running
The CLI SHALL detect whether the reviewer server is already running on `127.0.0.1:8771` and, if not, start it as a detached background process and wait until it responds before proceeding.

#### Scenario: Server not yet running
- **WHEN** the CLI is invoked and no server responds to `GET /api/ping`
- **THEN** the CLI spawns `server.cjs` in the background and polls until `/api/ping` returns 200 (or fails with a clear timeout error)

#### Scenario: Server already running
- **WHEN** the CLI is invoked and `/api/ping` already returns 200
- **THEN** the CLI reuses the running server without spawning a new one

### Requirement: CLI enqueues the target file
When invoked with a `.md` path, the CLI SHALL read the server token from the temp info file and push the absolute path into the review queue via `POST /api/enqueue`.

#### Scenario: Valid markdown path
- **WHEN** the CLI is invoked with an existing `.md` file path
- **THEN** the file's absolute path is enqueued and appears in the reviewer's "本次待審" list

#### Scenario: Missing or non-markdown path
- **WHEN** the CLI is invoked with a path that does not exist or is not a `.md`
- **THEN** the CLI exits non-zero with a clear error and does not enqueue

### Requirement: Cross-platform browser launch with fallback
The CLI SHALL open the default browser using a platform-appropriate command — `start` on Windows, `open` on macOS, `xdg-open` otherwise — passing the token in the URL. If the launch command fails, the CLI SHALL print the URL for manual opening instead of erroring out.

#### Scenario: Browser opens on each platform
- **WHEN** a browser-opening invocation runs on win32 / darwin / linux
- **THEN** the corresponding launcher command is used with the tokenized `http://127.0.0.1:8771/?token=...` URL

#### Scenario: Launch command unavailable (headless/WSL/SSH)
- **WHEN** the platform browser-open command is missing or fails
- **THEN** the CLI prints the full tokenized URL to stdout for the user to open manually, and exits zero

### Requirement: Push semantics preserve a single review tab
The CLI SHALL avoid spawning a new browser tab when the server was already running; it SHALL open a tab only when it just started the server this invocation, or when explicitly asked to open the reviewer with no file.

#### Scenario: Push to an already-open reviewer
- **WHEN** the server was already running and the CLI enqueues a file
- **THEN** no new browser tab is opened; the existing tab surfaces the file via its polling

#### Scenario: First launch opens a tab
- **WHEN** the CLI starts the server this invocation (or is invoked with no file to open the reviewer)
- **THEN** a browser tab is opened
