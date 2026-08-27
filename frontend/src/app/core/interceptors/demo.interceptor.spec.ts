import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DemoSessionStore } from '../auth/demo-session.store';
import { demoInterceptor } from './demo.interceptor';

describe('demoInterceptor', () => {
  let http: HttpClient;
  let control: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([demoInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    TestBed.inject(DemoSessionStore).token.set('demo-only');
    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
  });
  afterEach(() => control.verify());
  it('adds the demo session only to this API', () => {
    http.get('/api/demo/workspace').subscribe();
    const own = control.expectOne('/api/demo/workspace');
    expect(own.request.headers.get('Authorization')).toBe('Bearer demo-only');
    own.flush({});
    http.get('https://untrusted.example/api/demo/workspace').subscribe();
    const outside = control.expectOne('https://untrusted.example/api/demo/workspace');
    expect(outside.request.headers.has('Authorization')).toBe(false);
    outside.flush({});
  });
  it('never attaches a stale session to the login request', () => {
    http.post('/api/demo/sessions', { userId: 'jorge' }).subscribe();
    const request = control.expectOne('/api/demo/sessions');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
