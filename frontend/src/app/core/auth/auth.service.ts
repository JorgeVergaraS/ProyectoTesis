import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from './demo-session.store';
import { DemoUser } from '../models/demo';

export interface LocalCredentials { email: string; password: string; }
export interface LocalRegistration extends LocalCredentials { displayName: string; }
export interface LocalAuthResponse { accessToken: string; tokenType: string; expiresIn: number; user: DemoUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);
  readonly session = inject(DemoSessionStore);

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
    await this.msal.loginRedirect({ scopes: [environment.azure.apiScope] });
  }

  async loginLocal(credentials: LocalCredentials): Promise<void> {
    const response = await firstValueFrom(this.http.post<LocalAuthResponse>(environment.apiUrl + '/auth/login', credentials));
    this.session.start({ token: response.accessToken, expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(), user: response.user });
  }

  async registerLocal(registration: LocalRegistration): Promise<void> {
    const response = await firstValueFrom(this.http.post<LocalAuthResponse>(environment.apiUrl + '/auth/register', registration));
    this.session.start({ token: response.accessToken, expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(), user: response.user });
  }

  async restore(): Promise<boolean> {
    if (this.session.token()) {
      try { this.session.user.set(await firstValueFrom(this.http.get<DemoUser>(environment.apiUrl + '/users/me'))); return true; }
      catch { this.session.clear(); return false; }
    }
    if (!this.isConfigured) return false;
    const account = this.activeAccount();
    if (!account) return false;
    try {
      const user = await firstValueFrom(this.http.get<DemoUser>(environment.apiUrl + '/users/me'));
      this.session.user.set(user);
      return true;
    } catch {
      this.session.user.set(null);
      return false;
    }
  }

  async completeRedirect(result: AuthenticationResult | null): Promise<void> {
    if (result?.account) this.msal.instance.setActiveAccount(result.account);
    await this.restore();
  }

  async logout(): Promise<boolean> {
    this.session.clear();
    if (!this.activeAccount()) return true;
    await this.msal.logoutRedirect({ postLogoutRedirectUri: environment.azure.redirectUri });
    return true;
  }

  private activeAccount(): AccountInfo | null {
    const active = this.msal.instance.getActiveAccount();
    if (active) return active;
    const account = this.msal.instance.getAllAccounts()[0] ?? null;
    if (account) this.msal.instance.setActiveAccount(account);
    return account;
  }
}
