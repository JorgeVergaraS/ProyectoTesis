import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { from, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';

export const msalAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(DemoSessionStore);
  const msal = inject(MsalService);
  const url = new URL(request.url, window.location.origin);
  const api = new URL(environment.apiUrl, window.location.origin);
  const localAuthEndpoint = url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/register');
  if (localAuthEndpoint || store.token() || url.origin !== api.origin || !url.pathname.startsWith(api.pathname)) return next(request);
  const account = msal.instance.getActiveAccount() ?? msal.instance.getAllAccounts()[0];
  if (!account) return next(request);
  return msal.acquireTokenSilent({ account, scopes: [environment.azure.apiScope] }).pipe(
    switchMap((result) => next(request.clone({ setHeaders: { Authorization: `Bearer ${result.accessToken}` } }))),
    catchError(() => next(request)),
  );
};
