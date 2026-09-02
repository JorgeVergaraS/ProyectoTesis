import { Injectable, signal } from '@angular/core';
import { AuthSessionKind, DemoSession, DemoUser } from '../models/demo';

@Injectable({ providedIn: 'root' })
export class DemoSessionStore {
  private readonly tokenKey = 'nexo.auth.local-token';
  private readonly kindKey = 'nexo.auth.session-kind';
  readonly token = signal<string | null>(this.read(this.tokenKey));
  readonly kind = signal<AuthSessionKind | null>(this.readKind());
  readonly user = signal<DemoUser | null>(null);

  start(session: DemoSession, kind: Exclude<AuthSessionKind, 'microsoft'> = 'demo'): void {
    this.token.set(session.token);
    this.kind.set(kind);
    this.user.set(session.user);
    try {
      sessionStorage.setItem(this.tokenKey, session.token);
      sessionStorage.setItem(this.kindKey, kind);
    } catch {
      /* Memory-only session if storage is unavailable. */
    }
  }

  setMicrosoftUser(user: DemoUser): void {
    this.token.set(null);
    this.kind.set('microsoft');
    this.user.set(user);
    try {
      sessionStorage.removeItem(this.tokenKey);
      sessionStorage.removeItem('nexo.local-demo.session');
      sessionStorage.setItem(this.kindKey, 'microsoft');
    } catch {
      /* MSAL remains the source of truth if storage is unavailable. */
    }
  }

  clear(): void {
    this.token.set(null);
    this.kind.set(null);
    this.user.set(null);
    try {
      sessionStorage.removeItem(this.tokenKey);
      sessionStorage.removeItem(this.kindKey);
      sessionStorage.removeItem('nexo.local-demo.session');
    } catch {
      /* No persisted session to clear. */
    }
  }

  private read(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? sessionStorage.getItem('nexo.local-demo.session');
    } catch {
      return null;
    }
  }

  private readKind(): AuthSessionKind | null {
    try {
      const kind = sessionStorage.getItem(this.kindKey);
      if (kind === 'demo' || kind === 'local' || kind === 'microsoft') return kind;
      return sessionStorage.getItem('nexo.local-demo.session') ? 'demo' : null;
    } catch {
      return null;
    }
  }
}
