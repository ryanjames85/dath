/**
 * bracketDecorator.ts
 * Rainbow bracket colouring and shape hints via editor decoration types.
 * This bypasses workbench.colorCustomizations so it works regardless of
 * whether another extension (e.g. Catppuccin) manages that setting.
 */

import * as vscode from 'vscode';

const OPEN  = new Set(['{', '[', '(']);
const CLOSE = new Set(['}', ']', ')']);
const PAIR  = new Map([['}', '{'], [']', '['], [')', '(']]);

/** Parse all bracket positions in a document, grouped by nesting depth mod n. */
function parseBrackets(doc: vscode.TextDocument, n: number): vscode.Range[][] {
  const text = doc.getText();
  const result: vscode.Range[][] = Array.from({ length: n }, () => []);
  const stack: { char: string; depth: number }[] = [];
  let i = 0;
  const len = text.length;

  const mkRange = (offset: number): vscode.Range => {
    const pos = doc.positionAt(offset);
    return new vscode.Range(pos, pos.translate(0, 1));
  };

  while (i < len) {
    const c = text[i];

    // Line comment
    if (c === '/' && text[i + 1] === '/') {
      while (i < len && text[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String / template literal — skip content (template expressions lose bracket
    // coloring inside ${...}, acceptable for a first pass)
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < len && text[i] !== q) {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    if (OPEN.has(c)) {
      const depth = stack.length % n;
      stack.push({ char: c, depth });
      result[depth].push(mkRange(i));
    } else if (CLOSE.has(c) && stack.length > 0 && PAIR.get(c) === stack[stack.length - 1].char) {
      const { depth } = stack.pop()!;
      result[depth].push(mkRange(i));
    }

    i++;
  }

  return result;
}

export class BracketDecorator {
  private colourTypes: vscode.TextEditorDecorationType[] = [];
  private underlineType: vscode.TextEditorDecorationType | undefined;
  private subs: vscode.Disposable[] = [];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * @param palette  Hex colour strings — one per nesting level (cycles).
   * @param colorize Apply rainbow colours (false = shape hints only).
   * @param shapeHints Underline all bracket characters.
   */
  apply(palette: string[], colorize: boolean, shapeHints: boolean): void {
    this.clear();
    if (!colorize && !shapeHints) return;

    if (colorize) {
      this.colourTypes = palette.map(c =>
        vscode.window.createTextEditorDecorationType({ color: c })
      );
    }
    if (shapeHints) {
      this.underlineType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'underline'
      });
    }

    for (const ed of vscode.window.visibleTextEditors) this.decorate(ed);

    this.subs.push(
      vscode.window.onDidChangeActiveTextEditor(ed => { if (ed) this.decorate(ed); }),
      vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(ed => this.decorate(ed))),
      vscode.workspace.onDidChangeTextDocument(ev => {
        vscode.window.visibleTextEditors
          .filter(ed => ed.document.uri.toString() === ev.document.uri.toString())
          .forEach(ed => this.schedule(ed));
      })
    );
  }

  private schedule(ed: vscode.TextEditor): void {
    const key = ed.document.uri.toString();
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(key, setTimeout(() => { this.timers.delete(key); this.decorate(ed); }, 150));
  }

  private decorate(ed: vscode.TextEditor): void {
    const n = this.colourTypes.length || 1;
    const byDepth = parseBrackets(ed.document, n);

    this.colourTypes.forEach((t, i) => ed.setDecorations(t, byDepth[i]));

    if (this.underlineType) {
      ed.setDecorations(this.underlineType, byDepth.flat());
    }
  }

  clear(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();

    for (const ed of vscode.window.visibleTextEditors) {
      this.colourTypes.forEach(t => ed.setDecorations(t, []));
      if (this.underlineType) ed.setDecorations(this.underlineType, []);
    }

    this.colourTypes.forEach(t => t.dispose());
    this.colourTypes = [];
    this.underlineType?.dispose();
    this.underlineType = undefined;

    this.subs.forEach(s => s.dispose());
    this.subs = [];
  }
}
