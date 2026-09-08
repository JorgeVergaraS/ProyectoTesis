# Despliegue cloud: bitácora y criterios de aceptación

Fecha: 8 de septiembre de 2026. Rama: `feat/despliegue-cloud`.

Actualización de alcance: el usuario solicita una entrega académica de bajo costo,
sin dominio propio, con Docker en EC2 y PostgreSQL en RDS. Ver
[diseño EP1 y matriz de evidencia](entrega-ep1-academica.md). RDS también fue
inspeccionado en Chrome: cero bases de datos en `us-east-1`.

## Inspección realizada

- AWS: acceso interactivo confirmado en Chrome, región `us-east-1`.
- Sesión de laboratorio `voclabs`. La tabla EC2 informa que no existen
  instancias en la región. Se abrió el formulario de lanzamiento; no se lanzó
  ninguna instancia ni se modificaron reglas de red.
- Azure: sesión de Brave recuperada en el tenant del proyecto. Se verificaron
  los dos registros, el redirect SPA y la preautorización del scope de la API.
- Login Microsoft, restauración de sesión, perfil HTTP 200 y logout comprobados
  en Brave contra el backend local. No acreditan aún el despliegue cloud.
- Presupuesto comunicado: USD 50 del laboratorio. Presentación viernes 11 y
  disponibilidad para sesiones hasta domingo 13. Sin dominio propio.
- RDS: formulario preparado con PostgreSQL 17.10-R1, `db.t4g.micro`, Single-AZ,
  20 GiB y acceso público desactivado. Sin crear: faltan revisar costos,
  credenciales y el grupo de seguridad dedicado.

## Evidencia de Azure y login: 8 de septiembre

1. En Brave, abrir Azure y verificar el directorio que coincide con el tenant
   configurado en Nexo.
2. Entrar en **App registrations → All applications** y buscar `Nexo`.
   Se encontraron `Nexo Frontend` y `Nexo Web` con los IDs del repositorio.

   ![Registros Nexo](images/cloud/02-entra-aplicaciones.png)

3. Abrir **Nexo Frontend → Authentication**. Se verificó una plataforma SPA
   con `http://localhost:4200`.

   ![Redirect SPA](images/cloud/03-entra-redirect-spa.png)

4. En **API permissions**, el listado estático muestra Microsoft Graph
   `User.Read`. Esto por sí solo no prueba que el scope de Nexo sea inaccesible;
   se inspeccionó también la preautorización en la aplicación API.

   ![Permisos estáticos del frontend](images/cloud/04-entra-permisos-spa.png)

5. Abrir **Nexo Web → Expose an API**. Se verificó `access_as_user` habilitado,
   consentimiento de administradores y el ID del frontend entre los clientes
   autorizados, con un scope. No se modificaron permisos ni consentimientos.

   ![Scope y cliente preautorizado](images/cloud/05-entra-scope-preautorizado.png)

6. Iniciar backend y Angular locales. Readiness respondió `UP`. Abrir Nexo en
   Brave y pulsar **Continuar con Microsoft**. La redirección usa el tenant,
   client ID, scope y redirect correctos y solicita Authorization Code con PKCE.
   El usuario completó personalmente el selector de cuentas Microsoft.
7. Nexo volvió a `/home` y mostró acceso **Microsoft Entra ID**. Después de
   recargar, se observó `/api/users/me` con HTTP **200** en la red del navegador,
   sin registrar cabeceras, tokens ni cuerpo de respuesta. La sesión se restauró.
8. Abrir `/profile` y pulsar **Cerrar sesión**. Microsoft mostró
   **You signed out of your account**. En esta prueba quedó en la página de
   Microsoft; no se acredita retorno automático a Nexo.
9. Navegar manualmente a `http://localhost:4200/profile`: Nexo redirigió a
   `/login`, sin mostrar el perfil. La captura siguiente documenta la pantalla
   pública resultante; no expone datos personales ni credenciales.

   ![Ruta protegida redirigida al login después de cerrar sesión](images/cloud/06-logout-ruta-protegida.png)

Resultado local: login, restauración y cierre de sesión correctos para la cuenta
probada. Pendientes: otras cuentas/roles, errores de autorización, expiración,
retorno automático tras logout y repetir la matriz contra API Gateway y EC2.

## Incorporación de cuenta institucional Duoc por B2B

