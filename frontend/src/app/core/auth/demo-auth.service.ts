import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSession, DemoUser } from '../models/demo';
import { DemoSessionStore } from './demo-session.store';

@Injectable({ providedIn: 'root' })
export class DemoAuthService {
  private readonly http = inject(HttpClient);
  readonly session = inject(DemoSessionStore);
  private pendingRestore: Promise<boolean> | null = null;
  readonly base = environment.apiUrl + '/demo';

  choices() {
    return this.http.get<DemoUser[]>(this.base + '/users');
  }
  async login(userId: string): Promise<void> {
    const session = await firstValueFrom(
      this.http.post<DemoSession>(this.base + '/sessions', { userId }),
    );
    this.session.start(session);
  }
  restore(): Promise<boolean> {
    if (this.session.user()) return Promise.resolve(true);
    if (!this.session.token()) return Promise.resolve(false);
    this.pendingRestore ??= firstValueFrom(this.http.get<DemoUser>(this.base + '/me'))
      .then((user) => {
        this.session.user.set(user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.pendingRestore = null;
      });
    return this.pendingRestore;
  }
  async logout(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete<void>(this.base + '/sessions/current'));
      return true;
    } catch {
      return false;
    } finally {
      this.session.clear();
    }
  }
}
