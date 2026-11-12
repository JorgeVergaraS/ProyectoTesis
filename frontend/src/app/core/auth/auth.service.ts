import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from './demo-session.store';
import { DemoUser } from '../models/demo';

export interface LocalCredentials {
  email: string;
  password: string;
}
export interface LocalRegistration extends LocalCredentials {
  displayName: string;
}
export interface LocalAuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: DemoUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);
  readonly session = inject(DemoSessionStore);
  private initialization: Promise<void> | null = null;
  private pendingRestore: Promise<boolean> | null = null;
  private readonly profileSyncs = new Map<string, Promise<void>>();

  get isConfigured(): boolean {
    return ![
      environment.azure.clientId,
      environment.azure.tenantId,
      environment.azure.apiClientId,
      environment.azure.apiScope,
    ].some((value) => value.startsWith('YOUR_'));
  }

  async login(): Promise<void> {
    if (!this.isConfigured) throw new Error('MSAL is not configured');
    await this.initialize();
    this.session.clear();
    await firstValueFrom(this.msal.loginRedirect({ scopes: [environment.azure.apiScope] }));
  }

  async loginLocal(credentials: LocalCredentials): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LocalAuthResponse>(environment.apiUrl + '/auth/login', credentials),
    );
    this.session.start(
      {
        token: response.accessToken,
        expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
        user: response.user,
      },
      'local',
    );
  }

  async registerLocal(registration: LocalRegistration): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LocalAuthResponse>(environment.apiUrl + '/auth/register', registration),
    );
    this.session.start(
      {
        token: response.accessToken,
        expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
        user: response.user,
      },
      'local',
    );
  }

  async restore(): Promise<boolean> {
    if (this.session.user()) return true;
    this.pendingRestore ??= this.restoreSession().finally(() => (this.pendingRestore = null));
    return this.pendingRestore;
  }

  async completeRedirect(result: AuthenticationResult | null): Promise<boolean> {
    await this.initialize();
    if (result?.account) this.msal.instance.setActiveAccount(result.account);
    return this.restore();
  }

  async logout(): Promise<boolean> {
    if (this.session.kind() === 'demo') {
      try {
        await firstValueFrom(this.http.delete<void>(environment.apiUrl + '/demo/sessions/current'));
        return true;
      } catch {
        return false;
      } finally {
        this.session.clear();
      }
    }
    const microsoftAccount =
      this.session.kind() === 'microsoft' ? await this.getActiveAccount() : null;
    this.session.clear();
    if (!microsoftAccount) return true;
    await this.msal.instance.logoutRedirect({
      account: microsoftAccount,
      postLogoutRedirectUri: environment.azure.redirectUri,
    });
    return true;
  }

  private async restoreSession(): Promise<boolean> {
    if (this.session.token()) {
      try {
        const profilePath = this.session.kind() === 'demo' ? '/demo/me' : '/users/me';
        const user = await firstValueFrom(
          this.http.get<DemoUser>(environment.apiUrl + profilePath),
        );
        this.session.user.set(user);
        if (this.session.kind() !== 'demo') this.session.kind.set('local');
        return true;
      } catch {
        this.session.clear();
        return false;
      }
    }
    if (!this.isConfigured) return false;
    const account = await this.getActiveAccount();
    if (!account) return false;
    // Render from the verified Entra account first. Profile synchronization can be slow on
    // cold starts, so let the authenticated shell appear while /users/me hydrates Nexo data.
    this.session.setMicrosoftUser(this.userFromAccount(account));
    void this.refreshMicrosoftProfile(account);
    return true;
  }

  private userFromAccount(account: AccountInfo): DemoUser {
    const claims = (account.idTokenClaims ?? {}) as Record<string, unknown>;
    const claim = (key: string) => (typeof claims[key] === 'string' ? (claims[key] as string) : '');
    const username = account.username || claim('preferred_username') || claim('email');
    return {
      id: account.localAccountId || account.homeAccountId,
      username,
      email: claim('email') || username,
      displayName: account.name || claim('name') || username.split('@')[0] || 'Estudiante Nexo',
      color: '#6958d8',
      bio: '',
      availability: 'AVAILABLE',
      online: true,
    };
  }

  private refreshMicrosoftProfile(account: AccountInfo): Promise<void> {
    const existing = this.profileSyncs.get(account.homeAccountId);
    if (existing) return existing;
    const sync = firstValueFrom(this.http.get<DemoUser>(environment.apiUrl + '/users/me'))
      .then((user) => {
        const active = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
        if (active?.homeAccountId === account.homeAccountId) this.session.setMicrosoftUser(user);
      })
      .catch((error: unknown) => {
        const details = error as { status?: number; name?: string };
        console.error(
          'Microsoft profile sync failed',
          JSON.stringify({ status: details?.status, name: details?.name }),
        );
      })
      .finally(() => this.profileSyncs.delete(account.homeAccountId));
    this.profileSyncs.set(account.homeAccountId, sync);
    return sync;
  }

  private initialize(): Promise<void> {
    this.initialization ??= this.msal.instance.initialize();
    return this.initialization;
  }

  private async getActiveAccount(): Promise<AccountInfo | null> {
    await this.initialize();
    const active = this.msal.instance.getActiveAccount();
    if (active) return active;
    const account = this.msal.instance.getAllAccounts()[0] ?? null;
    if (account) this.msal.instance.setActiveAccount(account);
    return account;
  }
}
