import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';

export const localAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(DemoSessionStore);
  const router = inject(Router);
  const url = new URL(request.url, window.location.origin);
  const api = new URL(environment.apiUrl, window.location.origin);
  const publicRequest =
    url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/register');
  if (url.origin !== api.origin || !url.pathname.startsWith(api.pathname) || publicRequest)
    return next(request);
  const token = store.token();
  const outgoing =
    token && !request.headers.has('Authorization')
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;
  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !url.pathname.endsWith('/users/me')
      ) {
        store.clear();
        void router.navigate(['/login'], { queryParams: { reason: 'expired' } });
      }
      return throwError(() => error);
    }),
  );
};
