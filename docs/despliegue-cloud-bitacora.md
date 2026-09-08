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
  20 GiB y acceso público desactivado. Posteriormente se creó mediante el flujo
  de creación sencilla; ver la evidencia y las salvedades siguientes.

## Creación académica de PostgreSQL en RDS

Con autorización expresa del propietario se utilizó **Creación sencilla** con
PostgreSQL, tamaño **Capa gratuita**, instancia `db.t4g.micro`, 1 GiB de RAM y
20 GiB de almacenamiento. El identificador es `nexo-academico-db` y el usuario
maestro es `nexo_admin`.

![Selección de creación sencilla y tamaño de capa gratuita](images/cloud/09-rds-creacion-sencilla.png)

AWS aceptó la operación y mostró la instancia con estado **Creando**, motor
PostgreSQL, tamaño `db.t4g.micro`, una sola zona de disponibilidad y Multi-AZ
desactivado.

![Instancia PostgreSQL en proceso de creación](images/cloud/10-rds-creando.png)

La consola generó una contraseña maestra y advierte que solo puede verse una
vez. Se dejó el modal abierto para que el propietario la guarde directamente;
la contraseña no se leyó, copió, registró ni capturó. Tampoco debe incorporarse
al repositorio. Antes de conectar el backend falta verificar el endpoint, la
disponibilidad final y las reglas de red creadas por el modo sencillo.

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

4. Se detectó que la primera dirección no incluía la `s` final del nombre de
   usuario. Con una segunda confirmación expresa, se eliminó ese invitado y se
   creó uno nuevo para `jor.vergaras@duocuc.cl`. Azure confirmó ambas operaciones
   y la búsqueda exacta mostró el nuevo registro como **Guest**, con creación
   **Invitation**. No se publica la vista completa porque contiene direcciones
   de correo y el identificador interno del usuario.

La evidencia gráfica publicada omite el correo completo y la cabecera de la cuenta
del portal.

## Validación de acceso con cuenta Duoc

El usuario aceptó personalmente la invitación B2B e inició sesión con su cuenta
institucional. Nexo abrió `/home`, mostró el nombre institucional y señaló el
acceso **Microsoft Entra ID**. Se navegó a `/profile` correctamente.

Después de recargar la aplicación, la solicitud protegida `/api/users/me`
respondió HTTP **200**. La observación registró únicamente URL y estado; no se
leyeron ni almacenaron JWT, cabeceras o cuerpo de respuesta.

![Acceso Microsoft Entra ID en el perfil institucional](images/cloud/08-login-duoc-entra.png)

Resultado: login B2B, persistencia de sesión y acceso al perfil protegidos
aprobados en el entorno local. El logout ya fue validado anteriormente con otra
cuenta Entra. Falta repetir toda la matriz contra EC2 y API Gateway; la evidencia
actual no acredita todavía un backend cloud.

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

## Infraestructura AWS creada

### PostgreSQL en Amazon RDS

Se creó `nexo-academico-db` mediante **Creación sencilla**, con PostgreSQL
17.10, clase `db.t4g.micro`, 20 GiB, una zona de disponibilidad y sin Multi-AZ.
La consola confirmó el estado **Disponible** el 8 de septiembre de 2026.

La base no tiene puerta de enlace a Internet y no es públicamente accesible.
Usa el puerto PostgreSQL 5432 y, al momento de la verificación, el grupo de
seguridad predeterminado solo aceptaba entrada desde el mismo grupo. El endpoint
y la contraseña maestra no se publican en este documento. La contraseña fue
guardada personalmente por el propietario del laboratorio.

![RDS configurado mediante creación sencilla](images/cloud/09-rds-creacion-sencilla.png)

![Creación inicial de la base RDS](images/cloud/10-rds-creando.png)

Pendiente inmediato: autorizar PostgreSQL únicamente desde el grupo de seguridad
de la VPS y probar una conexión real desde esa instancia.

El 8 de septiembre se completó ese pendiente mediante el asistente de conexión
EC2–RDS. AWS creó los grupos `ec2-rds-1` y `rds-ec2-1`; la base admite PostgreSQL
desde el grupo de la VPS, no desde Internet. El backend abrió una conexión Hikari
y Flyway aplicó correctamente las diez migraciones hasta V10 sobre PostgreSQL
17.10.

### VPS económica en Amazon EC2

Se lanzó una instancia llamada `nexo-backend-academico` con esta configuración:

