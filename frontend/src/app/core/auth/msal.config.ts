import { InjectionToken } from '@angular/core';
import {
  BrowserCacheLocation,
  IPublicClientApplication,
  InteractionType,
  PublicClientApplication,
} from '@azure/msal-browser';
import { MsalInterceptorConfiguration, MsalGuardConfiguration } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';

export const MSAL_CONFIGURED = new InjectionToken<boolean>('MSAL_CONFIGURED');

export function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.azure.clientId,
      authority: environment.azure.authority,
      redirectUri: environment.azure.redirectUri,
      postLogoutRedirectUri: environment.azure.redirectUri,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.SessionStorage,
    },
  });
}

export function msalGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: { scopes: [environment.azure.apiScope] },
  };
}

export function msalInterceptorConfigFactory(): MsalInterceptorConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap: new Map([[environment.apiUrl, [environment.azure.apiScope]]]),
  };
}
