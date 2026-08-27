import { Injectable, signal } from '@angular/core';
import { DemoSession, DemoUser } from '../models/demo';

@Injectable({ providedIn: 'root' })
export class DemoSessionStore {
  private readonly key = 'nexo.local-demo.session';
  readonly token = signal<string | null>(this.read());
  readonly user = signal<DemoUser | null>(null);

  start(session: DemoSession): void {
    this.token.set(session.token);
    this.user.set(session.user);
    try {
      sessionStorage.setItem(this.key, session.token);
    } catch {
      /* Memory-only session if storage is unavailable. */
    }
  }
  clear(): void {
    this.token.set(null);
    this.user.set(null);
    try {
      sessionStorage.removeItem(this.key);
    } catch {
      /* No persisted session to clear. */
    }
  }
  private read(): string | null {
    try {
      return sessionStorage.getItem(this.key);
    } catch {
      return null;
    }
  }
}
