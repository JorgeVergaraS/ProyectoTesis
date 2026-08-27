// Reference for the next phase. Microsoft authentication is not active yet.
// Client and tenant IDs are public configuration; never add a client secret.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  azure: {
    clientId: 'YOUR_FRONTEND_CLIENT_ID',
    tenantId: 'YOUR_TENANT_ID',
    apiClientId: 'YOUR_API_CLIENT_ID',
    redirectUri: 'http://localhost:4200',
    apiScope: 'YOUR_API_SCOPE',
  },
} as const;
