/**
 * profiles.ts
 * Named profile management. Profiles are stored in VS Code globalState.
 */

import * as vscode from 'vscode';
import type { CvdMode, ContrastMode } from './cvd';

export interface DathProfile {
  name: string;
  cvdMode: CvdMode;
  cvdSeverity: number;
  contrastMode: ContrastMode;
  contrastStrength: number;
  rainbowBrackets: boolean;
  rainbowIndents: boolean;
  bracketShapeHints: boolean;
  warmthBias: number;
  customPalettes: Record<string, any>;
  fontOverride: string;
  fontSizeOverride: number;
  lineHeightOverride: number;
  letterSpacingOverride: number;
}

const STORAGE_KEY = 'dath.profiles';

export function getProfiles(ctx: vscode.ExtensionContext): DathProfile[] {
  return ctx.globalState.get<DathProfile[]>(STORAGE_KEY) ?? [];
}

export async function saveProfile(ctx: vscode.ExtensionContext, profile: DathProfile): Promise<void> {
  const profiles = getProfiles(ctx).filter(p => p.name !== profile.name);
  profiles.push(profile);
  await ctx.globalState.update(STORAGE_KEY, profiles);
}

export async function deleteProfile(ctx: vscode.ExtensionContext, name: string): Promise<void> {
  const profiles = getProfiles(ctx).filter(p => p.name !== name);
  await ctx.globalState.update(STORAGE_KEY, profiles);
}

export function profileFromCurrentConfig(): DathProfile {
  const cfg = vscode.workspace.getConfiguration('dath');
  return {
    name: '',
    cvdMode: cfg.get('cvdMode') ?? 'none',
    cvdSeverity: cfg.get('cvdSeverity') ?? 1.0,
    contrastMode: cfg.get('contrastMode') ?? 'none',
    contrastStrength: cfg.get('contrastStrength') ?? 0.5,
    rainbowBrackets: cfg.get('rainbowBrackets') ?? false,
    rainbowIndents: cfg.get('rainbowIndents') ?? false,
    bracketShapeHints: cfg.get('bracketShapeHints') ?? false,
    warmthBias: cfg.get('warmthBias') ?? 0,
    customPalettes: cfg.get('customPalettes') ?? {},
    fontOverride: cfg.get('fontOverride') ?? 'none',
    fontSizeOverride: cfg.get('fontSizeOverride') ?? 0,
    lineHeightOverride: cfg.get('lineHeightOverride') ?? 0,
    letterSpacingOverride: cfg.get('letterSpacingOverride') ?? 0
  };
}

export async function applyProfile(profile: DathProfile): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('dath');
  const target = vscode.ConfigurationTarget.Global;
  await cfg.update('cvdMode', profile.cvdMode, target);
  await cfg.update('cvdSeverity', profile.cvdSeverity, target);
  await cfg.update('contrastMode', profile.contrastMode, target);
  await cfg.update('contrastStrength', profile.contrastStrength, target);
  await cfg.update('rainbowBrackets', profile.rainbowBrackets, target);
  await cfg.update('rainbowIndents', profile.rainbowIndents, target);
  await cfg.update('bracketShapeHints', profile.bracketShapeHints, target);
  await cfg.update('warmthBias', profile.warmthBias, target);
  await cfg.update('customPalettes', profile.customPalettes ?? {}, target);
  await cfg.update('fontOverride', profile.fontOverride, target);
  await cfg.update('fontSizeOverride', profile.fontSizeOverride, target);
  await cfg.update('lineHeightOverride', profile.lineHeightOverride, target);
  await cfg.update('letterSpacingOverride', profile.letterSpacingOverride, target);
  await cfg.update('activeProfile', profile.name, target);
}

// Built-in starter profiles
export const BUILT_IN_PROFILES: Omit<DathProfile, 'name'>[] = [
  {
    cvdMode: 'deuteranopia',
    cvdSeverity: 1.0,
    contrastMode: 'soften',
    contrastStrength: 0.5,
    rainbowBrackets: true,
    rainbowIndents: false,
    bracketShapeHints: true,
    warmthBias: 0,
    customPalettes: {},
    fontOverride: 'none',
    fontSizeOverride: 0,
    lineHeightOverride: 0,
    letterSpacingOverride: 0
  },
  {
    cvdMode: 'protanopia',
    cvdSeverity: 1.0,
    contrastMode: 'none',
    contrastStrength: 0.5,
    rainbowBrackets: true,
    rainbowIndents: false,
    bracketShapeHints: true,
    warmthBias: 0,
    customPalettes: {},
    fontOverride: 'none',
    fontSizeOverride: 0,
    lineHeightOverride: 0,
    letterSpacingOverride: 0
  },
  {
    cvdMode: 'none',
    cvdSeverity: 1.0,
    contrastMode: 'soften',
    contrastStrength: 0.7,
    rainbowBrackets: false,
    rainbowIndents: false,
    bracketShapeHints: false,
    warmthBias: 0,
    customPalettes: {},
    fontOverride: 'Atkinson Hyperlegible',
    fontSizeOverride: 0,
    lineHeightOverride: 1.6,
    letterSpacingOverride: 0.5
  }
];
