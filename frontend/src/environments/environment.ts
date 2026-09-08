export const environment = {
  production: false,
  apiUrl: '/api',
  voiceIceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  azure: {
    clientId: '480a8cf4-c729-4ca1-8043-6c1198dfaceb',
    tenantId: '21a4bbb2-fc48-4053-a98e-b805aa2306cc',
    apiClientId: '0f2d7cee-cabb-4482-900d-64fb07f5f81d',
    apiScope: 'api://0f2d7cee-cabb-4482-900d-64fb07f5f81d/access_as_user',
    authority: 'https://login.microsoftonline.com/21a4bbb2-fc48-4053-a98e-b805aa2306cc',
    redirectUri: 'http://localhost:4200',
  },
} as const;