El intento inicial con la cuenta institucional falló porque `Nexo Frontend` es
single-tenant y la identidad no existía en **Default Directory**. Se eligió la
alternativa de colaboración B2B para conservar el diseño single-tenant de la
entrega y evitar cambios de issuer en el backend.

1. En **Microsoft Entra ID → Users**, seleccionar **New user → Invite external
   user**.
2. Registrar la cuenta institucional como usuario tipo **Guest**, mantener el
   mensaje de invitación y revisar el tenant de destino.
3. Con confirmación expresa del propietario, seleccionar **Invite**. Azure
   respondió **Successfully invited user** y el listado mostró el origen
   **Invitation**.

   ![Azure confirmó la creación del invitado Duoc](images/cloud/07-entra-invitado-duoc.png)

La evidencia publicada omite el correo completo y la cabecera de la cuenta del
portal. La invitación todavía debe ser aceptada personalmente desde la cuenta
Duoc. Después se repetirá login, `/api/users/me` HTTP 200 y logout; no se marcará
el acceso institucional como aprobado hasta completar esas tres comprobaciones.

Las capturas guardadas omiten la cabecera de cuenta Azure. El backend iniciado
para esta prueba usa el perfil local existente; esta ejecución no es un despliegue
cloud ni una validación del perfil de producción.

## Configuración encontrada en el repositorio

Estos valores públicos provienen del código; no acreditan la configuración
actual del portal Azure:

| Parámetro | Valor |
| --- | --- |
| Tenant | `21a4bbb2-fc48-4053-a98e-b805aa2306cc` |
| Aplicación SPA | `480a8cf4-c729-4ca1-8043-6c1198dfaceb` |
| Aplicación API | `0f2d7cee-cabb-4482-900d-64fb07f5f81d` |
| Permiso delegado | `access_as_user` |
| Redirect local | `http://localhost:4200` |
| Issuer v2 | `https://login.microsoftonline.com/21a4bbb2-fc48-4053-a98e-b805aa2306cc/v2.0` |

Spring valida tokens Entra y tokens locales. La configuración admite también
un issuer Entra legado; hay que comprobar la versión del access token real
antes de configurar el authorizer. No registrar tokens completos.

## Secuencia de implementación y prueba

1. Azure: comprobar tenant, registros SPA/API, redirect SPA, versión del access
   token y permiso delegado. Probar login, `/api/users/me` y logout en Brave.
2. EC2: concretar tipo, almacenamiento, presupuesto, acceso administrativo y
   red. Preparar instalación reproducible y secretos independientes del PC.
   Desplegar sin `local-demo`; no copiar la base local.
3. API: preparar integración HTTP API Gateway, authorizer Entra y rutas con
   scopes explícitos. Probar 401 sin token, 401 inválido, 403 sin permiso y
   200 con permiso. Comprobar CORS y que no se eluda el control por acceso
   directo al backend.
4. Tiempo real: implementar WebSocket autenticado y presencia persistente,
   con expiración, reconexión y comprobación de membresía. Diseñar su entrada
   pública por separado de la API HTTP.
5. Multimedia: configurar HTTPS/WSS y TURN con el dominio acordado. Validar
   eventos firmados, repetidos y fuera de orden, y revocar participantes al
   perder membresía, incluyendo intentos de volver con un token anterior.
6. Alcance funcional: contrastar grupos privados y adjuntos con el alcance
   aprobado antes de elegir permisos, tipos de archivo y almacenamiento.
7. Operación: fijar paginación y límites, métricas sin contenido privado,
   retención de logs, restauración y procedimiento de reversión.
8. Dos dispositivos y redes diferentes: comprobar audio/video, candidato
   relay, pérdida de red y reconexión; registrar navegador y resultado real.

## Estado de aceptación

El punto de autenticación tiene evidencia interactiva local descrita arriba.
La implementación y validación cloud siguen pendientes. Estas pruebas no
acreditan funcionamiento en EC2 ni entre redes; los formularios EC2/RDS son
estados intermedios, no recursos desplegados.

Cada paso completado debe añadir fecha, resultado observado, evidencia
redactada y configuración reversible. No incluir contraseñas, JWT, claves
privadas, secretos ni identificadores de cuenta AWS en las capturas publicadas.

Referencias del proyecto: [fase 5](phase-5-readiness.md),
[flujo Git](git-workflow.md), [servicios y transmisiones](transmisiones-y-servicios.md).
