/**
 * panel.ts
 * Dath's webview panel — visual colour correction preview and profile switcher.
 * Native settings handle everything else.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { correctColour, adjustContrast, adjustWarmth, BRACKET_PALETTES } from './cvd';
import { getProfiles, applyProfile, profileFromCurrentConfig, saveProfile } from './profiles';
import type { CvdMode, ContrastMode } from './cvd';

export class DathPanel {
  static currentPanel: DathPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly ctx: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  static show(ctx: vscode.ExtensionContext): void {
    if (DathPanel.currentPanel) {
      DathPanel.currentPanel.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'dath',
      'Dath',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DathPanel.currentPanel = new DathPanel(panel, ctx);
  }

  private constructor(panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext) {
    this.panel = panel;
    this.ctx = ctx;

    this.render();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Re-render when config changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('dath') || e.affectsConfiguration('workbench.colorTheme')) {
        this.render();
      }
    }, null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'applyProfile': {
          const profiles = getProfiles(this.ctx);
          const profile = profiles.find(p => p.name === msg.name);
          if (profile) {
            await applyProfile(profile);
            this.render();
          }
          break;
        }
        case 'saveProfile': {
          const name = await vscode.window.showInputBox({
            prompt: 'Name this profile',
            placeHolder: 'e.g. Office Morning, Low Light'
          });
          if (name) {
            await saveProfile(this.ctx, { ...profileFromCurrentConfig(), name });
            this.render();
          }
          break;
        }
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'dath');
          break;
        case 'toggle':
          vscode.commands.executeCommand('dath.toggle');
          break;
        case 'runOnboarding':
          vscode.commands.executeCommand('dath.runOnboarding');
          break;
        case 'exportProfiles':
          vscode.commands.executeCommand('dath.exportProfiles');
          break;
        case 'importProfiles':
          await vscode.commands.executeCommand('dath.importProfiles');
          this.render();
          break;
        case 'updateSetting': {
          const cfg = vscode.workspace.getConfiguration();
          await cfg.update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
          break;
        }
        case 'updateCustomPalette': {
          const cfg = vscode.workspace.getConfiguration('dath');
          const slot = msg.slot || 'custom1';
          const current = cfg.get<Record<string, any>>('customPalettes') || {};
          const palette = current[slot] || {};
          
          if (msg.role) {
            palette[msg.role] = msg.color;
          } else if (msg.bracketIndex !== undefined) {
            const brackets = palette.brackets || [...BRACKET_PALETTES.default];
            brackets[msg.bracketIndex] = msg.color;
            palette.brackets = brackets;
          }
          
          await cfg.update('customPalettes', { ...current, [slot]: palette }, vscode.ConfigurationTarget.Global);
          break;
        }
        case 'resetSection': {
          const cfg = vscode.workspace.getConfiguration('dath');
          const target = vscode.ConfigurationTarget.Global;
          const sectionKeys: Record<string, string[]> = {
            cvd:      ['cvdMode', 'cvdSeverity', 'simulationMode'],
            comfort:  ['contrastMode', 'contrastStrength', 'warmthBias'],
            brackets: ['rainbowBrackets', 'bracketShapeHints'],
            font:     ['fontOverride', 'fontSizeOverride', 'lineHeightOverride', 'letterSpacingOverride'],
          };
          for (const key of (sectionKeys[msg.section] ?? [])) {
            await cfg.update(key, undefined, target);
          }
          break;
        }
        case 'resetAll': {
          const cfg = vscode.workspace.getConfiguration('dath');
          const target = vscode.ConfigurationTarget.Global;
          for (const key of [
            'cvdMode', 'cvdSeverity', 'simulationMode', 'contrastMode', 'contrastStrength', 'warmthBias',
            'rainbowBrackets', 'bracketShapeHints', 'customPalettes',
            'fontOverride', 'fontSizeOverride', 'lineHeightOverride', 'letterSpacingOverride'
          ]) {
            await cfg.update(key, undefined, target);
          }
          break;
        }
      }
    }, null, this.disposables);
  }

  private render(): void {
    const cfg = vscode.workspace.getConfiguration('dath');
    const enabled = cfg.get<boolean>('enabled') ?? true;
    const cvdMode = (cfg.get<string>('cvdMode') ?? 'none') as CvdMode;
    const cvdSeverity = cfg.get<number>('cvdSeverity') ?? 1.0;
    const contrastMode = (cfg.get<string>('contrastMode') ?? 'none') as ContrastMode;
    const contrastStrength = cfg.get<number>('contrastStrength') ?? 0.5;
    const warmthBias = cfg.get<number>('warmthBias') ?? 0;
    const rainbowBrackets = cfg.get<boolean>('rainbowBrackets') ?? false;
    const bracketShapeHints = cfg.get<boolean>('bracketShapeHints') ?? false;
    const customPalettes = cfg.get<Record<string, any>>('customPalettes') ?? {};
    const simulationMode = cfg.get<boolean>('simulationMode') ?? false;
    const fontOverride = cfg.get<string>('fontOverride') ?? 'none';
    const fontSizeOverride = cfg.get<number>('fontSizeOverride') ?? 0;
    const lineHeightOverride = cfg.get<number>('lineHeightOverride') ?? 0;
    const letterSpacingOverride = cfg.get<number>('letterSpacingOverride') ?? 0;
    const activeProfile = cfg.get<string>('activeProfile') ?? '';
    const profiles = getProfiles(this.ctx);

    const SAMPLES: Array<{ label: string; hex: string; role: string }> = [
      { label: 'String', hex: '#98C379', role: 'String' },
      { label: 'Error', hex: '#E06C75', role: 'Error' },
      { label: 'Keyword', hex: '#C678DD', role: 'Keyword' },
      { label: 'Function', hex: '#61AFEF', role: 'Function' },
      { label: 'Number', hex: '#D19A66', role: 'Number' },
      { label: 'Comment', hex: '#5C6370', role: 'Comment' },
      { label: 'Warning', hex: '#E5C07B', role: 'Warning' },
      { label: 'Added', hex: '#3FB950', role: 'Added' },
      { label: 'Deleted', hex: '#F85149', role: 'Deleted' },
      { label: 'Modified', hex: '#58A6FF', role: 'Modified' },
    ];

    const activePalette = (cvdMode.startsWith('custom') && customPalettes) ? customPalettes[cvdMode] : null;

    const corrected = SAMPLES.map(s => {
      let hex = s.hex;
      if (activePalette && activePalette[s.role]) {
        hex = activePalette[s.role];
      } else if (enabled && cvdMode !== 'none' && !cvdMode.startsWith('custom')) {
        hex = correctColour(hex, cvdMode, cvdSeverity);
      }
      
      if (enabled && contrastMode !== 'none') hex = adjustContrast(hex, contrastMode, contrastStrength);
      if (enabled && warmthBias !== 0) hex = adjustWarmth(hex, warmthBias);
      return { ...s, corrected: hex };
    });

    let bracketPalette: string[];
    if (activePalette && activePalette.brackets) {
      bracketPalette = activePalette.brackets;
    } else {
      bracketPalette = (enabled && rainbowBrackets)
        ? (BRACKET_PALETTES[cvdMode] ?? BRACKET_PALETTES.default)
        : BRACKET_PALETTES.default;
    }

    const logoUri = this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(this.ctx.extensionPath, 'resources', 'dath-logo.svg')));

    this.panel.webview.html = buildHtml({
      enabled,
      cvdMode,
      cvdSeverity,
      contrastMode,
      contrastStrength,
      warmthBias,
      activeProfile,
      profiles: profiles.map(p => p.name),
      samples: corrected,
      bracketPalette,
      customPalettes,
      simulationMode,
      rainbowBrackets,
      bracketShapeHints,
      fontOverride,
      fontSizeOverride,
      lineHeightOverride,
      letterSpacingOverride,
      logoUri: logoUri.toString()
    });
  }

  dispose(): void {
    DathPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

// ── HTML ──────────────────────────────────────────────────────────────────────

interface RenderData {
  enabled: boolean;
  cvdMode: string;
  cvdSeverity: number;
  contrastMode: string;
  contrastStrength: number;
  warmthBias: number;
  activeProfile: string;
  profiles: string[];
  samples: Array<{ label: string; hex: string; corrected: string; role: string }>;
  bracketPalette: string[];
  customPalettes: Record<string, any>;
  simulationMode: boolean;
  rainbowBrackets: boolean;
  bracketShapeHints: boolean;
  fontOverride: string;
  fontSizeOverride: number;
  lineHeightOverride: number;
  letterSpacingOverride: number;
  logoUri: string;
}

/** Determine if white or black text has better contrast against a hex color */
function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  // YIQ formula for perceived brightness
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

