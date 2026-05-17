/**
 * themeEngine.ts
 * Reads VS Code workbench colour tokens, applies CVD correction and contrast
 * adjustments, and writes back via workbench.colorCustomizations.
 *
 * This is non-destructive — Dath writes only to the user's colorCustomizations
 * override layer, never touching the theme itself. Removing Dath's entries
 * restores the original theme exactly.
 */

import * as vscode from 'vscode';
import { correctColour, simulateColour, adjustContrast, adjustWarmth, isHex, BRACKET_PALETTES } from './cvd';
import { readActiveTheme, pickColourManually } from './themeReader';
import { BracketDecorator } from './bracketDecorator';
import type { ThemeColours } from './themeReader';
import type { CvdMode, ContrastMode } from './cvd';

// Cache the last read theme so we don't hit disk on every config change
let themeCache: ThemeColours | null = null;

// Workbench colour tokens Dath manages.
const MANAGED_TOKENS: string[] = [
  // Editor
  'editor.background',
  'editor.foreground',
  'editor.selectionBackground',
  'editor.selectionForeground',
  'editor.inactiveSelectionBackground',
  'editor.selectionHighlightBackground',
  'editor.wordHighlightBackground',
  'editor.wordHighlightStrongBackground',
  'editor.findMatchBackground',
  'editor.findMatchHighlightBackground',
  'editor.findRangeHighlightBackground',
  'editor.hoverHighlightBackground',
  'editor.rangeHighlightBackground',
  'editor.symbolHighlightBackground',

  // Editor gutter
  'editorGutter.background',
  'editorGutter.addedBackground',
  'editorGutter.deletedBackground',
  'editorGutter.modifiedBackground',
  'editorLineNumber.foreground',
  'editorLineNumber.activeForeground',

  // Editor widgets
  'editorWidget.background',
  'editorWidget.foreground',
  'editorWidget.border',
  'editorSuggestWidget.background',
  'editorSuggestWidget.border',
  'editorSuggestWidget.foreground',
  'editorSuggestWidget.highlightForeground',
  'editorSuggestWidget.selectedBackground',
  'editorHoverWidget.background',
  'editorHoverWidget.border',

  // Errors / warnings / info
  'editorError.foreground',
  'editorError.background',
  'editorWarning.foreground',
  'editorWarning.background',
  'editorInfo.foreground',
  'editorInfo.background',
  'editorHint.foreground',

  // Diff editor
  'diffEditor.insertedTextBackground',
  'diffEditor.removedTextBackground',
  'diffEditor.insertedLineBackground',
  'diffEditor.removedLineBackground',
  'diffEditor.diagonalFill',

  // Activity bar
  'activityBar.background',
  'activityBar.foreground',
  'activityBar.inactiveForeground',
  'activityBarBadge.background',
  'activityBarBadge.foreground',

  // Side bar
  'sideBar.background',
  'sideBar.foreground',
  'sideBarSectionHeader.background',
  'sideBarSectionHeader.foreground',

  // Lists (file explorer, quick pick, etc.)
  'list.activeSelectionBackground',
  'list.activeSelectionForeground',
  'list.inactiveSelectionBackground',
  'list.inactiveSelectionForeground',
  'list.hoverBackground',
  'list.hoverForeground',
  'list.focusBackground',
  'list.focusForeground',
  'list.highlightForeground',
  'list.errorForeground',
  'list.warningForeground',
  'list.deemphasizedForeground',

  // Tabs
  'tab.activeBackground',
  'tab.activeForeground',
  'tab.inactiveBackground',
  'tab.inactiveForeground',
  'tab.unfocusedActiveBackground',
  'tab.unfocusedActiveForeground',
  'tab.unfocusedInactiveForeground',
  'tab.activeBorderTop',
  'tab.selectedBackground',
  'tab.selectedForeground',

  // Editor group
  'editorGroupHeader.tabsBackground',
  'editorGroupHeader.noTabsBackground',

  // Panel (terminal, problems, output)
  'panel.background',
  'panel.border',
  'panelTitle.activeForeground',
  'panelTitle.inactiveForeground',

  // Status bar
  'statusBar.background',
  'statusBar.foreground',
  'statusBar.debuggingBackground',
  'statusBar.debuggingForeground',
  'statusBar.noFolderBackground',
  'statusBarItem.errorBackground',
  'statusBarItem.errorForeground',
  'statusBarItem.warningBackground',
  'statusBarItem.warningForeground',
  'statusBarItem.remoteBackground',
  'statusBarItem.remoteForeground',

  // Title bar
  'titleBar.activeBackground',
  'titleBar.activeForeground',
  'titleBar.inactiveBackground',
  'titleBar.inactiveForeground',

  // Notifications
  'notificationCenterHeader.background',
  'notifications.background',
  'notifications.foreground',
  'notificationsErrorIcon.foreground',
  'notificationsWarningIcon.foreground',
  'notificationsInfoIcon.foreground',

  // Input / dropdowns
  'input.background',
  'input.foreground',
  'input.border',
  'inputValidation.errorBackground',
  'inputValidation.errorBorder',
  'inputValidation.errorForeground',
  'inputValidation.warningBackground',
  'inputValidation.warningBorder',
  'inputValidation.infoBackground',
  'inputValidation.infoBorder',
  'dropdown.background',
  'dropdown.foreground',

  // Buttons
  'button.background',
  'button.foreground',
  'button.hoverBackground',
  'button.secondaryBackground',
  'button.secondaryForeground',

  // Badges
  'badge.background',
  'badge.foreground',

  // Git decorations
  'gitDecoration.addedResourceForeground',
  'gitDecoration.deletedResourceForeground',
  'gitDecoration.modifiedResourceForeground',
  'gitDecoration.untrackedResourceForeground',
  'gitDecoration.conflictingResourceForeground',
  'gitDecoration.ignoredResourceForeground',
  'gitDecoration.submoduleResourceForeground',

  // Terminal
  'terminal.background',
  'terminal.foreground',
  'terminal.ansiBlack',
  'terminal.ansiRed',
  'terminal.ansiGreen',
  'terminal.ansiYellow',
  'terminal.ansiBlue',
  'terminal.ansiMagenta',
  'terminal.ansiCyan',
  'terminal.ansiWhite',
  'terminal.ansiBrightBlack',
  'terminal.ansiBrightRed',
  'terminal.ansiBrightGreen',
  'terminal.ansiBrightYellow',
  'terminal.ansiBrightBlue',
  'terminal.ansiBrightMagenta',
  'terminal.ansiBrightCyan',
  'terminal.ansiBrightWhite',
  'terminal.selectionBackground',
  'terminalCursor.foreground',

  // Minimap
  'minimap.errorHighlight',
  'minimap.warningHighlight',
  'minimap.findMatchHighlight',
  'minimap.selectionHighlight',
  'minimap.background',

  // Peek view
  'peekView.border',
  'peekViewEditor.background',
  'peekViewEditor.matchHighlightBackground',
  'peekViewResult.background',
  'peekViewResult.fileForeground',
  'peekViewResult.lineForeground',
  'peekViewResult.matchHighlightBackground',
  'peekViewResult.selectionBackground',
  'peekViewResult.selectionForeground',
  'peekViewTitle.background',
  'peekViewTitleDescription.foreground',
  'peekViewTitleLabel.foreground',

  // Merge conflicts
  'merge.currentHeaderBackground',
  'merge.currentContentBackground',
  'merge.incomingHeaderBackground',
  'merge.incomingContentBackground',
  'merge.commonHeaderBackground',
  'merge.commonContentBackground',

  // Breadcrumbs
  'breadcrumb.foreground',
  'breadcrumb.focusForeground',
  'breadcrumb.activeSelectionForeground',
  'breadcrumbPicker.background',

  // Debug
  'debugToolBar.background',
  'debugConsole.errorForeground',
  'debugConsole.warningForeground',
  'debugConsole.infoForeground',
  'debugConsole.sourceForeground',
  'debugTokenExpression.error',
  'debugTokenExpression.boolean',
  'debugTokenExpression.number',
  'debugTokenExpression.string',
];

