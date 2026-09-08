// Public configuration only. Never add a client secret to Angular.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  voiceIceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  azure: {
    clientId: 'YOUR_FRONTEND_CLIENT_ID',
    tenantId: 'YOUR_TENANT_ID',
    apiClientId: 'YOUR_API_CLIENT_ID',
    redirectUri: 'http://localhost:4200',
    apiScope: 'api://YOUR_API_CLIENT_ID/access_as_user',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
  },
} as const;