function buildHtml(d: RenderData): string {
  const changed = d.samples.filter(s => s.hex !== s.corrected).length;
  const isCustomMode = d.cvdMode.startsWith('custom');

  const swatchRows = d.samples.map(s => {
    const same = s.hex === s.corrected;
    const contrastOrig = getContrastColor(s.hex);
    const contrastCorr = getContrastColor(s.corrected);
    return `
      <div class="swatch-row${same ? ' unchanged' : ''}">
        <span class="swatch-label">${s.label}</span>
        <div class="swatch-pair">
          <div class="swatch" style="background:${s.hex}" title="${s.hex}">
            <span class="swatch-hex" style="color:${contrastOrig}">${s.hex}</span>
          </div>
          <div class="arrow">${same ? '—' : '→'}</div>
          <div class="swatch${same ? ' swatch-same' : ''}" style="background:${s.corrected}; position:relative;" title="${s.corrected}">
            <span class="swatch-hex" style="color:${contrastCorr}">${s.corrected}</span>
            ${isCustomMode ? `<input type="color" value="${s.corrected}" class="color-picker-hidden" onchange="send('updateCustomPalette', { slot: '${d.cvdMode}', role: '${s.role}', color: this.value })">` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const bracketSwatches = d.bracketPalette.map((c, i) =>
    `<div class="bracket-swatch" style="background:${c}; position:relative;" title="${c}">
      ${i + 1}
      ${isCustomMode ? `<input type="color" value="${c}" class="color-picker-hidden" onchange="send('updateCustomPalette', { slot: '${d.cvdMode}', bracketIndex: ${i}, color: this.value })">` : ''}
    </div>`
  ).join('');

  const profileItems = d.profiles.length
    ? d.profiles.map(name => `
        <div class="profile-item${name === d.activeProfile ? ' active' : ''}">
          <span class="profile-name">${name}</span>
          <button class="btn-small" onclick="send('applyProfile', null, '${name}')">Apply</button>
        </div>`).join('')
    : `<p class="muted">No saved profiles yet.</p>`;

  // Button group helpers
  const cvdModes = ['none', 'deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia', 'custom1', 'custom2', 'custom3'];
  const contrastModes = ['none', 'soften', 'dim', 'warm', 'cool'];

  const cvdButtons = cvdModes.map(m =>
    `<button class="mode-btn${d.cvdMode === m ? ' active' : ''}" onclick="send('updateSetting','dath.cvdMode','${m}')">${m}</button>`
  ).join('');

  const contrastButtons = contrastModes.map(m =>
    `<button class="mode-btn${d.contrastMode === m ? ' active' : ''}" onclick="send('updateSetting','dath.contrastMode','${m}')">${m}</button>`
  ).join('');

  const cvdSevDisplay = d.cvdSeverity.toFixed(2);
  const contrastStrDisplay = d.contrastStrength.toFixed(2);
  const warmthDisplay = d.warmthBias.toFixed(2);

  // Toggle Pill Helper
  const togglePill = (key: string, current: boolean) => `
    <div class="toggle-pill">
      <button class="${!current ? 'active' : ''}" onclick="send('updateSetting','${key}',false)">Off</button>
      <button class="${current ? 'active' : ''}" onclick="send('updateSetting','${key}',true)">On</button>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dath</title>
<style>
  :root {
    --accent: var(--vscode-textLink-foreground);
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-panel-border);
    --input-bg: var(--vscode-input-background);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-sec-bg: var(--vscode-button-secondaryBackground);
    --btn-sec-fg: var(--vscode-button-secondaryForeground);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: var(--vscode-font-size);
    color: var(--fg);
    background: var(--bg);
    padding: 24px;
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .logo-container { display: flex; align-items: center; }
  .main-logo { height: 28px; width: auto; display: block; }
  
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .status-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${d.enabled ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 51, 73, 0.1)'};
    color: ${d.enabled ? '#3fb950' : '#f85149'};
    border: 1px solid ${d.enabled ? 'rgba(63, 185, 80, 0.2)' : 'rgba(248, 51, 73, 0.2)'};
  }

  /* ── Sections ── */
  .section { margin-bottom: 36px; animation: fadeIn 0.4s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--muted);
  }
  .btn-reset {
    font-size: 10px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-reset:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Toggle Pills ── */
  .toggle-pill {
    display: inline-flex;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px;
    gap: 2px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  }
  .toggle-pill button {
    padding: 4px 14px;
    border-radius: 18px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .toggle-pill button.active {
    background: var(--btn-bg);
    color: var(--btn-fg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .toggle-pill button:hover:not(.active) { color: var(--fg); }

  /* ── Mode Groups ── */
  .btn-group {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .mode-btn {
    font-size: 11px;
    font-weight: 600;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--btn-sec-bg);
    color: var(--btn-sec-fg);
    cursor: pointer;
    text-transform: capitalize;
    transition: all 0.2s;
  }
  .mode-btn.active {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border-color: var(--btn-bg);
  }
  .mode-btn:hover:not(.active) { border-color: var(--accent); }

  /* ── Control Rows ── */
  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .control-label { font-size: 13px; font-weight: 500; color: var(--fg); }
  .control-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* ── Sliders ── */
  .slider-row {
    margin-bottom: 16px;
  }
  .slider-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .slider-label { font-size: 11px; color: var(--muted); font-weight: 600; }
  .slider-val { font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: var(--accent); font-weight: 700; }
  
  .slider-container { display: flex; align-items: center; gap: 12px; }
  input[type=range] {
    flex: 1;
    accent-color: var(--accent);
    height: 4px;
    cursor: pointer;
    background: var(--border);
    border-radius: 2px;
    -webkit-appearance: none;
  }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 14px; width: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    margin-top: -5px;
  }

  /* ── Swatches ── */
  .swatch-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .swatch-row.unchanged { opacity: 0.35; filter: grayscale(0.5); }
  .swatch-label { width: 80px; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .swatch-pair { display: flex; align-items: center; gap: 12px; flex: 1; }
  .swatch {
    width: 90px; height: 32px;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .swatch-hex {
    font-size: 9px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    letter-spacing: 0.2px;
    font-weight: 700;
    opacity: 0.85;
  }
  .arrow { font-size: 14px; color: var(--muted); opacity: 0.5; }

  /* ── Brackets ── */
  .bracket-row { 
    display: flex; gap: 12px; align-items: center; 
    padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px;
  }
  .bracket-swatches { display: flex; gap: 6px; }
  .bracket-swatch {
    width: 28px; height: 28px;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    color: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.1);
    cursor: pointer;
    overflow: hidden;
  }
  .color-picker-hidden {
    position: absolute;
    top: -10px; left: -10px;
    width: 50px; height: 50px;
    opacity: 0;
    cursor: pointer;
  }

  /* ── Profiles ── */
  .profile-grid { display: grid; gap: 8px; margin-bottom: 16px; }
  .profile-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 6px;
    background: var(--btn-sec-bg);
    border: 1px solid var(--border);
    transition: all 0.2s;
  }
  .profile-item.active {
    background: rgba(var(--vscode-textLink-foreground-rgb, 0, 95, 184), 0.1);
    border-color: var(--accent);
  }
  .profile-name { font-size: 13px; font-weight: 600; }
  .btn-small {
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-sec-bg);
    color: var(--btn-sec-fg);
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-small:hover {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border-color: var(--btn-bg);
  }

  /* ── Global ── */
  .muted { font-size: 11px; color: var(--muted); }
  .btn-primary {
    width: 100%;
    font-size: 12px;
    font-weight: 700;
    padding: 10px;
    border-radius: 6px;
    border: none;
    background: var(--btn-bg);
    color: var(--btn-fg);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-secondary {
    flex: 1;
    padding: 7px 12px;
    border-radius: 6px;
    border: none;
    background: var(--btn-sec-bg);
    color: var(--btn-sec-fg);
    font-size: 12px;
    cursor: pointer;
  }
  .btn-secondary:hover { opacity: 0.9; }

  .disabled-notice {
    font-size: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(229, 192, 123, 0.1);
    color: #e5c07b;
    border: 1px solid rgba(229, 192, 123, 0.2);
    margin-bottom: 24px;
  }

  .font-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 12px;
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-top: 12px;
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo-container">
    <img src="${d.logoUri}" alt="Dath" class="main-logo">
  </div>
  <div class="header-actions">
    <div class="status-tag">${d.enabled ? 'Active' : 'Paused'}</div>
    ${togglePill('dath.enabled', d.enabled)}
  </div>
</div>

${!d.enabled ? `<div class="disabled-notice">Dath is currently paused. Enable it to see live corrections.</div>` : ''}

<!-- CVD Section -->
<div class="section">
  <div class="section-head">
    <div class="section-title">Correction Mode</div>
    <button class="btn-reset" onclick="send('resetSection','cvd')">Reset</button>
  </div>
  <div class="btn-group">
    ${cvdButtons}
  </div>
  ${!isCustomMode ? `
  <div class="slider-row">
    <div class="slider-head">
      <span class="slider-label">Correction Severity</span>
      <span class="slider-val" id="cvd-sev-val">${cvdSevDisplay}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="0.1" max="1.0" step="0.05" value="${d.cvdSeverity}"
        oninput="document.getElementById('cvd-sev-val').textContent=parseFloat(this.value).toFixed(2)"
        onchange="send('updateSetting','dath.cvdSeverity',parseFloat(this.value))">
    </div>
  </div>
  ` : `<p class="muted">Palette Studio: Use the pickers in the sections below to tune your custom set.</p>`}
  ${d.cvdMode !== 'none' && !isCustomMode ? `
  <div class="slider-row" style="margin-top:8px">
    <div class="slider-head">
      <span class="slider-label">Simulate only</span>
      <span class="muted" style="font-size:11px">Show how this theme looks to a ${d.cvdMode} user</span>
    </div>
    ${togglePill('dath.simulationMode', d.simulationMode)}
  </div>` : ''}
</div>

<!-- Comfort Section -->
<div class="section">
  <div class="section-head">
    <div class="section-title">Visual Comfort</div>
    <button class="btn-reset" onclick="send('resetSection','comfort')">Reset</button>
  </div>
  <div class="btn-group">
    ${contrastButtons}
  </div>
  <div class="slider-row">
    <div class="slider-head">
      <span class="slider-label">Mode Intensity</span>
      <span class="slider-val" id="contrast-str-val">${contrastStrDisplay}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="0.1" max="1.0" step="0.05" value="${d.contrastStrength}"
        oninput="document.getElementById('contrast-str-val').textContent=parseFloat(this.value).toFixed(2)"
        onchange="send('updateSetting','dath.contrastStrength',parseFloat(this.value))">
    </div>
  </div>
  <div class="slider-row">
    <div class="slider-head">
      <span class="slider-label">Temperature Bias (Cool &harr; Warm)</span>
      <span class="slider-val" id="warmth-val">${(d.warmthBias >= 0 ? '+' : '') + warmthDisplay}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="-1.0" max="1.0" step="0.05" value="${d.warmthBias}"
        oninput="document.getElementById('warmth-val').textContent=(parseFloat(this.value)>=0?'+':'')+parseFloat(this.value).toFixed(2)"
        onchange="send('updateSetting','dath.warmthBias',parseFloat(this.value))">
    </div>
  </div>
</div>

<!-- Brackets Section -->
<div class="section">
  <div class="section-head">
    <div class="section-title">Rainbow Brackets</div>
    <button class="btn-reset" onclick="send('resetSection','brackets')">Reset</button>
  </div>
  
  <div class="control-row">
    <div class="control-info">
      <div class="control-label">Enabled</div>
      <div class="control-desc">Use distinguishable pair coloring</div>
    </div>
    ${togglePill('dath.rainbowBrackets', d.rainbowBrackets)}
  </div>

  <div class="control-row">
    <div class="control-info">
      <div class="control-label">Shape Hints</div>
      <div class="control-desc">Add subtle underlines to matching pairs</div>
    </div>
    ${togglePill('dath.bracketShapeHints', d.bracketShapeHints)}
  </div>

  <div class="bracket-row" style="margin-top:12px">
    <div class="bracket-swatches">${bracketSwatches}</div>
    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; font-size:16px; margin-left:12px; opacity:0.8">
      ${d.bracketPalette.slice(0,3).map(c => `<span style="color:${c}">{</span>`).join('')}
      <span style="opacity:0.3">...</span>
      ${d.bracketPalette.slice(0,3).reverse().map(c => `<span style="color:${c}">}</span>`).join('')}
    </span>
  </div>
</div>

<!-- Preview Section (Palette Studio) -->
<div class="section" style="border-top:1px solid var(--border); padding-top:24px">
  <div class="section-title">Live Preview &amp; Editor</div>
  <p class="muted" style="margin: 8px 0 16px 0">
    ${isCustomMode 
      ? `Editing <strong>${d.cvdMode}</strong>. Click the right-side swatches to pick custom colours.` 
      : `Transforming <strong>${changed}</strong> theme colours.`
    }
  </p>
  <div class="preview-list">
    ${swatchRows}
  </div>
</div>

<!-- Font & Spacing Section -->
<div class="section">
  <div class="section-head">
    <div class="section-title">Font &amp; Spacing</div>
    <button class="btn-reset" onclick="send('resetSection','font')">Reset</button>
  </div>
  
  <div class="btn-group">
    ${['none','OpenDyslexic','Atkinson Hyperlegible','Lexie Readable'].map(f =>
      `<button class="mode-btn${d.fontOverride === f ? ' active' : ''}" onclick="send('updateSetting','dath.fontOverride','${f}');document.getElementById('custom-font').value=''">${f === 'none' ? 'Default' : f}</button>`
    ).join('')}
  </div>
  <input id="custom-font" type="text" class="font-input"
    placeholder="Or type any installed font name and press Enter…"
    value="${!['none','OpenDyslexic','Atkinson Hyperlegible','Lexie Readable'].includes(d.fontOverride) ? d.fontOverride : ''}"
    onkeydown="if(event.key==='Enter'){const v=this.value.trim();send('updateSetting','dath.fontOverride',v||'none');this.blur();}">

  <div class="slider-row" style="margin-top:16px">
    <div class="slider-head">
      <span class="slider-label">Font Size (px)</span>
      <span class="slider-val" id="font-size-val">${d.fontSizeOverride === 0 ? 'Default' : d.fontSizeOverride + 'px'}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="0" max="32" step="1" value="${d.fontSizeOverride}"
        oninput="document.getElementById('font-size-val').textContent=this.value==0?'Default':this.value+'px'"
        onchange="send('updateSetting','dath.fontSizeOverride',parseFloat(this.value))">
    </div>
  </div>

  <div class="slider-row">
    <div class="slider-head">
      <span class="slider-label">Line Height</span>
      <span class="slider-val" id="line-height-val">${d.lineHeightOverride === 0 ? 'Default' : d.lineHeightOverride.toFixed(2)}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="0" max="3" step="0.05" value="${d.lineHeightOverride}"
        oninput="document.getElementById('line-height-val').textContent=parseFloat(this.value)==0?'Default':parseFloat(this.value).toFixed(2)"
        onchange="send('updateSetting','dath.lineHeightOverride',parseFloat(this.value))">
    </div>
  </div>

  <div class="slider-row">
    <div class="slider-head">
      <span class="slider-label">Letter Spacing (px)</span>
      <span class="slider-val" id="letter-spacing-val">${d.letterSpacingOverride === 0 ? 'Default' : d.letterSpacingOverride.toFixed(1) + 'px'}</span>
    </div>
    <div class="slider-container">
      <input type="range" min="0" max="5" step="0.5" value="${d.letterSpacingOverride}"
        oninput="document.getElementById('letter-spacing-val').textContent=parseFloat(this.value)==0?'Default':parseFloat(this.value).toFixed(1)+'px'"
        onchange="send('updateSetting','dath.letterSpacingOverride',parseFloat(this.value))">
    </div>
  </div>
</div>

<!-- Profiles Section -->
<div class="section">
  <div class="section-title">Saved Profiles</div>
  <div class="profile-grid" style="margin-top:12px">
    ${profileItems}
  </div>
  <button class="btn-primary" onclick="send('saveProfile')">+ Save Current Configuration</button>
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="btn-secondary" onclick="send('exportProfiles')">Export to Clipboard</button>
    <button class="btn-secondary" onclick="send('importProfiles')">Import from Clipboard</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  function send(type, key, value) {
    if (typeof key === 'object') {
      vscode.postMessage({ type, ...key });
    } else if (type === 'updateSetting') {
      vscode.postMessage({ type, key, value });
    } else if (type === 'applyProfile') {
      vscode.postMessage({ type, name: value });
    } else if (type === 'resetSection') {
      vscode.postMessage({ type, section: key });
    } else {
      vscode.postMessage({ type });
    }
  }
</script>
</body>
</html>`;
}
