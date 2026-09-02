import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoSessionStore } from '../auth/demo-session.store';
import { localAuthInterceptor } from './local-auth.interceptor';

describe('localAuthInterceptor', () => {
  let http: HttpClient;
  let control: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([localAuthInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    TestBed.inject(DemoSessionStore).token.set('local-token-redacted');
    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    control.verify();
    sessionStorage.clear();
  });

  it('adds the local Bearer token to protected Nexo API requests', () => {
    http.get('/api/users/me').subscribe();
    const request = control.expectOne('/api/users/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer local-token-redacted');
    request.flush({});
  });

  it('never adds a token to local login', () => {
    http.post('/api/auth/login', {}).subscribe();
    const request = control.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
