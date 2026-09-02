# Nexo — flujo frontend MSAL y JWT

## Objetivo

El frontend Angular protege las rutas privadas y consume el backend usando un token de acceso JWT. La autenticación de Microsoft no se implementa con usuario y contraseña propios: Angular delega la identidad a Microsoft Entra ID mediante `@azure/msal-angular` y `@azure/msal-browser`.

## Flujo implementado

1. En `/login`, el usuario pulsa **Continuar con Microsoft**.
2. `AuthService.login()` inicia `loginRedirect()` de MSAL con el scope de la API Nexo.
3. Microsoft Entra ID autentica al usuario y devuelve un resultado OIDC.
4. MSAL conserva el Access Token en su caché; `AuthService.completeRedirect()` establece la cuenta activa.
5. `MsalAuthInterceptor` obtiene silenciosamente el token con `acquireTokenSilent()` y agrega `Authorization: Bearer <JWT>` a las llamadas a `http://localhost:8080/api`.
6. Spring Boot valida firma, issuer, audience, expiración, scopes y roles.
7. `/api/users/me` devuelve el perfil autenticado; Angular lo guarda en `DemoSessionStore` y lo muestra en Home/Profile.

```text
LoginComponent
  -> AuthService.login()
  -> MSAL redirect
  -> Microsoft Entra ID
  -> Access Token JWT
  -> MsalAuthInterceptor
  -> GET /api/users/me
  -> Spring Resource Server
  -> PostgreSQL / perfil local
```

## Piezas frontend

- `src/app/core/auth/auth.service.ts`: login, logout, restauración de sesión y carga del usuario.
- `src/app/core/interceptors/msal-auth.interceptor.ts`: adjunta el token MSAL sólo a la API configurada.
- `src/app/core/interceptors/local-auth.interceptor.ts`: permite el modo local de desarrollo sin alterar el flujo MSAL.
- `src/app/core/guards/demo.guard.ts`: evita entrar a `/home`, `/profile` y `/status` sin sesión válida.
- `src/app/core/auth/demo-session.store.ts`: señales reactivas para token, expiración y usuario.
- `src/app/features/home/pages/home/home.component.ts`: dashboard autenticado y explicación visual del flujo.

## Configuración sin secretos

Los identificadores públicos se leen desde `src/environments/environment.ts`. Nunca se deben agregar client secrets, contraseñas ni tokens al repositorio. Para otro tenant se reemplazan `clientId`, `tenantId`, `apiClientId`, `apiScope` y `redirectUri` con valores entregados por el administrador de Entra ID.

## Comprobación local

```powershell
cd frontend
npm install
npm run build
npm test
npm start
```

El comando `npm test` ejecuta Vitest mediante el builder de Angular. No se debe agregar `--browsers=ChromeHeadless` salvo que se instale explícitamente un adaptador de navegador Vitest.

## Buenas prácticas

- El backend es la autoridad final: el frontend no valida ni decodifica el JWT para autorizar operaciones.
- Las rutas privadas usan guard; el interceptor sólo agrega credenciales a la API permitida.
- El logout limpia el estado local y, para una cuenta Microsoft, ejecuta `logoutRedirect()`.
- WebSocket/WebRTC sólo aparecen como espacio reservado en la interfaz; no se habilitan en esta etapa.
