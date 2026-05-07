/**
 * cvd.ts
 * Colour vision deficiency correction using LMS colour space daltonization.
 * No external dependencies — pure TypeScript implementation.
 *
 * Based on the Brettel, Viénot & Mollon (1997) simulation model and
 * Fidaner et al. daltonization approach.
 */

export type CvdMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'custom' | 'custom1' | 'custom2' | 'custom3';

interface RGB {
  r: number; // 0–255
  g: number;
  b: number;
}

// ── sRGB ↔ Linear ────────────────────────────────────────────────────────────

function linearise(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function delinearise(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

// ── sRGB → LMS (Hunt-Pointer-Estévez, D65) ──────────────────────────────────

function rgbToLms(r: number, g: number, b: number): [number, number, number] {
  const rl = linearise(r);
  const gl = linearise(g);
  const bl = linearise(b);
  return [
    0.4002 * rl + 0.7076 * gl - 0.0808 * bl,
    -0.2263 * rl + 1.1653 * gl + 0.0457 * bl,
    0.9182 * bl
  ];
}

function lmsToRgb(l: number, m: number, s: number): RGB {
  const rl = 3.2406 * l - 1.5372 * m - 0.4986 * s;
  const gl = -0.9689 * l + 1.8758 * m + 0.0415 * s;
  const bl = 0.0557 * l - 0.2040 * m + 1.0570 * s;
  return { r: delinearise(rl), g: delinearise(gl), b: delinearise(bl) };
}

// ── CVD Simulation matrices (LMS space) ─────────────────────────────────────
// These matrices zero out the missing channel then reconstruct a simulated
// perception, giving us the "error" we need to correct.

const SIMULATION: Record<CvdMode, (l: number, m: number, s: number) => [number, number, number]> = {
  none: (l, m, s) => [l, m, s],
  // Deuteranopia: M cone missing — derive M from L and S
  deuteranopia: (l, _m, s) => [l, 0.494207 * l + 1.24827 * s, s],
  // Protanopia: L cone missing — derive L from M and S
  protanopia: (_l, m, s) => [0.55842 * m - 0.03487 * s, m, s],
  // Tritanopia: S cone missing — derive S from L and M
  tritanopia: (l, m, _s) => [l, m, -0.01224 * l + 0.05756 * m],
  custom: (l, m, s) => [l, m, s],
  custom1: (l, m, s) => [l, m, s],
  custom2: (l, m, s) => [l, m, s],
  custom3: (l, m, s) => [l, m, s]
};

// ── Daltonization ────────────────────────────────────────────────────────────
// 1. Simulate what the CVD user sees
// 2. Compute the error vs. normal vision
// 3. Shift the error into channels the user CAN perceive
// 4. Apply at requested severity (0.1–1.0)

const ERROR_SHIFT: Record<CvdMode, (errR: number, errG: number, errB: number) => RGB> = {
  none: (r, g, b) => ({ r, g, b }),
  // Deuteranopia (M/green cone missing): encode lost green info into blue — deuteranopes see blue well
  deuteranopia: (_r, g, _b) => ({ r: 0, g: 0, b: 0.7 * g }),
  // Protanopia (L/red cone missing): encode lost red info into blue — protanopes see blue well
  protanopia: (r, _g, _b) => ({ r: 0, g: 0, b: 0.7 * r }),
  // Tritanopia (S/blue cone missing): encode lost blue info into green — tritanopes see green well
  tritanopia:   (_r, _g, b) => ({ r: 0, g: 0.7 * b, b: 0 }),
  custom:       (r, g, b) => ({ r, g, b }),
  custom1:      (r, g, b) => ({ r, g, b }),
  custom2:      (r, g, b) => ({ r, g, b }),
  custom3:      (r, g, b) => ({ r, g, b })
};

export function correctColour(hex: string, mode: CvdMode, severity: number = 1.0): string {
  if (mode === 'none') return hex;

  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const { r, g, b } = rgb;

  // Simulate CVD perception
  const [l, m, s] = rgbToLms(r, g, b);
  const [ls, ms, ss] = SIMULATION[mode](l, m, s);
  const simulated = lmsToRgb(ls, ms, ss);

  // Compute error
  const errR = r - simulated.r;
  const errG = g - simulated.g;
  const errB = b - simulated.b;

  // Shift error into perceivable channels
  const shift = ERROR_SHIFT[mode](errR, errG, errB);

  // Apply correction at requested severity
  const corrected: RGB = {
    r: Math.round(Math.min(255, Math.max(0, r + shift.r * severity))),
    g: Math.round(Math.min(255, Math.max(0, g + shift.g * severity))),
    b: Math.round(Math.min(255, Math.max(0, b + shift.b * severity)))
  };

  return rgbToHex(corrected);
}

// ── Contrast comfort ─────────────────────────────────────────────────────────

export type ContrastMode = 'none' | 'soften' | 'warm' | 'cool' | 'dim';

export function adjustContrast(hex: string, mode: ContrastMode, strength: number = 0.5): string {
  if (mode === 'none') return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  let { r, g, b } = rgb;

  switch (mode) {
    case 'soften': {
      // Lift pure whites and near-whites toward a warm off-white
      // Strength controls how much we lift toward #F5F0E8
      const targetR = 245, targetG = 240, targetB = 232;
      const brightness = (r + g + b) / 3;
      const factor = Math.max(0, (brightness - 200) / 55) * strength;
      r = Math.round(r + (targetR - r) * factor);
      g = Math.round(g + (targetG - g) * factor);
      b = Math.round(b + (targetB - b) * factor);
      break;
    }
    case 'warm': {
      r = Math.min(255, Math.round(r + 8 * strength));
      b = Math.max(0, Math.round(b - 10 * strength));
      break;
    }
    case 'cool': {
      b = Math.min(255, Math.round(b + 8 * strength));
      r = Math.max(0, Math.round(r - 8 * strength));
      break;
    }
    case 'dim': {
      const factor = 1 - (0.15 * strength);
      r = Math.round(r * factor);
      g = Math.round(g * factor);
      b = Math.round(b * factor);
      break;
    }
  }

  return rgbToHex({ r, g, b });
}

// ── Warmth bias ──────────────────────────────────────────────────────────────

export function adjustWarmth(hex: string, bias: number): string {
  if (bias === 0) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let { r, g, b } = rgb;
  const abs = Math.abs(bias);
  if (bias > 0) {
    r = Math.min(255, Math.round(r + 18 * abs));
    b = Math.max(0, Math.round(b - 22 * abs));
  } else {
    b = Math.min(255, Math.round(b + 18 * abs));
    r = Math.max(0, Math.round(r - 10 * abs));
  }
  return rgbToHex({ r, g, b });
}

// ── Bracket palettes ─────────────────────────────────────────────────────────
// CVD-safe rainbow bracket colours — use shape+colour, not colour alone.
// These are distinguishable under deuteranopia, protanopia, and tritanopia.

export const BRACKET_PALETTES: Record<CvdMode | 'default', string[]> = {
  default: ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347'],
  deuteranopia: ['#FFD700', '#0072B2', '#E69F00', '#56B4E9', '#F0E442', '#CC79A7'],
  protanopia:   ['#FFD700', '#0072B2', '#56B4E9', '#F0E442', '#CC79A7', '#009E73'],
  tritanopia:   ['#E69F00', '#D55E00', '#CC79A7', '#F0E442', '#009E73', '#0072B2'],
  none:         ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347'],
  custom:       ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347'],
  custom1:      ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347'],
  custom2:      ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347'],
  custom3:      ['#FFD700', '#DA70D6', '#179FFF', '#FF6B6B', '#98FB98', '#FFB347']
};

// ── Utilities ────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return null;
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function isHex(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
}
