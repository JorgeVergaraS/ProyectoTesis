import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const account = {
    homeAccountId: 'home',
    localAccountId: 'local',
    username: 'user@nexo.cl',
  } as AccountInfo;
  const user = {
    id: 'user-id',
    username: 'user@nexo.cl',
    email: 'user@nexo.cl',
    displayName: 'Nexo User',
    color: '#8b5cf6',
    bio: '',
    online: true,
  };
  const instance = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getActiveAccount: vi.fn().mockReturnValue(null),
    getAllAccounts: vi.fn().mockReturnValue([]),
    setActiveAccount: vi.fn(),
    logoutRedirect: vi.fn().mockResolvedValue(undefined),
  };
  const msal = {
    instance,
    loginRedirect: vi.fn().mockReturnValue(of(undefined)),
  };
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    instance.initialize.mockResolvedValue(undefined);
    instance.getActiveAccount.mockReturnValue(null);
    instance.getAllAccounts.mockReturnValue([]);
    instance.setActiveAccount.mockImplementation((active: AccountInfo | null) =>
      instance.getActiveAccount.mockReturnValue(active),
    );
    msal.loginRedirect.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MsalService, useValue: msal },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('initializes MSAL and starts loginRedirect with the API scope', async () => {
    await auth.login();
    expect(instance.initialize).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: [environment.azure.apiScope] });
  });

  it('sets the redirect account active and restores the Microsoft user', async () => {
    const restore = auth.completeRedirect({ account } as AuthenticationResult);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/users/me').flush(user);
    expect(await restore).toBe(true);
    expect(instance.setActiveAccount).toHaveBeenCalledWith(account);
    expect(auth.session.kind()).toBe('microsoft');
    expect(auth.session.token()).toBeNull();
  });

  it('stores a local session separately from Microsoft', async () => {
    const login = auth.loginLocal({ email: 'user@nexo.cl', password: 'password-8' });
    http.expectOne('/api/auth/login').flush({
      accessToken: 'local-token-redacted',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user,
    });
    await login;
    expect(auth.session.kind()).toBe('local');
    expect(auth.session.token()).toBe('local-token-redacted');
  });

  it('restores and revokes an isolated demo session through demo endpoints', async () => {
    auth.session.start(
      {
        token: 'demo-token-redacted',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user,
      },
      'demo',
    );
    auth.session.user.set(null);

    const restore = auth.restore();
    http.expectOne('/api/demo/me').flush(user);
    expect(await restore).toBe(true);
    expect(auth.session.kind()).toBe('demo');

    const logout = auth.logout();
    http.expectOne('/api/demo/sessions/current').flush(null);
    expect(await logout).toBe(true);
    expect(auth.session.token()).toBeNull();
  });
});
