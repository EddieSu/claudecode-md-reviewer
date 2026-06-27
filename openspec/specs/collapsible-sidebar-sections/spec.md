# collapsible-sidebar-sections Specification

## Purpose
TBD - created by archiving change reviewer-collapse-picker-mermaid. Update Purpose after archive.
## Requirements
### Requirement: Sidebar sections can be collapsed and expanded
The favorites, history, and pinned sections in the left nav SHALL each have a
clickable header that toggles the visibility of that section's list, with a caret
indicating the state.

#### Scenario: Collapse a section
- **WHEN** the user clicks an expanded section's header
- **THEN** that section's list hides and the caret shows the collapsed state

#### Scenario: Expand a section
- **WHEN** the user clicks a collapsed section's header
- **THEN** that section's list shows and the caret shows the expanded state

### Requirement: History and pinned default to collapsed
On first use (no stored preference), the history and pinned sections SHALL start
collapsed and the favorites section SHALL start expanded.

#### Scenario: Defaults on first load
- **WHEN** the reviewer loads with no stored section preferences
- **THEN** history and pinned are collapsed while favorites is expanded

### Requirement: Section collapse state persists
Each section's collapsed/expanded state SHALL persist across reloads via
`localStorage`.

#### Scenario: State restored on reload
- **WHEN** the user collapses favorites (or expands history) and reloads
- **THEN** that section keeps the chosen state

