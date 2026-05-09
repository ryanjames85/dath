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

## [Unreleased]

### Added

#### CVD Colour Correction

- Achromatopsia mode — rod monochromacy (complete colour blindness). Simulation collapses all channels to luminance; correction re-encodes colour differences as brightness contrast. Luminance-contrast bracket palette included.
- CVD simulation mode (`dath.simulationMode`) — instead of correcting your theme, shows how it looks to someone with the selected CVD type. Toggle in the panel CVD section. Useful for theme authors and for demonstrating CVD to colleagues.

#### Profiles

- Export profiles to clipboard (`Dath: Export Profiles to Clipboard`) — serialises all saved profiles as JSON
- Import profiles from clipboard (`Dath: Import Profiles from Clipboard`) — merges profiles from clipboard JSON, overwriting any with matching names
- Export and import buttons added directly to the panel Profiles section
- Fixed: `warmthBias` was missing from saved profiles — it is now captured and restored correctly

#### Core

- Keyboard shortcut `Ctrl+Alt+D` / `Cmd+Alt+D` to open the panel
- Status bar degraded indicator — shows a warning icon when the theme file cannot be read and Dath is running in manual fallback mode
