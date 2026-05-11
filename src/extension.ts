/**
 * extension.ts
 * Dath — Color & Visual Comfort for VS Code
 * Your editor, tuned to your eyes.
 *
 * PolyForm Noncommercial 1.0.0 — Ryan James, Dublin, Ireland
 */

import * as vscode from 'vscode';
import { ThemeEngine } from './themeEngine';
import { DathStatusBar } from './statusBar';
import { DathPanel } from './panel';
import {
  getProfiles,
  saveProfile,
  deleteProfile,
  profileFromCurrentConfig,
  applyProfile,
  BUILT_IN_PROFILES
} from './profiles';
import type { CvdMode, ContrastMode } from './cvd';

let statusBar: DathStatusBar;
let engine: ThemeEngine;
let configChangeListener: vscode.Disposable | undefined;

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  engine = new ThemeEngine();
  statusBar = new DathStatusBar();

  // Register commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('dath.toggle', () => handleToggle()),
    vscode.commands.registerCommand('dath.openPanel', () => DathPanel.show(ctx)),
    vscode.commands.registerCommand('dath.selectProfile', () => handleSelectProfile(ctx)),
    vscode.commands.registerCommand('dath.saveProfile', () => handleSaveProfile(ctx)),
    vscode.commands.registerCommand('dath.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'dath')
    ),
    vscode.commands.registerCommand('dath.runOnboarding', () => handleOnboarding(ctx)),
    vscode.commands.registerCommand('dath.exportProfiles', () => handleExportProfiles(ctx)),
    vscode.commands.registerCommand('dath.importProfiles', () => handleImportProfiles(ctx)),
    vscode.commands.registerCommand('dath.renameProfile', () => handleRenameProfile(ctx)),
    vscode.commands.registerCommand('dath.deleteProfile', () => handleManageProfiles(ctx))
  );

  // Seed built-in profiles on first run
  await seedBuiltInProfiles(ctx);

  // Apply on startup — don't await, activation must complete so commands are available immediately
  applyCurrentConfig().catch(err => console.warn('[Dath] Initial apply failed:', err));

  // Auto-switch profile when VS Code switches between light and dark themes
  ctx.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(async (theme) => {
      const cfg = vscode.workspace.getConfiguration('dath');
      const isDark = theme.kind !== vscode.ColorThemeKind.Light;
      const profileName = cfg.get<string>(isDark ? 'darkModeProfile' : 'lightModeProfile') ?? '';
      if (!profileName) return;
      const profile = getProfiles(ctx).find(p => p.name === profileName);
      if (profile) {
        await applyProfile(profile);
        engine.invalidateCache();
        await applyCurrentConfig();
        vscode.window.showInformationMessage(`Dath: auto-switched to "${profileName}".`);
      }
    })
  );

  // Re-apply when settings change
  configChangeListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('dath')) {
      await applyCurrentConfig();
    }
    // Invalidate theme cache and re-apply when the active theme changes
    if (e.affectsConfiguration('workbench.colorTheme')) {
      engine.invalidateCache();
      await applyCurrentConfig();
    }
  });
  ctx.subscriptions.push(configChangeListener);

  // Show onboarding if first install
  const hasOnboarded = ctx.globalState.get<boolean>('dath.onboarded');
  if (!hasOnboarded) {
    const choice = await vscode.window.showInformationMessage(
      'Welcome to Dath! Run the setup wizard to configure your visual comfort settings.',
      'Run Setup Wizard',
      'Not Now'
    );
    if (choice === 'Run Setup Wizard') {
      await handleOnboarding(ctx);
    }
  }
}

export async function deactivate(): Promise<void> {
  try {
    await engine.clear();
    await engine.clearFontSettings();
  } catch {
    // Ignored — async calls may be cancelled during extension host teardown
  }
  statusBar?.dispose();
  configChangeListener?.dispose();
}

// ── Core apply ───────────────────────────────────────────────────────────────

