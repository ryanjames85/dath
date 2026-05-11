<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to Dath will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.0] — 2026-05-07

Initial release.

### Added

#### CVD Colour Correction

- LMS daltonization engine based on Brettel, Viénot & Mollon (1997) — zero external dependencies
- Correction modes: `deuteranopia`, `protanopia`, `tritanopia`
- Severity slider (0.1–1.0) for partial CVD correction
- Corrects 185 workbench UI colour tokens (editor, sidebar, tabs, terminal, diff, minimap, and more)
- Corrects TextMate syntax token colours read directly from the active theme file on disk
- JSONC comment stripping and `include` chain resolution for theme file parsing
- Custom palette slots (`custom1`, `custom2`, `custom3`) with per-role colour pickers in the panel
- Semantic role matching (String, Keyword, Function, Comment, Error, Warning, Added, Deleted, Modified) for custom palettes

#### Visual Comfort

- Contrast modes: `soften`, `warm`, `cool`, `dim`
- Contrast strength slider (0.1–1.0)
- Warmth/temperature bias slider (−1.0 to +1.0) for persistent hue tint on top of all corrections

#### Rainbow Brackets

- CVD-safe bracket palettes derived from the Wong (2011) colour palette
- Per-CVD-mode palettes — automatically matched to the active correction mode
- Shape hints (underline) via TextMate rules for colour-independent pair identification

#### Font & Spacing

- Font family override — quick picks for OpenDyslexic, Atkinson Hyperlegible, and Lexie Readable
- Free-text font input — type any font installed on the system
- Font size override (px)
- Line height override
- Letter spacing override (px)

#### Panel

- Live interactive webview control surface — changes apply immediately
- CVD mode button group (none / deuteranopia / protanopia / tritanopia / custom1 / custom2 / custom3)
- Severity, contrast strength, and warmth bias sliders with live label updates
- Contrast mode button group
- Rainbow bracket and shape hint toggles
- Font family buttons and free-text input
- Font size, line height, and letter spacing sliders
- Per-section reset buttons (CVD, Visual Comfort, Brackets, Font & Spacing)
- Global reset to defaults
- Colour correction live preview — before/after swatches for representative theme colours
- Inline colour pickers on swatches in custom palette mode
- Bracket palette preview (swatches + live code sample)
- Profile management (apply saved profiles, save new profiles)

#### Profiles

- Named configuration profiles — save, apply, and delete
- Three built-in starter profiles seeded on first install: Deuteranopia, Protanopia, Dyslexia Comfort
- Profiles capture all settings: CVD mode and severity, contrast, brackets, font family, font size, line height, letter spacing

#### Core

- Status bar item — shows active profile or CVD mode, click to open panel
- Setup wizard (onboarding) — CVD type, contrast preference, rainbow brackets, shape hints
- Non-destructive operation — writes only to `workbench.colorCustomizations` and `editor.tokenColorCustomizations` overlay; theme files are never modified
- Fire-and-forget activation to prevent blocking command registration
- Theme cache with invalidation on theme change
- Manual colour correction fallback (clipboard copy) when theme file cannot be read

---

## [0.3.0] — Unreleased

### Added

#### CVD Colour Correction

- Semantic token correction — reads `semanticTokenColors` from the theme file and corrects them via `editor.semanticTokenColorCustomizations`. Covers the semantic highlighting layer used by modern themes (GitHub Theme, Catppuccin, One Dark Pro, etc.) alongside the existing TextMate scope correction.

#### Profiles

- Auto dark/light profile switching — set `dath.darkModeProfile` and/or `dath.lightModeProfile` to a saved profile name. Dath automatically applies the matching profile when VS Code switches between dark and light themes, including when the OS appearance changes.

---

## [0.2.0] — Unreleased

### Added

#### CVD Colour Correction

- Achromatopsia mode — rod monochromacy (complete colour blindness). Simulation collapses all channels to luminance; correction re-encodes colour differences as brightness contrast. Luminance-contrast bracket palette included.
- CVD simulation mode (`dath.simulationMode`) — instead of correcting your theme, shows how it looks to someone with the selected CVD type. Toggle in the panel CVD section. Useful for theme authors and for demonstrating CVD to colleagues.
- Custom palette discoverability hint — a small inline label below the CVD mode buttons explains what the Custom 1–3 slots do and how to activate them.

#### Rainbow Brackets

- Rainbow indent guides (`dath.rainbowIndents`) — colours VS Code's indent guide lines to match the active bracket palette, providing an additional spatial cue for nested code structure. Automatically enables `editor.guides.bracketPairs` when active.

#### Profiles

- Export profiles to clipboard (`Dath: Export Profiles to Clipboard`) — serialises all saved profiles as JSON
- Import profiles from clipboard (`Dath: Import Profiles from Clipboard`) — merges profiles from clipboard JSON, overwriting any with matching names
- Export and import buttons added directly to the panel Profiles section
- Rename profile command (`Dath: Rename Profile`) — select a saved profile and give it a new name; active profile reference updates automatically
- Delete profile command (`Dath: Delete Profile`) — top-level command to delete a profile without going through the Switch Profile flow; also available as a `×` button on each profile card in the panel
- Profiles section in the panel renamed to "My Configurations" to better reflect that profiles capture all settings including custom palettes
- Fixed: `warmthBias` was missing from saved profiles — it is now captured and restored correctly
- Fixed: `customPalettes` was missing from saved profiles — custom colour maps are now captured and restored correctly

#### Panel

- Full accessibility pass — all interactive controls have `aria-label`, `aria-pressed`, and `aria-valuetext` attributes; section titles use `<h2>`; keyboard-navigable font download links
- Font download links for OpenDyslexic, Atkinson Hyperlegible, and Lexie Readable — open in the system browser via `vscode.env.openExternal`

#### Onboarding (Setup Wizard)

- Rainbow indents step — asked after rainbow brackets is enabled; lets users opt in to coloured indent guides during setup
- Font choice step — pick from OpenDyslexic, Atkinson Hyperlegible, Lexie Readable, or Default during setup
- Final activation step — choose whether to activate Dath immediately or save settings for later, with a status bar notification either way

#### Core

- Keyboard shortcut `Ctrl+Alt+D` / `Cmd+Alt+D` to open the panel
- Status bar degraded indicator — shows a warning icon when the theme file cannot be read and Dath is running in manual fallback mode
- Theme file include-chain cycle detection — `parseThemeFile` now tracks visited paths to prevent infinite loops when theme files contain circular `include` references
