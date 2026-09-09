# Autenticación Microsoft Entra ID: MSAL y JWT

## Estado validado

El 8 de septiembre de 2026 se registró en **Nexo Frontend**, dentro de
**Default Directory**, la URI SPA estable:

```text
https://34.196.97.226.nip.io
```

Azure mostró `Successfully updated Nexo Frontend` y la URI apareció en la
lista de redirecciones junto con localhost y la dirección histórica. Después
se inició sesión desde la URL pública con `jor.vergaras@duocuc.cl`; Microsoft
retornó a `/home` y Nexo identificó la sesión como **Microsoft Entra ID**.

No fue necesario enviar otra invitación. La invitación enlaza al usuario con
el tenant y no depende de la IP de EC2. El error `401 You don't have access`
observado en Azure ocurrió porque la cuenta Duoc estaba situada en el tenant
institucional al intentar administrar un registro perteneciente a Default
Directory. La administración se realizó con la cuenta propietaria del registro.

## Recorrido de autenticación

```text
Navegador
  -> MSAL loginRedirect con scope de Nexo API
  -> Microsoft Entra ID autentica al usuario
  -> retorno exacto a la URI SPA registrada
  -> MSAL conserva la sesión y obtiene access token silenciosamente
  -> interceptor añade Authorization: Bearer <JWT> solo a /api
  -> Spring Security descarga/usa las claves públicas JWK de Microsoft
  -> valida firma, issuer, audience y vigencia
  -> crea JwtAuthenticationToken y permite o rechaza la operación
```

## Implementación MSAL del frontend

- `msal.config.ts` crea `PublicClientApplication` con el `clientId`, autoridad
  del tenant y `redirectUri` del entorno.
- `auth.service.ts` inicia `loginRedirect` solicitando el scope publicado por
  Nexo API y ejecuta `logoutRedirect` para cerrar la sesión.
- `msal-auth.interceptor.ts` usa `acquireTokenSilent` con la cuenta activa.
- El encabezado Bearer se adjunta solamente a peticiones dirigidas a la API de
  Nexo; no se transmite a dominios externos.
- La aplicación no necesita ni contiene un client secret porque es una SPA
  pública con Authorization Code + PKCE administrado por MSAL.

## Validación JWT del backend

`SecurityConfig.java` configura dos decodificadores separados. Para Microsoft
usa `NimbusJwtDecoder` y el endpoint JWK del tenant. Antes de aceptar el JWT
comprueba:

1. Firma criptográfica con la clave pública cuyo `kid` coincide con el token.
2. Emisor (`iss`) perteneciente al tenant esperado.
3. Audiencia (`aud`) correspondiente a Nexo API.
4. Fechas de emisión y expiración.
5. Scopes o roles convertidos a autoridades de Spring Security.

Un token ausente, manipulado, vencido o destinado a otra audiencia produce
`401 Unauthorized`; un usuario autenticado sin autorización para un recurso
produce `403 Forbidden`.

## Evidencia y pruebas

- Azure: notificación **Successfully updated Nexo Frontend**.
- Azure: URI SPA `https://34.196.97.226.nip.io` visible en Authentication.
- Nexo: retorno exitoso a `/home` con la cuenta Duoc y etiqueta
  **Microsoft Entra ID**.
- Frontend: 22 archivos de prueba y 76 pruebas aprobadas.
- Backend: `SecurityConfigTest` y `AuthIntegrationTests` aprobadas contra
  PostgreSQL efímero mediante Testcontainers.
- La integración comprueba que un Bearer válido accede a recursos protegidos y
  que tokens mal formados o vencidos reciben `401`.

Para una captura segura nunca se publica el JWT completo. Como máximo se pueden
mostrar claims redactados como `iss`, `aud`, `exp`, `scp` y una parte del `sub`;
se deben ocultar el token original, cookies, códigos de autorización y datos
personales no necesarios.

## Guion breve para la presentación

1. Mostrar en Azure la URI SPA registrada.
2. Abrir Nexo en una ventana privada y pulsar **Continuar con Microsoft**.
3. Autenticarse con la cuenta Duoc invitada y comprobar el retorno a `/home`.
4. Señalar la etiqueta **Microsoft Entra ID** en la interfaz.
5. Explicar que MSAL obtiene el access token y el interceptor lo envía como
   Bearer únicamente a Nexo API.
6. Mostrar `SecurityConfig.java` y explicar validación JWK, issuer y audience.
7. Ejecutar las pruebas de autenticación y enseñar el total aprobado.

## Consideraciones operativas

- La URI debe coincidir exactamente, incluidos esquema, puntos y puerto.
- La dirección correcta usa puntos: `34.196.97.226.nip.io`.
- Si cambia el dominio, deben actualizarse Azure, el entorno frontend y CORS.
- El certificado HTTPS es obligatorio para un flujo SPA productivo y para las
  APIs multimedia del navegador.
- La IP elástica evita nuevas modificaciones mientras permanezca asociada a la
  instancia EC2.
