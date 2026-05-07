/**
 * statusBar.ts
 * Status bar item showing Dath state and active profile.
 * Click to toggle on/off. Right-click (command) to switch profiles.
 */

import * as vscode from 'vscode';

export class DathStatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.item.command = 'dath.openPanel';
    this.item.show();
  }

  update(enabled: boolean, profileName?: string, cvdMode?: string): void {
    if (!enabled) {
      this.item.text = '$(eye-closed) Dath';
      this.item.tooltip = 'Dath is disabled — click to enable';
      this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      return;
    }

    const label = profileName ? profileName : cvdMode && cvdMode !== 'none' ? cvdMode : 'on';
    this.item.text = `$(eye) Dath: ${label}`;
    this.item.tooltip = `Dath active${profileName ? ` — profile: ${profileName}` : ''}\nClick to toggle · Run "Dath: Switch Profile" to change`;
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}
