/**
 * themeReader.ts
 * Locates the active VS Code theme's JSON file on disk, parses it,
 * and returns all colour token hex values for Dath to correct.
 *
 * Falls back to manual colour picker if the theme file can't be found or parsed.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ThemeColours {
  /** workbench UI colours — keyed by VS Code colour token name */
  workbench: Record<string, string>;
  /** syntax token colours — keyed by TextMate scope */
  tokens: Record<string, string>;
  /** raw theme name, for cache keying */
  themeName: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read the active theme's colours from disk.
 * Returns null if the theme file cannot be found or parsed.
 */
export async function readActiveTheme(): Promise<ThemeColours | null> {
  const themeName = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');

  if (!themeName) return null;

  const themeFile = findThemeFile(themeName);
  if (!themeFile) {
    console.warn(`[Dath] Could not locate theme file for: ${themeName}`);
    return null;
  }

  try {
    return parseThemeFile(themeFile, themeName);
  } catch (err) {
    console.warn(`[Dath] Failed to parse theme file: ${themeFile}`, err);
    return null;
  }
}

/**
 * Prompt the user to pick a colour manually.
 * Used as fallback when theme file parsing fails.
 * Returns the hex value the user selected, or null if cancelled.
 */
export async function pickColourManually(
  prompt: string = 'Pick a colour to correct'
): Promise<string | null> {
  // Ask user to type or paste a hex — VS Code doesn't have a native colour picker
  // command, but we can invoke the built-in one via a scratch document trick,
  // or just use an input box with hex validation as the practical fallback.
  const input = await vscode.window.showInputBox({
    prompt,
    placeHolder: '#FF6B6B',
    validateInput: (v) => {
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim())) {
        return 'Enter a valid hex colour e.g. #FF6B6B';
      }
      return null;
    }
  });
  return input?.trim() ?? null;
}

// ── Theme file location ───────────────────────────────────────────────────────

function findThemeFile(themeName: string): string | null {
  // Search all installed extensions for one that contributes this theme
  for (const ext of vscode.extensions.all) {
    const pkg = ext.packageJSON as ExtensionPackage;
    const themes = pkg?.contributes?.themes;
    if (!themes) continue;

    for (const theme of themes) {
      const label = theme.label ?? theme.id ?? '';
      if (label.toLowerCase() === themeName.toLowerCase() ||
          (theme.id ?? '').toLowerCase() === themeName.toLowerCase()) {
        const themeFilePath = path.join(ext.extensionPath, theme.path);
        if (fs.existsSync(themeFilePath)) {
          return themeFilePath;
        }
      }
    }
  }
  return null;
}

// ── Theme file parsing ────────────────────────────────────────────────────────

function parseThemeFile(filePath: string, themeName: string): ThemeColours {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Theme files are JSON with comments (JSONC) — strip comments before parsing
  const cleaned = stripJsonComments(raw);
  const json = JSON.parse(cleaned) as ThemeJson;

  const workbench: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  // Extract workbench colour tokens
  if (json.colors) {
    for (const [key, value] of Object.entries(json.colors)) {
      if (isHex(value)) {
        workbench[key] = normaliseHex(value);
      }
    }
  }

  // Extract TextMate token colours
  const tokenRules = json.tokenColors ?? json['editor.tokenColorCustomizations']?.textMateRules ?? [];
  for (const rule of tokenRules) {
    const colour = rule.settings?.foreground;
    if (!colour || !isHex(colour)) continue;

    const scopes = Array.isArray(rule.scope)
      ? rule.scope
      : typeof rule.scope === 'string'
        ? rule.scope.split(',').map((s: string) => s.trim())
        : [];

    for (const scope of scopes) {
      if (scope) {
        tokens[scope] = normaliseHex(colour);
      }
    }
  }

  // Handle include/extends — some themes reference a base theme
  if (json.include) {
    try {
      const baseFile = path.resolve(path.dirname(filePath), json.include);
      if (fs.existsSync(baseFile)) {
        const base = parseThemeFile(baseFile, themeName);
        // Merge — current theme overrides base
        return {
          themeName,
          workbench: { ...base.workbench, ...workbench },
          tokens: { ...base.tokens, ...tokens }
        };
      }
    } catch {
      // Base theme parse failure is non-fatal
    }
  }

  return { themeName, workbench, tokens };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Strip // and /* comments from JSONC, respecting strings and removing trailing commas */
function stripJsonComments(jsonc: string): string {
  let isInsideString = false;
  let isInsideBlockComment = false;
  let isInsideLineComment = false;
  let result = '';

  for (let i = 0; i < jsonc.length; i++) {
    const char = jsonc[i];
    const nextChar = jsonc[i + 1];

    if (isInsideString) {
      if (char === '\\') {
        result += char + (nextChar || '');
        i++;
      } else if (char === '"') {
        isInsideString = false;
        result += char;
      } else {
        result += char;
      }
    } else if (isInsideBlockComment) {
      if (char === '*' && nextChar === '/') {
        isInsideBlockComment = false;
        i++;
      }
    } else if (isInsideLineComment) {
      if (char === '\n') {
        isInsideLineComment = false;
        result += char;
      }
    } else {
      if (char === '"') {
        isInsideString = true;
        result += char;
      } else if (char === '/' && nextChar === '*') {
        isInsideBlockComment = true;
        i++;
      } else if (char === '/' && nextChar === '/') {
        isInsideLineComment = true;
        i++;
      } else {
        result += char;
      }
    }
  }

  // Remove trailing commas: , followed by whitespace and then } or ]
  return result.replace(/,(\s*[}\]])/g, '$1');
}

function isHex(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  // VS Code theme colours can be 3, 4, 6, or 8 hex chars (with alpha)
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s.trim());
}

/** Normalise to 6-char hex, stripping alpha channel */
function normaliseHex(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return '#' + clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 4) {
    // RGBA — drop alpha
    return '#' + clean.slice(0, 3).split('').map(c => c + c).join('');
  }
  if (clean.length === 8) {
    // RRGGBBAA — drop AA
    return '#' + clean.slice(0, 6);
  }
  return '#' + clean;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeContribution {
  label?: string;
  id?: string;
  path: string;
  uiTheme?: string;
}

interface ExtensionPackage {
  contributes?: {
    themes?: ThemeContribution[];
  };
}

interface TokenRule {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

interface ThemeJson {
  colors?: Record<string, string>;
  tokenColors?: TokenRule[];
  include?: string;
  'editor.tokenColorCustomizations'?: {
    textMateRules?: TokenRule[];
  };
}
