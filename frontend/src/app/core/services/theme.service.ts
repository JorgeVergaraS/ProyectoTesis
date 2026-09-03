import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type NexoTheme = 'default' | 'oled' | 'light';
export type NexoButtonStyle = 'matte' | 'sky-glass' | 'y2k';

const THEME_STORAGE_KEY = 'nexo-theme';
const BUTTON_STYLE_STORAGE_KEY = 'nexo-button-style';
const THEMES: readonly NexoTheme[] = ['default', 'oled', 'light'];
const BUTTON_STYLES: readonly NexoButtonStyle[] = ['matte', 'sky-glass', 'y2k'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly current = signal<NexoTheme>(this.savedTheme());
  readonly buttonStyle = signal<NexoButtonStyle>(this.savedButtonStyle());

  constructor() {
    this.applyTheme(this.current());
    this.applyButtonStyle(this.buttonStyle());
  }

  select(theme: NexoTheme): void {
    this.current.set(theme);
    this.applyTheme(theme);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The visual preference still applies when browser storage is unavailable.
    }
  }

  selectButtonStyle(style: NexoButtonStyle): void {
    this.buttonStyle.set(style);
    this.applyButtonStyle(style);
    try {
      this.document.defaultView?.localStorage.setItem(BUTTON_STYLE_STORAGE_KEY, style);
    } catch {
      // The visual preference still applies when browser storage is unavailable.
    }
  }

  private savedTheme(): NexoTheme {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return THEMES.includes(saved as NexoTheme) ? (saved as NexoTheme) : 'default';
    } catch {
      return 'default';
    }
  }

  private savedButtonStyle(): NexoButtonStyle {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(BUTTON_STYLE_STORAGE_KEY);
      return BUTTON_STYLES.includes(saved as NexoButtonStyle)
        ? (saved as NexoButtonStyle)
        : 'matte';
    } catch {
      return 'matte';
    }
  }

  private applyTheme(theme: NexoTheme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }

  private applyButtonStyle(style: NexoButtonStyle): void {
    this.document.documentElement.dataset['buttonStyle'] = style;
  }
}