async function applyCurrentConfig(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('dath');
  const enabled = cfg.get<boolean>('enabled') ?? true;
  const cvdMode = (cfg.get<string>('cvdMode') ?? 'none') as CvdMode;
  const cvdSeverity = cfg.get<number>('cvdSeverity') ?? 1.0;
  const contrastMode = (cfg.get<string>('contrastMode') ?? 'none') as ContrastMode;
  const contrastStrength = cfg.get<number>('contrastStrength') ?? 0.5;
  const rainbowBrackets = cfg.get<boolean>('rainbowBrackets') ?? false;
  const rainbowIndents = cfg.get<boolean>('rainbowIndents') ?? false;
  const bracketShapeHints = cfg.get<boolean>('bracketShapeHints') ?? false;
  const customPalettes = cfg.get<Record<string, any>>('customPalettes');
  const warmthBias = cfg.get<number>('warmthBias') ?? 0;
  const simulationMode = cfg.get<boolean>('simulationMode') ?? false;
  const fontOverride = cfg.get<string>('fontOverride') ?? 'none';
  const fontSize = cfg.get<number>('fontSizeOverride') ?? 0;
  const lineHeight = cfg.get<number>('lineHeightOverride') ?? 0;
  const letterSpacing = cfg.get<number>('letterSpacingOverride') ?? 0;
  const activeProfile = cfg.get<string>('activeProfile') ?? '';

  if (!enabled) {
    await engine.clear();
    await engine.clearFontSettings();
    statusBar.update(false);
    return;
  }

  await engine.apply(cvdMode, cvdSeverity, contrastMode, contrastStrength, rainbowBrackets, rainbowIndents, bracketShapeHints, customPalettes, warmthBias, simulationMode);
  await engine.applyFontSettings(fontOverride, fontSize, lineHeight, letterSpacing);
  statusBar.update(true, activeProfile, cvdMode, engine.degraded);
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function handleToggle(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('dath');
  const current = cfg.get<boolean>('enabled') ?? true;
  await cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
}

async function handleSelectProfile(ctx: vscode.ExtensionContext): Promise<void> {
  const profiles = getProfiles(ctx);
  if (profiles.length === 0) {
    const action = await vscode.window.showInformationMessage(
      'No saved profiles yet. Save your current settings as a profile first.',
      'Save Current as Profile'
    );
    if (action) await handleSaveProfile(ctx);
    return;
  }

  const items = profiles.map(p => ({
    label: p.name,
    description: [
      p.cvdMode !== 'none' ? `CVD: ${p.cvdMode}` : '',
      p.contrastMode !== 'none' ? `contrast: ${p.contrastMode}` : '',
      p.rainbowBrackets ? 'brackets' : ''
    ].filter(Boolean).join(' · ')
  }));

  items.push({ label: '$(settings-gear) Manage profiles...', description: '' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Dath profile'
  });

  if (!picked) return;

  if (picked.label.includes('Manage profiles')) {
    await handleManageProfiles(ctx);
    return;
  }

  const profile = profiles.find(p => p.name === picked.label);
  if (profile) {
    await applyProfile(profile);
    vscode.window.showInformationMessage(`Dath: switched to profile "${profile.name}"`);
  }
}

async function handleSaveProfile(ctx: vscode.ExtensionContext): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name this profile',
    placeHolder: 'e.g. Office Morning, Low Light, Presentation'
  });
  if (!name) return;

  const profile = { ...profileFromCurrentConfig(), name };
  await saveProfile(ctx, profile);
  vscode.window.showInformationMessage(`Dath: profile "${name}" saved.`);
}

