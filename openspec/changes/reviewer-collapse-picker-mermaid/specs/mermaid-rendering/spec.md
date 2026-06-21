## ADDED Requirements

### Requirement: Render mermaid code blocks as diagrams
Fenced code blocks whose info string is `mermaid` SHALL render as mermaid diagrams
in the document view, rather than as raw code.

#### Scenario: A mermaid block renders
- **WHEN** a document contains a ` ```mermaid ` block with a valid diagram
- **THEN** the block displays as a rendered diagram

### Requirement: Mermaid library is vendored and offline
The mermaid library SHALL be served from a vendored local asset (no external/CDN
request), so rendering works offline and makes no outbound network call.

#### Scenario: No external request
- **WHEN** mermaid renders a diagram
- **THEN** the library is loaded from the local server, not from the internet

#### Scenario: Loaded only when needed
- **WHEN** a document contains no mermaid block
- **THEN** the mermaid library is not initialized for that document

### Requirement: Invalid diagrams fall back to code
When a mermaid block fails to parse, the reviewer SHALL fall back to showing that
block's original source as a code block instead of breaking the page.

#### Scenario: Bad diagram
- **WHEN** a ` ```mermaid ` block contains invalid syntax
- **THEN** that block shows its raw source and the rest of the document still
  renders
