export const environment = {
  production: true,
  apiUrl: '/api',
  azure: {
    clientId: 'YOUR_FRONTEND_CLIENT_ID',
    tenantId: 'YOUR_TENANT_ID',
    apiClientId: 'YOUR_API_CLIENT_ID',
    apiScope: 'api://YOUR_API_CLIENT_ID/access_as_user',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: 'https://YOUR_FRONTEND_HOST',
  },
} as const;
