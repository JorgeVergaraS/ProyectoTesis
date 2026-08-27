import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DemoAuthService } from './demo-auth.service';
import { DemoSessionStore } from './demo-session.store';

describe('DemoAuthService', () => {
  let auth: DemoAuthService;
  let http: HttpTestingController;
  const user = {
    id: 'jorge-id',
    username: 'jorge',
    displayName: 'Jorge',
    color: '#8b5cf6',
    bio: 'Demo',
    online: true,
  };
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(DemoAuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('starts a tab-local session and restores the user from the server', async () => {
    const login = auth.login(user.id);
    http
      .expectOne('/api/demo/sessions')
      .flush({ token: 'demo-opaque', expiresAt: '2099-01-01', user });
    await login;
    expect(auth.session.user()?.displayName).toBe('Jorge');
    expect(sessionStorage.getItem('nexo.local-demo.session')).toBe('demo-opaque');
    expect(localStorage.getItem('nexo.local-demo.session')).toBeNull();
    auth.session.user.set(null);
    const restore = auth.restore();
    http.expectOne('/api/demo/me').flush(user);
    expect(await restore).toBe(true);
  });
  it('revokes the server session and clears only this tab', async () => {
    TestBed.inject(DemoSessionStore).start({ token: 'demo', expiresAt: '2099-01-01', user });
    const logout = auth.logout();
    const request = http.expectOne('/api/demo/sessions/current');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(await logout).toBe(true);
    expect(auth.session.token()).toBeNull();
    expect(sessionStorage.getItem('nexo.local-demo.session')).toBeNull();
  });
  it('clears the local session but reports failed server revocation', async () => {
    auth.session.start({ token: 'demo', expiresAt: '2099-01-01', user });
    const logout = auth.logout();
    http
      .expectOne('/api/demo/sessions/current')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    expect(await logout).toBe(false);
    expect(auth.session.token()).toBeNull();
    expect(auth.session.user()).toBeNull();
  });
});