export class ThemeEngine {
  private _degraded = false;
  private bracketDecorator = new BracketDecorator();
  get degraded(): boolean { return this._degraded; }

  async apply(
    cvdMode: CvdMode,
    cvdSeverity: number,
    contrastMode: ContrastMode,
    contrastStrength: number,
    rainbowBrackets: boolean,
    rainbowIndents: boolean,
    bracketShapeHints: boolean,
    customPalettes: Record<string, any> | undefined,
    warmthBias: number = 0,
    simulationMode: boolean = false
  ): Promise<void> {
    this._degraded = false;
    const workbenchConfig = vscode.workspace.getConfiguration();
    const userOverrides: Record<string, string> =
      workbenchConfig.get('workbench.colorCustomizations') ?? {};

    // Read theme hex values from disk — use cache if theme hasn't changed
    const themeName = vscode.workspace
      .getConfiguration('workbench')
      .get<string>('colorTheme') ?? '';

    if (!themeCache || themeCache.themeName !== themeName) {
      const read = await readActiveTheme();
      if (read) {
        themeCache = read;
      } else {
        // Theme file unreadable — offer manual fallback
        await this.offerManualFallback(cvdMode, cvdSeverity, contrastMode, contrastStrength, warmthBias);
        return;
      }
    }

    const cache = themeCache;
    const corrections: Record<string, string> = {};

    // Get custom palette overrides if any
    const activePalette = (cvdMode.startsWith('custom') && customPalettes) ? customPalettes[cvdMode] : null;

    // Correct workbench colour tokens
    for (const token of MANAGED_TOKENS) {
      const source = cache.workbench[token] ?? userOverrides[token];
      if (!source || !isHex(source)) continue;

      let corrected = source;
      
      // If we have a custom palette, we might want to override specific UI elements
      // For now, custom palettes primarily focus on syntax and brackets.
      // But we can apply the base algorithm if not explicitly overridden.

      if (cvdMode !== 'none' && !cvdMode.startsWith('custom')) {
        corrected = simulationMode
          ? simulateColour(corrected, cvdMode)
          : correctColour(corrected, cvdMode, cvdSeverity);
      }
      
      if (contrastMode !== 'none') {
        corrected = adjustContrast(corrected, contrastMode, contrastStrength);
      }
      if (warmthBias !== 0) {
        corrected = adjustWarmth(corrected, warmthBias);
      }
      if (corrected !== source) {
        corrections[token] = corrected;
      }
    }

    // Correct syntax token colours from the theme file
    const tokenCorrections: Array<{ scope: string | string[]; settings: { foreground?: string; fontStyle?: string } }> = [];
    
    // Semantic role matching for custom palettes
    const getSemanticRole = (scope: string): string | null => {
      const s = scope.toLowerCase();
      if (s.includes('string')) return 'String';
      if (s.includes('comment')) return 'Comment';
      if (s.includes('keyword') || s.includes('storage') || s.includes('control')) return 'Keyword';
      if (s.includes('entity.name.function') || s.includes('support.function')) return 'Function';
      if (s.includes('constant.numeric')) return 'Number';
      if (s.includes('invalid') || s.includes('error')) return 'Error';
      if (s.includes('warning')) return 'Warning';
      if (s.includes('markup.inserted')) return 'Added';
      if (s.includes('markup.deleted')) return 'Deleted';
      if (s.includes('markup.changed')) return 'Modified';
      return null;
    };

    for (const [scope, hex] of Object.entries(cache.tokens)) {
      let corrected = hex;
      const role = getSemanticRole(scope);

      if (activePalette && role && activePalette[role]) {
        corrected = activePalette[role];
      } else if (cvdMode !== 'none' && !cvdMode.startsWith('custom')) {
        corrected = simulationMode
          ? simulateColour(corrected, cvdMode)
          : correctColour(corrected, cvdMode, cvdSeverity);
      }

      if (warmthBias !== 0) {
        corrected = adjustWarmth(corrected, warmthBias);
      }
      if (corrected !== hex) {
        tokenCorrections.push({ scope, settings: { foreground: corrected } });
      }
    }

    // Correct semantic token colours
    const semanticCorrections: Record<string, string> = {};
    for (const [key, hex] of Object.entries(cache.semanticTokens)) {
      let corrected = hex;
      if (cvdMode !== 'none' && !cvdMode.startsWith('custom')) {
        corrected = simulationMode
          ? simulateColour(corrected, cvdMode)
          : correctColour(corrected, cvdMode, cvdSeverity);
      }
      if (warmthBias !== 0) {
        corrected = adjustWarmth(corrected, warmthBias);
      }
      if (corrected !== hex) {
        semanticCorrections[key] = corrected;
      }
    }

    if (Object.keys(semanticCorrections).length > 0) {
      const existingSemantic =
        workbenchConfig.get<Record<string, unknown>>('editor.semanticTokenColorCustomizations') ?? {};
      const existingRules = (existingSemantic.rules as Record<string, string>) ?? {};
      const dathKeys = new Set(Object.keys(semanticCorrections));
      const preserved = Object.fromEntries(
        Object.entries(existingRules).filter(([k]) => !dathKeys.has(k))
      );
      await workbenchConfig.update(
        'editor.semanticTokenColorCustomizations',
        { ...existingSemantic, rules: { ...preserved, ...semanticCorrections } },
        vscode.ConfigurationTarget.Global
      );
    }

    // Rainbow brackets — colours applied via editor decorations (not
    // workbench.colorCustomizations) so they work with any theme extension.
    const palette: string[] = (activePalette && activePalette.brackets)
      ? activePalette.brackets
      : (BRACKET_PALETTES[cvdMode] ?? BRACKET_PALETTES.default);

    if (rainbowBrackets || bracketShapeHints) {
      this.bracketDecorator.apply(palette, rainbowBrackets, bracketShapeHints);
    } else {
      this.bracketDecorator.clear();
    }

    // Rainbow indent guides — these must stay in colorCustomizations (no decoration API for guides)
    if (rainbowIndents) {
      palette.forEach((colour, i) => {
        corrections[`editorBracketPairGuide.background${i + 1}`] = colour + '25';
        corrections[`editorBracketPairGuide.activeBackground${i + 1}`] = colour + '70';
      });
      await workbenchConfig.update('editor.guides.bracketPairs', true, vscode.ConfigurationTarget.Global);
    } else {
      await workbenchConfig.update('editor.guides.bracketPairs', undefined, vscode.ConfigurationTarget.Global);
    }

    // Write workbench colour corrections — preserve user's own overrides
    const merged = { ...userOverrides, ...corrections };
    await workbenchConfig.update(
      'workbench.colorCustomizations',
      merged,
      vscode.ConfigurationTarget.Global
    );

    // Write syntax token corrections
    if (tokenCorrections.length > 0) {
      const existingTokenOverrides =
        workbenchConfig.get<Record<string, unknown>>('editor.tokenColorCustomizations') ?? {};
      const existingRules = (existingTokenOverrides.textMateRules as typeof tokenCorrections) ?? [];

      // Merge — Dath rules replace any existing rules for the same scope
      const dathScopes = new Set(tokenCorrections.map(r => Array.isArray(r.scope) ? r.scope.join(',') : r.scope));
      const preserved = existingRules.filter(r => {
        const scopeKey = Array.isArray(r.scope) ? r.scope.join(',') : r.scope;
        return !dathScopes.has(scopeKey);
      });

      await workbenchConfig.update(
        'editor.tokenColorCustomizations',
        { ...existingTokenOverrides, textMateRules: [...preserved, ...tokenCorrections] },
        vscode.ConfigurationTarget.Global
      );
    }
  }

