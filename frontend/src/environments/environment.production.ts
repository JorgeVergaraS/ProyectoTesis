interface PublicNexoConfig {
  apiUrl?: string;
  clientId?: string;
  tenantId?: string;
  apiClientId?: string;
  redirectUri?: string;
}
const config = (window as Window & { NEXO_CONFIG?: PublicNexoConfig }).NEXO_CONFIG ?? {};
const tenant = config.tenantId ?? '21a4bbb2-fc48-4053-a98e-b805aa2306cc';
const apiClient = config.apiClientId ?? '0f2d7cee-cabb-4482-900d-64fb07f5f81d';
export const environment = {
  production: true,
  apiUrl: config.apiUrl ?? '/api',
  voiceIceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  voiceIceTransportPolicy: 'all' as RTCIceTransportPolicy,
  azure: {
    clientId: config.clientId ?? '480a8cf4-c729-4ca1-8043-6c1198dfaceb',
    tenantId: tenant,
    apiClientId: apiClient,
    apiScope: `api://${apiClient}/access_as_user`,
    // The app registration must be configured for Entra work/school and personal accounts.
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: config.redirectUri ?? window.location.origin,
  },
} as const;
