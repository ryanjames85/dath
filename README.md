# dath

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="resources/dath-logo2-dark.png">
  <img src="resources/dath-logo2.png" alt="dath" height="70">
</picture>

## Color & Visual Comfort for VS Code

*Your editor, tuned to your eyes.*

> Irish: *dath* — colour

---

## What is Dath?

Dath is a visual comfort layer that sits on top of any VS Code theme you already use. It does not replace your theme — it corrects it.

For developers with colour vision deficiency (CVD), the problem isn't that themes are badly designed — it's that they're designed for trichromat vision. Red strings and green comments look identical to a deuteranope. Dath shifts those specific colour ranges to safe alternatives while preserving the character of your theme.

For everyone else, Dath addresses the broader comfort problems that themes don't solve: harsh white backgrounds, snow blindness, visual noise, and the friction of font and spacing settings buried in JSON.

Everything is non-destructive. Dath writes only to VS Code's `workbench.colorCustomizations` override layer — never your theme files. Disable it and your editor is exactly as it was.

---

## Features

### CVD Colour Correction

Applies LMS daltonization (Brettel, Viénot & Mollon, 1997) to your active theme's colours. Reads the theme JSON directly from disk and corrects both workbench UI tokens and TextMate syntax token colours.

| Mode | Cone affected | Most common in |
| --- | --- | --- |
| Deuteranopia | M (green) | ~6% of males |
| Protanopia | L (red) | ~2% of males |
| Tritanopia | S (blue) | ~0.01% of population |
| Achromatopsia | All cones | Rod monochromacy — luminance only |

A **severity slider** (0.1–1.0) lets you dial in the correction strength — 1.0 for complete CVD, lower for partial deficiency.

**Simulate mode** — instead of correcting, show what your current theme looks like *to* someone with the selected CVD type. Useful for theme authors and for demonstrating CVD to colleagues.

**Custom palette slots** (Custom 1, 2, 3) let you define your own per-role colour overrides directly in the panel using colour pickers.

### Contrast Comfort

| Mode | Effect |
| --- | --- |
| Soften | Lifts pure whites toward a warm off-white — reduces snow blindness |
| Warm | Warms the background tone |
| Cool | Cools the background tone |
| Dim | Reduces overall brightness |

A **temperature bias** slider lets you add a persistent warm or cool hue tint on top of all other corrections.

### Rainbow Brackets

CVD-safe bracket palettes derived from the Wong (2011) colour palette — distinguishable under all CVD types. The palette updates automatically to match your active CVD mode.

**Shape hints** add a subtle underline to matching bracket pairs so they are identifiable without relying on colour alone.

**Rainbow indent guides** colour VS Code's indent guide lines to match the bracket palette, giving an additional spatial cue for nested code structure.

### Font & Spacing

Override editor typography without editing settings.json manually:

- **Font family** — quick picks for OpenDyslexic, Atkinson Hyperlegible, and Lexie Readable, or type any font installed on your system
- **Font size** — px override (0 = VS Code default)
- **Line height** — override for improved readability (suggested 1.4–1.8)
- **Letter spacing** — px override

### Profiles

Named configurations that switch in one click. Save, rename, delete, export, and import profiles from the panel or command palette. Three built-in starters are included on first install:

| Profile | Description |
| --- | --- |
| Deuteranopia | Full deuteranopia correction, softened backgrounds, CVD-safe brackets |
| Protanopia | Full protanopia correction, CVD-safe brackets |
| Dyslexia Comfort | Softened contrast, Atkinson Hyperlegible font, increased line height |

**Auto dark/light switching** — set `dath.darkModeProfile` and `dath.lightModeProfile` to automatically apply the right profile when VS Code (or the OS) switches between dark and light mode.

### Visual Panel

Click the status bar item to open the Dath panel — a live interactive control surface. Changes apply immediately as you adjust sliders or click mode buttons.

- Per-section reset buttons restore individual sections to defaults
- Global reset restores all Dath settings at once
- Live colour correction preview shows before/after swatches for representative theme colours
- Bracket palette preview updates in real time
- Profile management — apply, save, rename, delete, export, and import profiles without leaving the panel
- Simulate toggle — preview what your theme looks like to a CVD user
- Status bar shows a warning indicator if the theme file could not be read

---

## How It Works

1. On activation, Dath reads your active theme's JSON file from disk (including JSONC comment stripping and `include` chain resolution)
2. It applies the LMS daltonization pipeline to workbench colour tokens, TextMate syntax scopes, and semantic token colours
3. Corrected values are written to `workbench.colorCustomizations`, `editor.tokenColorCustomizations`, and `editor.semanticTokenColorCustomizations` in your global settings
4. When you disable Dath or change settings, only Dath's entries are removed — your own customisations are preserved

