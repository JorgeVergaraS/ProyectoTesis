import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.session?.token?.() && auth.session?.user?.()) return true;
  return (await auth.restore()) ? true : router.createUrlTree(['/login']);
};
export const demoGuard = authGuard;
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.restore()) ? router.createUrlTree(['/home']) : true;
};
