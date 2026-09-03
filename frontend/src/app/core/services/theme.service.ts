import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type NexoTheme = 'default' | 'oled' | 'light';

const STORAGE_KEY = 'nexo-theme';
const THEMES: readonly NexoTheme[] = ['default', 'oled', 'light'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly current = signal<NexoTheme>(this.savedTheme());

  constructor() {
    this.apply(this.current());
  }

  select(theme: NexoTheme): void {
    this.current.set(theme);
    this.apply(theme);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The visual preference still applies when browser storage is unavailable.
    }
  }

  private savedTheme(): NexoTheme {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return THEMES.includes(saved as NexoTheme) ? (saved as NexoTheme) : 'default';
    } catch {
      return 'default';
    }
  }

  private apply(theme: NexoTheme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }
}
