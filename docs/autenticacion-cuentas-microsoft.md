# Inicio de sesión con cuentas Microsoft

Nexo usa MSAL para pedir un access token delegado para `api://0f2d7cee-cabb-4482-900d-64fb07f5f81d/access_as_user`. El cliente usa la autoridad `https://login.microsoftonline.com/common`, que permite seleccionar cuentas organizacionales o cuentas Microsoft personales.

## Registros de Entra requeridos

Configura ambos registros, **Nexo Frontend** (`480a8cf4-c729-4ca1-8043-6c1198dfaceb`) y **Nexo Web** (`0f2d7cee-cabb-4482-900d-64fb07f5f81d`), con el tipo de cuenta **cualquier directorio de Microsoft Entra y cuentas personales de Microsoft**. El registro de Nexo Frontend debe mantener los redirect URI de plataforma SPA usados por cada entorno. En el manifiesto del registro del API, `api.requestedAccessTokenVersion` debe ser `2`.

El consentimiento delegado a `access_as_user` puede requerir aprobación del administrador de una organización externa según sus políticas. Una cuenta personal no necesita pertenecer al tenant original de Nexo.

## Validación del lado servidor

El API comprueba la firma con las claves públicas comunes de Microsoft, valida el audience y el scope delegado y exige que el issuer sea el issuer v2 o v1 del `tid` firmado. El API Gateway aplica las mismas reglas antes de entregar el token al backend. Los usuarios de Entra se identifican con la combinación `tid:oid`, ya que los object IDs pertenecen a un tenant y por sí solos no identifican globalmente una cuenta.

El `tid` y el `oid` provienen únicamente de access tokens Entra válidos. No se acepta una dirección de correo como clave de identidad ni se confía en datos de perfil enviados por el navegador.

## Comprobación

Prueba una cuenta institucional, una cuenta de otro directorio y una cuenta personal Microsoft. En cada caso comprueba que MSAL reciba el access token del API, que una llamada autenticada a `/api/users/me` responda correctamente y que un token con issuer, audience o scope alterado sea rechazado. Los usuarios externos podrían tener que aceptar el consentimiento delegado antes de su primer ingreso.
