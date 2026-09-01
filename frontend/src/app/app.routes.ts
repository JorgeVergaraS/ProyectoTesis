import { Routes } from '@angular/router';
import { demoGuard, guestGuard } from './core/guards/demo.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    canActivate: [demoGuard],
    loadComponent: () =>
      import('./features/home/pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'profile',
    canActivate: [demoGuard],
    loadComponent: () =>
      import('./features/home/pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'status',
    loadComponent: () =>
      import('./features/status/pages/status/status.component').then((m) => m.StatusComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
