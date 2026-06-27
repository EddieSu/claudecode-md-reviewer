# ui-i18n Specification

## Purpose
TBD - created by archiving change reviewer-ui-enhancements. Update Purpose after archive.
## Requirements
### Requirement: All user-facing strings are localized
Every user-facing string in the interface SHALL be resolved through a locale
lookup rather than a hardcoded literal, so the entire UI renders in the active
language.

#### Scenario: UI renders in the active language
- **WHEN** a language is active
- **THEN** buttons, placeholders, titles, section headers, and dynamic messages
  all display that language's strings

### Requirement: Ship Traditional Chinese and English
The package SHALL ship at least two complete, key-identical locales: Traditional
Chinese (`zh-Hant`) and English (`en`).

#### Scenario: Both shipped locales selectable
- **WHEN** the reviewer starts with no user locales added
- **THEN** the language selector offers both `zh-Hant` and `en`, each fully
  translated

### Requirement: Language selector with persistence and auto-detect
The interface SHALL provide a language selector. The initial language SHALL be
chosen as: persisted choice (`localStorage["mdr-lang"]`) if present, else the
best match for the browser language, else English. A manual choice SHALL persist.

#### Scenario: Remembered choice wins
- **WHEN** the user previously selected a language and reopens the reviewer
- **THEN** that language is active without re-selecting

#### Scenario: First visit uses browser language
- **WHEN** there is no persisted choice and the browser language matches a shipped
  locale
- **THEN** that locale is active on first load

### Requirement: Users can add a language by dropping in one file
A user SHALL be able to add or override a language by placing a single JSON locale
file in `~/.md-reviewer/locales/`, with no edit to installed files; the selector
SHALL list it automatically. Locale codes SHALL be validated to prevent path
traversal.

#### Scenario: Drop-in locale appears
- **WHEN** a user adds `~/.md-reviewer/locales/fr.json` and reloads
- **THEN** "fr" appears in the language selector and selecting it renders its
  strings

#### Scenario: User locale overrides a bundled one
- **WHEN** a user file uses the same code as a bundled locale
- **THEN** the user file's strings take precedence

### Requirement: Missing keys fall back safely
When a key is absent from the active locale, the lookup SHALL fall back to English
and then to the raw key, never failing.

#### Scenario: Partial translation
- **WHEN** a selected locale is missing some keys
- **THEN** those strings show the English text (or the key) while the rest show
  the selected language, with no error

