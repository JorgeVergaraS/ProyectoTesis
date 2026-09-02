import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { msalAuthInterceptor } from './msal-auth.interceptor';

describe('msalAuthInterceptor', () => {
  const account = { homeAccountId: 'home', username: 'user@nexo.cl' } as AccountInfo;
  const msal = {
    instance: {
      getActiveAccount: vi.fn().mockReturnValue(account),
      getAllAccounts: vi.fn().mockReturnValue([account]),
    },
    acquireTokenSilent: vi
      .fn()
      .mockReturnValue(of({ accessToken: 'microsoft-token-redacted' } as AuthenticationResult)),
  };
  let http: HttpClient;
  let control: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([msalAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: MsalService, useValue: msal },
      ],
    });
    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
  });

  afterEach(() => control.verify());

  it('uses acquireTokenSilent and sends Bearer only to the Nexo API', () => {
    http.get('/api/users/me').subscribe();
    const request = control.expectOne('/api/users/me');
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({
      account,
      scopes: [environment.azure.apiScope],
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer microsoft-token-redacted');
    request.flush({});

    http.get('https://untrusted.example/api/users/me').subscribe();
    const outside = control.expectOne('https://untrusted.example/api/users/me');
    expect(outside.request.headers.has('Authorization')).toBe(false);
    outside.flush({});
  });
});
