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
    vscode.commands.registerCommand('dath.runOnboarding', () => handleOnboarding(ctx))
  );

  // Seed built-in profiles on first run
  await seedBuiltInProfiles(ctx);

  // Apply on startup — don't await, activation must complete so commands are available immediately
  applyCurrentConfig().catch(err => console.warn('[Dath] Initial apply failed:', err));

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
  await engine.clear();
  await engine.clearFontSettings();
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
  const bracketShapeHints = cfg.get<boolean>('bracketShapeHints') ?? false;
  const customPalettes = cfg.get<Record<string, any>>('customPalettes');
  const warmthBias = cfg.get<number>('warmthBias') ?? 0;
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

  await engine.apply(cvdMode, cvdSeverity, contrastMode, contrastStrength, rainbowBrackets, bracketShapeHints, customPalettes, warmthBias);
  await engine.applyFontSettings(fontOverride, fontSize, lineHeight, letterSpacing);
  statusBar.update(true, activeProfile, cvdMode);
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
    { label: 'Tritanopia', description: 'Blue-yellow', value: 'tritanopia' }
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
  }

  await ctx.globalState.update('dath.onboarded', true);
  vscode.window.showInformationMessage('Dath is configured. Run "Dath: Save Current Settings as Profile" to save this as a profile.');
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