  private async offerManualFallback(
    cvdMode: CvdMode,
    cvdSeverity: number,
    contrastMode: ContrastMode,
    contrastStrength: number,
    warmthBias: number = 0
  ): Promise<void> {
    this._degraded = true;
    const action = await vscode.window.showWarningMessage(
      "Dath couldn't read your theme file automatically. You can manually pick colours to correct.",
      'Pick a Colour',
      'Skip'
    );
    if (action !== 'Pick a Colour') return;

    const hex = await pickColourManually('Paste a hex colour from your theme to correct');
    if (!hex) return;

    let corrected = hex;
    if (cvdMode !== 'none') corrected = correctColour(corrected, cvdMode, cvdSeverity);
    if (contrastMode !== 'none') corrected = adjustContrast(corrected, contrastMode, contrastStrength);
    if (warmthBias !== 0) corrected = adjustWarmth(corrected, warmthBias);

    await vscode.env.clipboard.writeText(corrected);
    vscode.window.showInformationMessage(
      `Corrected colour ${hex} → ${corrected} copied to clipboard.`
    );
  }

  /** Invalidate the theme cache — call when the active theme changes */
  invalidateCache(): void {
    themeCache = null;
  }

  async clear(): Promise<void> {
    const workbenchConfig = vscode.workspace.getConfiguration();

    // Clear workbench colour overrides Dath added
    const existing: Record<string, string> =
      workbenchConfig.get('workbench.colorCustomizations') ?? {};

    this.bracketDecorator.clear();

    const allManagedKeys = [
      ...MANAGED_TOKENS,
      // Legacy cleanup — keys no longer written but may exist from older installs
      'editor.lineHighlightBackground',
      ...Array.from({ length: 6 }, (_, i) => `editorBracketHighlight.foreground${i + 1}`),
      ...Array.from({ length: 6 }, (_, i) => `editorBracketPairGuide.background${i + 1}`),
      ...Array.from({ length: 6 }, (_, i) => `editorBracketPairGuide.activeBackground${i + 1}`),
    ];
    await workbenchConfig.update('editor.guides.bracketPairs', undefined, vscode.ConfigurationTarget.Global);

    const cleaned = Object.fromEntries(
      Object.entries(existing).filter(([k]) => !allManagedKeys.includes(k))
    );

    await workbenchConfig.update(
      'workbench.colorCustomizations',
      Object.keys(cleaned).length > 0 ? cleaned : undefined,
      vscode.ConfigurationTarget.Global
    );

    // Clear semantic token corrections
    if (themeCache && Object.keys(themeCache.semanticTokens).length > 0) {
      const dathSemanticKeys = new Set(Object.keys(themeCache.semanticTokens));
      const existingSemantic =
        workbenchConfig.get<Record<string, unknown>>('editor.semanticTokenColorCustomizations') ?? {};
      const existingRules = (existingSemantic.rules as Record<string, string>) ?? {};
      const preservedRules = Object.fromEntries(
        Object.entries(existingRules).filter(([k]) => !dathSemanticKeys.has(k))
      );
      await workbenchConfig.update(
        'editor.semanticTokenColorCustomizations',
        Object.keys(preservedRules).length > 0
          ? { ...existingSemantic, rules: preservedRules }
          : undefined,
        vscode.ConfigurationTarget.Global
      );
    }

    // Clear syntax token corrections — remove only Dath's injected rules
    // We identify them by checking against the cached theme scopes
    if (themeCache) {
      const dathScopes = new Set(Object.keys(themeCache.tokens));
      const existingTokenOverrides =
        workbenchConfig.get<Record<string, unknown>>('editor.tokenColorCustomizations') ?? {};
      const existingRules =
        (existingTokenOverrides.textMateRules as Array<{ scope: string }>) ?? [];
      const preserved = existingRules.filter(r => !dathScopes.has(r.scope));

      await workbenchConfig.update(
        'editor.tokenColorCustomizations',
        preserved.length > 0
          ? { ...existingTokenOverrides, textMateRules: preserved }
          : undefined,
        vscode.ConfigurationTarget.Global
      );
    }

    this.invalidateCache();
  }

  async applyFontSettings(
    fontOverride: string,
    fontSize: number,
    lineHeight: number,
    letterSpacing: number
  ): Promise<void> {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const target = vscode.ConfigurationTarget.Global;

    if (fontOverride && fontOverride !== 'none') {
      await editorConfig.update('fontFamily', `'${fontOverride}', monospace`, target);
    }
    if (fontSize > 0) {
      await editorConfig.update('fontSize', fontSize, target);
    }
    if (lineHeight > 0) {
      await editorConfig.update('lineHeight', lineHeight, target);
    }
    if (letterSpacing > 0) {
      await editorConfig.update('letterSpacing', letterSpacing, target);
    }
  }

  async clearFontSettings(): Promise<void> {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const target = vscode.ConfigurationTarget.Global;
    await editorConfig.update('fontFamily', undefined, target);
    await editorConfig.update('fontSize', undefined, target);
    await editorConfig.update('lineHeight', undefined, target);
    await editorConfig.update('letterSpacing', undefined, target);
  }
}