Dath manages 185 workbench colour tokens spanning the editor, sidebar, tabs, terminal, diff view, and more. It also reads and corrects `semanticTokenColors` from the theme file, covering the semantic highlighting layer used by modern themes alongside TextMate scopes.

---

## Getting Started

1. Install from the VS Code Marketplace
2. The setup wizard runs automatically on first install — choose your CVD type, contrast preference, and bracket options
3. Click the `$(eye) Dath` item in the status bar to open the panel at any time
4. Or: **Ctrl+Alt+D** / **Cmd+Alt+D** — or **Ctrl/Cmd+Shift+P** → `Dath: Open Panel`

### VS Code forks

Dath uses only standard VS Code extension APIs and works in any VS Code-compatible editor — Cursor, Windsurf, Gitpod, Project IDX, and others — without any changes.

**VSCodium** users: VSCodium does not use the VS Code Marketplace. Install via the `.vsix` file from the [GitHub releases page](https://github.com/ryanjames85/dath/releases), or find Dath on [open-vsx.org](https://open-vsx.org) if it has been published there.

---

## Commands

| Command | Description |
| --- | --- |
| `Dath: Open Panel` | Open the visual control panel |
| `Dath: Toggle On/Off` | Enable or disable all corrections |
| `Dath: Switch Profile` | Switch to a saved profile |
| `Dath: Save Current Settings as Profile` | Save current config as a named profile |
| `Dath: Open Settings` | Jump to Dath settings in the VS Code settings UI |
| `Dath: Run Setup Wizard` | Run the onboarding wizard again |
| `Dath: Export Profiles to Clipboard` | Copy all saved profiles as JSON |
| `Dath: Import Profiles from Clipboard` | Import profiles from clipboard JSON |
| `Dath: Rename Profile` | Rename a saved profile |
| `Dath: Delete Profile` | Delete a saved profile |

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `dath.enabled` | `true` | Enable or disable all corrections |
| `dath.cvdMode` | `none` | CVD correction: `none` · `deuteranopia` · `protanopia` · `tritanopia` · `achromatopsia` · `custom1` · `custom2` · `custom3` |
| `dath.cvdSeverity` | `1.0` | Correction strength 0.1–1.0 (ignored for custom and achromatopsia modes) |
| `dath.simulationMode` | `false` | Show how the theme looks to a CVD user rather than correcting it |
| `dath.contrastMode` | `none` | Background adjustment: `none` · `soften` · `warm` · `cool` · `dim` |
| `dath.contrastStrength` | `0.5` | Contrast adjustment strength 0.1–1.0 |
| `dath.warmthBias` | `0` | Hue tint: positive = warm, negative = cool, 0 = neutral |
| `dath.rainbowBrackets` | `false` | CVD-safe rainbow bracket colouring |
| `dath.rainbowIndents` | `false` | Colour indent guides to match the rainbow bracket palette |
| `dath.bracketShapeHints` | `false` | Underline hints on bracket pairs |
| `dath.fontOverride` | `none` | Any installed font name, or `none` for VS Code default |
| `dath.fontSizeOverride` | `0` | Font size in px (0 = VS Code default) |
| `dath.lineHeightOverride` | `0` | Line height override (0 = VS Code default) |
| `dath.letterSpacingOverride` | `0` | Letter spacing in px (0 = VS Code default) |
| `dath.activeProfile` | `""` | Active profile name — managed by Dath |
| `dath.customPalettes` | `{}` | Custom colour role mappings for Custom 1/2/3 modes |
| `dath.darkModeProfile` | `""` | Profile to auto-apply when VS Code switches to a dark theme |
| `dath.lightModeProfile` | `""` | Profile to auto-apply when VS Code switches to a light theme |

---

## Architecture

```text
extension.ts          ← entry point, commands, config listener, onboarding
├── cvd.ts            ← LMS daltonization engine (zero external dependencies)
├── themeReader.ts    ← locates and parses active theme JSON from disk
├── themeEngine.ts    ← read → correct → write pipeline (185 tokens)
├── panel.ts          ← interactive webview control surface
├── profiles.ts       ← named profile save/apply/delete
└── statusBar.ts      ← status bar item and toggle
```

---

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch an Extension Development Host
```

```bash
npm run watch    # incremental compilation
npm run lint     # ESLint
npm run package  # build .vsix for local install or publishing
```

---

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE) — free to use and modify for non-commercial purposes.