async function handleManageProfiles(ctx: vscode.ExtensionContext): Promise<void> {
  const profiles = getProfiles(ctx);
  const items = profiles.map(p => ({ label: p.name, description: 'click to delete' }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a profile to delete'
  });
  if (!picked) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete profile "${picked.label}"?`,
    { modal: true },
    'Delete'
  );
  if (confirm === 'Delete') {
    await deleteProfile(ctx, picked.label);
    vscode.window.showInformationMessage(`Dath: profile "${picked.label}" deleted.`);
  }
}

async function handleOnboarding(ctx: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('dath');
  const target = vscode.ConfigurationTarget.Global;

  // Step 1: CVD type
  const cvdPick = await vscode.window.showQuickPick([
    { label: 'None', description: 'I do not have colour vision deficiency', value: 'none' },
    { label: 'Deuteranopia', description: 'Red-green (green weak) — most common', value: 'deuteranopia' },
    { label: 'Protanopia', description: 'Red-green (red weak)', value: 'protanopia' },
    { label: 'Tritanopia', description: 'Blue-yellow', value: 'tritanopia' },
    { label: 'Achromatopsia', description: 'Complete colour blindness — luminance only', value: 'achromatopsia' }
  ], { placeHolder: 'Do you have colour vision deficiency?' });
  if (!cvdPick) return;
  await cfg.update('cvdMode', cvdPick.value, target);

  // Step 2: Contrast comfort
  const contrastPick = await vscode.window.showQuickPick([
    { label: 'None', description: 'No background adjustment', value: 'none' },
    { label: 'Soften', description: 'Soften white backgrounds — good for snow blindness', value: 'soften' },
    { label: 'Warm', description: 'Warm the background tone', value: 'warm' },
    { label: 'Cool', description: 'Cool the background tone', value: 'cool' },
    { label: 'Dim', description: 'Reduce overall brightness', value: 'dim' }
  ], { placeHolder: 'How would you like to adjust background contrast?' });
  if (!contrastPick) return;
  await cfg.update('contrastMode', contrastPick.value, target);

  // Step 3: Rainbow brackets
  const bracketPick = await vscode.window.showQuickPick([
    { label: 'Yes', description: 'CVD-safe palette, shape hints available', value: true },
    { label: 'No', description: 'Leave bracket colouring as-is', value: false }
  ], { placeHolder: 'Enable rainbow bracket colouring?' });
  if (!bracketPick) return;
  await cfg.update('rainbowBrackets', bracketPick.value, target);

  if (bracketPick.value) {
    const shapeHints = await vscode.window.showQuickPick([
      { label: 'Yes', description: 'Adds underline to bracket pairs — shape + colour', value: true },
      { label: 'No', description: 'Colour only', value: false }
    ], { placeHolder: 'Add shape hints (underline) to bracket pairs?' });
    if (shapeHints) {
      await cfg.update('bracketShapeHints', shapeHints.value, target);
    }

    const indentsPick = await vscode.window.showQuickPick([
      { label: 'Yes', description: 'Colour indent guides to match your bracket pairs', value: true },
      { label: 'No', description: 'Leave indent guides as-is', value: false }
    ], { placeHolder: 'Colour indent guides to match rainbow brackets?' });
    if (indentsPick) {
      await cfg.update('rainbowIndents', indentsPick.value, target);
    }
  }

  // Font step
  const fontPick = await vscode.window.showQuickPick([
    { label: 'Default', description: 'Keep your current VS Code font', value: 'none' },
    { label: 'OpenDyslexic', description: 'Reduces reading errors — designed for dyslexia', value: 'OpenDyslexic' },
    { label: 'Atkinson Hyperlegible', description: 'High legibility for low-vision users', value: 'Atkinson Hyperlegible' },
    { label: 'Lexie Readable', description: 'Optimised for reading comfort and dyslexia', value: 'Lexie Readable' }
  ], { placeHolder: 'Choose an editor font (must be installed on your system)' });
  if (!fontPick) return;
  if (fontPick.value !== 'none') {
    await cfg.update('fontOverride', fontPick.value, target);
  }

  // Final step: activate now?
  const activatePick = await vscode.window.showQuickPick([
    { label: 'Yes, activate now', description: 'Apply corrections immediately', value: true },
    { label: 'Not yet', description: 'Save settings but leave Dath off for now', value: false }
  ], { placeHolder: 'Activate Dath now?' });
  if (!activatePick) return;

  await cfg.update('enabled', activatePick.value, target);
  await ctx.globalState.update('dath.onboarded', true);

  if (activatePick.value) {
    const action = await vscode.window.showInformationMessage(
      'Dath is active. Click the panel item in the status bar to adjust settings or turn it off.',
      'Open Panel'
    );
    if (action === 'Open Panel') {
      DathPanel.show(ctx);
    }
  } else {
    const action = await vscode.window.showInformationMessage(
      'Settings saved. To turn Dath on, click $(eye) Dath in the status bar.',
      'Turn On Now'
    );
    if (action === 'Turn On Now') {
      await cfg.update('enabled', true, target);
    }
  }
}

async function handleExportProfiles(ctx: vscode.ExtensionContext): Promise<void> {
  const profiles = getProfiles(ctx);
  if (profiles.length === 0) {
    vscode.window.showInformationMessage('No saved profiles to export.');
    return;
  }
  await vscode.env.clipboard.writeText(JSON.stringify(profiles, null, 2));
  vscode.window.showInformationMessage(`Dath: ${profiles.length} profile(s) copied to clipboard as JSON.`);
}

async function handleRenameProfile(ctx: vscode.ExtensionContext): Promise<void> {
  const profiles = getProfiles(ctx);
  if (profiles.length === 0) {
    vscode.window.showInformationMessage('No saved profiles to rename.');
    return;
  }
  const picked = await vscode.window.showQuickPick(
    profiles.map(p => ({ label: p.name })),
    { placeHolder: 'Select a profile to rename' }
  );
  if (!picked) return;

  const newName = await vscode.window.showInputBox({
    prompt: `Rename "${picked.label}" to…`,
    value: picked.label
  });
  if (!newName || newName === picked.label) return;

  const profile = getProfiles(ctx).find(p => p.name === picked.label);
  if (!profile) return;

  await deleteProfile(ctx, picked.label);
  await saveProfile(ctx, { ...profile, name: newName });

  const cfg = vscode.workspace.getConfiguration('dath');
  if (cfg.get<string>('activeProfile') === picked.label) {
    await cfg.update('activeProfile', newName, vscode.ConfigurationTarget.Global);
  }
  vscode.window.showInformationMessage(`Dath: profile renamed to "${newName}".`);
}

async function handleImportProfiles(ctx: vscode.ExtensionContext): Promise<void> {
  const text = await vscode.env.clipboard.readText();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    vscode.window.showErrorMessage('Dath: Clipboard does not contain valid JSON. Copy exported profiles first.');
    return;
  }
  if (!Array.isArray(parsed)) {
    vscode.window.showErrorMessage('Dath: Expected an array of profiles. Copy exported profiles first.');
    return;
  }
  const valid = parsed.filter((p): p is { name: string } =>
    typeof p === 'object' && p !== null && typeof (p as any).name === 'string'
  );
  if (valid.length === 0) {
    vscode.window.showErrorMessage('Dath: No valid profiles found in clipboard.');
    return;
  }
  const confirm = await vscode.window.showInformationMessage(
    `Import ${valid.length} profile(s)? Existing profiles with the same name will be overwritten.`,
    'Import', 'Cancel'
  );
  if (confirm !== 'Import') return;
  for (const p of valid) {
    await saveProfile(ctx, p as any);
  }
  vscode.window.showInformationMessage(`Dath: ${valid.length} profile(s) imported.`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedBuiltInProfiles(ctx: vscode.ExtensionContext): Promise<void> {
  const seeded = ctx.globalState.get<boolean>('dath.profilesSeeded');
  if (seeded) return;

  const names = ['Deuteranopia', 'Protanopia', 'Dyslexia Comfort'];
  for (let i = 0; i < BUILT_IN_PROFILES.length; i++) {
    await saveProfile(ctx, { ...BUILT_IN_PROFILES[i], name: names[i] });
  }
  await ctx.globalState.update('dath.profilesSeeded', true);
}
