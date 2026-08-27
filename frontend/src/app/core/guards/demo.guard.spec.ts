import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { DemoAuthService } from '../auth/demo-auth.service';
import { demoGuard, guestGuard } from './demo.guard';

describe('demo route guards', () => {
  const auth = { restore: vi.fn() };
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DemoAuthService, useValue: auth }],
    }),
  );
  it('redirects anonymous users to login', async () => {
    auth.restore.mockResolvedValue(false);
    const result = await TestBed.runInInjectionContext(() =>
      demoGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as import('@angular/router').UrlTree)).toBe(
      '/login',
    );
  });
  it('allows authenticated users into the workspace', async () => {
    auth.restore.mockResolvedValue(true);
    expect(
      await TestBed.runInInjectionContext(() =>
        demoGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
  it('redirects an authenticated login visit to home', async () => {
    auth.restore.mockResolvedValue(true);
    const result = await TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as import('@angular/router').UrlTree)).toBe(
      '/home',
    );
  });
});
