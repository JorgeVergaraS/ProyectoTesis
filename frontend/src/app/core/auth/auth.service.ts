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
        const user = await firstValueFrom(
          this.http.get<DemoUser>(environment.apiUrl + '/users/me'),
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
    try {
      const user = await firstValueFrom(this.http.get<DemoUser>(environment.apiUrl + '/users/me'));
      this.session.setMicrosoftUser(user);
      return true;
    } catch (error: unknown) {
      const details = error as { status?: number; name?: string; message?: string; error?: unknown };
      console.error('Microsoft profile sync failed', JSON.stringify({
        status: details?.status,
        name: details?.name,
        message: details?.message,
        error: details?.error,
      }));
      this.session.user.set(null);
      return false;
    }
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
