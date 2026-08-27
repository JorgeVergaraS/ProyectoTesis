import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DemoAuthService } from '../auth/demo-auth.service';

export const demoGuard: CanActivateFn = async () => {
  const auth = inject(DemoAuthService);
  const router = inject(Router);
  return (await auth.restore()) ? true : router.createUrlTree(['/login']);
};
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(DemoAuthService);
  const router = inject(Router);
  return (await auth.restore()) ? router.createUrlTree(['/home']) : true;
};
