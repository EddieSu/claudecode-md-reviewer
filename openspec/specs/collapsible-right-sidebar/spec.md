# collapsible-right-sidebar Specification

## Purpose
TBD - created by archiving change reviewer-ui-enhancements. Update Purpose after archive.
## Requirements
### Requirement: Right annotations panel can be collapsed and expanded
The right annotations panel (`#side`) SHALL be collapsible and expandable via a
toggle, and when collapsed the article area SHALL reflow to use the freed width.

#### Scenario: Collapse the right panel
- **WHEN** the user activates the right-panel toggle while it is expanded
- **THEN** the annotations panel hides and the article widens to fill the space

#### Scenario: Expand the right panel
- **WHEN** the user activates the toggle while the panel is collapsed
- **THEN** the annotations panel reappears at its normal width

### Requirement: Toggle reachable while collapsed
The right-panel toggle SHALL remain visible and usable when the panel is
collapsed (i.e. it is not located inside the collapsed panel).

#### Scenario: Re-open after collapse
- **WHEN** the right panel is collapsed
- **THEN** a visible control to re-open it is still present in the header bar

### Requirement: Collapsed state persists across sessions
The right panel's collapsed/expanded state SHALL persist via
`localStorage["mdr-side-collapsed"]` and be restored on load.

#### Scenario: State restored on reload
- **WHEN** the user collapses the right panel and reloads the reviewer
- **THEN** the panel is still collapsed