- Amazon Linux 2023 x86_64.
- `t3.micro`: 2 vCPU y 1 GiB de memoria, apta para capa gratuita.
- Un volumen raíz gp3 de 8 GiB.
- Créditos de CPU en modo `standard`, evitando el consumo adicional del modo
  ilimitado.
- Perfil `LabInstanceProfile`/rol `LabRole` y par de claves `vockey` provistos
  por AWS Academy.
- IMDSv2 obligatorio y monitoreo detallado desactivado.
- IP pública automática; puede cambiar al detener o reiniciar el laboratorio.
- SSH limitado a la IP pública actual del estudiante y HTTP habilitado para la
  demostración académica. Si cambia de red, debe actualizarse la regla SSH.

Los datos de usuario instalan Docker y Git, habilitan Docker al iniciar y crean
`/opt/nexo`. No contienen secretos. La consola confirmó el lanzamiento y luego
mostró la instancia **En ejecución**. No se publica el ID, la IP ni el DNS de la
instancia para evitar exponer identificadores de infraestructura.

Esta VPS es adecuada para una entrega básica de bajo costo. Su 1 GiB de memoria
obliga a medir el consumo antes de ejecutar simultáneamente Spring Boot,
LiveKit y otros contenedores; si no alcanza, se debe separar LiveKit o cambiar
temporalmente el tamaño durante las pruebas.

Para sostener la compilación sin aumentar la clase de instancia se habilitó un
archivo swap de 2 GiB. El repositorio se clonó temporalmente mientras su
propietario lo hizo público y volvió a quedar privado al terminar. En la VPS se
construyó `nexo-backend:cloud`; el contenedor usa `restart: always`, publica 8080
solo en loopback y carga un archivo de entorno con permisos 600. La contraseña
RDS fue ingresada directamente por el propietario y no se leyó ni registró.

Pruebas observadas desde la VPS y desde un equipo externo:

| Comprobación | Resultado |
| --- | --- |
| Contenedor backend | En ejecución |
| Flyway | 10 migraciones aplicadas, versión V10 |
| Readiness interno | HTTP 200, `UP` |
| Health público vía proxy | HTTP 200, `nexo-backend` `UP` |
| Ruta privada sin JWT | HTTP 401, acceso rechazado correctamente |
| Navegación directa SPA (`/profile`) | HTTP 200, fallback de Angular correcto |
| Angular | Compilación de producción correcta |

### HTTPS y nombre temporal

La SPA inicializaba MSAL y no podía arrancar correctamente sobre una IP por HTTP,
porque las API criptográficas del navegador y los redirects remotos de Entra
requieren un contexto seguro. Para la entrega se configuró Caddy con certificado
automático de Let's Encrypt y un nombre DNS dinámico de `nip.io` que codifica la
IP pública. El grupo de seguridad expone únicamente HTTP 80 y HTTPS 443 para la
web; SSH permanece limitado a la IP del estudiante y RDS continúa privada.

![Nexo publicado mediante HTTPS en la VPS](images/cloud/11-nexo-cloud-https.png)

La URL concreta se omite de este documento porque cambia con la IP pública. El
redirect HTTPS se registró como plataforma **Single-page application** en `Nexo
Frontend`, conservando también `http://localhost:4200`. La URL temporal dura
mientras `nip.io` continúe resolviendo y la EC2 conserve su IP. AWS Academy puede
detener la instancia al finalizar una sesión; un nuevo arranque puede asignar
otra IP y exigir regenerar el nombre, el certificado, CORS y el redirect Entra.
Los contenedores y el certificado persisten en el volumen de la VPS y tienen
reinicio automático.

## Estado de aceptación

El punto de autenticación tiene evidencia interactiva local descrita arriba.
RDS, la VPS, el backend, la SPA y HTTPS están operativos. Se verificaron HTTP 200
para Angular y health mediante el proxy, y la conexión real de Spring a RDS.
Todavía no están acreditados API Gateway con authorizer, WebSocket persistente,
TURN, LiveKit cloud ni pruebas multimedia entre redes. La validación de login
Microsoft cloud debe completarse interactivamente desde el navegador.

Cada paso completado debe añadir fecha, resultado observado, evidencia
redactada y configuración reversible. No incluir contraseñas, JWT, claves
privadas, secretos ni identificadores de cuenta AWS en las capturas publicadas.

Referencias del proyecto: [fase 5](phase-5-readiness.md),
[flujo Git](git-workflow.md), [servicios y transmisiones](transmisiones-y-servicios.md).
