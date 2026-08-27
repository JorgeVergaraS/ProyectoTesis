import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';

export const demoInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(DemoSessionStore);
  const router = inject(Router);
  const base = new URL(environment.apiUrl + '/demo/', window.location.origin);
  const url = new URL(request.url, window.location.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return next(request);
  const publicRequest =
    (request.method === 'GET' && url.pathname === base.pathname + 'users') ||
    (request.method === 'POST' && url.pathname === base.pathname + 'sessions');
  const token = store.token();
  const authenticated =
    token && !publicRequest
      ? request.clone({ setHeaders: { Authorization: 'Bearer ' + token } })
      : request;
  return next(authenticated).pipe(
    timeout(10000),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !publicRequest) {
        store.clear();
        void router.navigate(['/login'], { queryParams: { reason: 'expired' } });
      }
      return throwError(() => error);
    }),
  );
};
