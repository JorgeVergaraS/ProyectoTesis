# Verificación de la demo local multiusuario

> Informe histórico. Las pruebas y funcionalidades posteriores están en
> [fotos y llamadas](photos-and-calls-verification.md) y el [README](../README.md).

Fecha: 27 de agosto de 2026. Entorno: Windows, Java 21, Node 24 y PostgreSQL
17.10 en Docker. Amplía las fases 1–3 documentadas en verification.md.

## Pruebas automáticas

- Maven Wrapper verify: **12 pruebas**, cero fallos, errores u omitidas.
- Angular test:ci: **16 pruebas**, siete archivos, todos aprobados.
- Angular build: compilación de producción correcta.
- Prettier format:check: correcto.
- npm install: cero vulnerabilidades reportadas.
- Compose config --quiet: configuración válida.

Backend: health, Flyway y reinicio, aislamiento del perfil demo, CORS,
sesiones independientes, hash en base, logout, expiración, permisos de
canales, mensajes persistentes, senderId derivado de la sesión, reintentos
idempotentes, unicidad del directo y exclusión de un tercer usuario.

Frontend: login mediante formulario real, errores de login, restauración y
logout, guards, interceptor limitado a la API propia, exclusión de credenciales
en solicitudes externas, envío con formulario, conservación de borradores y
reintento con el mismo clientId. Se mantienen las pruebas del diagnóstico.

## Pruebas en navegador con backend real

- Jorge inició sesión desde el formulario.
- Una pestaña independiente entró como Jean, sin reemplazar la identidad de Jorge.
- Jorge envió un mensaje a general; Jean lo recibió sin recargar.
- Jean respondió usando Enter y quedó registrado como Jean.
- Jorge se unió a desarrollo desde la previsualización del canal.
- Jorge abrió un directo con Jean y envió un mensaje.
- Jean abrió ese directo y recibió el mensaje.
- Recargar la pestaña de Jean restauró usuario, conversación e historial.
- Cerrar sesión de Jean y visitar /home devolvió /login.
- La sesión simultánea de Jorge siguió funcionando.
- Fernando inició sesión en una tercera pestaña.
- Vista móvil configurada a 390 × 844: contenido sin desbordamiento horizontal.
  El área de documento medida fue de 385 px, descontando el scrollbar.
- En móvil, Fernando abrió los participantes, salió de general y perdió el
  acceso al historial/compositor; después volvió a unirse.
- La exploración muestra los cuatro canales y las membresías reales.
- Consola de la pestaña final sin errores.
- Se cerraron las pestañas auxiliares después de cerrar sus sesiones. Se dejó
  abierta la comunidad original como Jorge.

La privacidad del directo respecto de Fernando se verificó mediante
MockMvc y PostgreSQL real; no se afirma que este modo demo autentique personas.
Cualquiera que use el selector puede entrar como cualquiera de los tres.

## Persistencia e integración

- SQL confirmó mensajes de canal y mensaje directo en tablas PostgreSQL.
- El backend volvió a arrancar con V0–V3 aplicadas, sin repetir migraciones.
- La sesión activa y la comunidad se recuperaron tras reiniciar Spring Boot.
- Swagger expone demoSession (HTTP bearer opaco) y requisitos de seguridad de
  los endpoints de mensajes.
- verify-local.ps1 confirmó health, readiness, proxy, shell Angular, OpenAPI y CORS.

## Problemas detectados y corregidos

- Los formularios con controles reactivos individuales necesitaban FormGroup
  para que ngSubmit interceptara el envío nativo. Se agregó y se verificó el
  evento submit real, incluida la prevención de navegación HTML.
- El panel de información no podía quedar oculto permanentemente en pantallas
  estrechas: ahora es desplegable y mantiene accesible Salir del canal.
- El perfil escrito como variable mayúscula en .env requiere una referencia
  explícita en application.yml; se añadió SPRING_PROFILES_ACTIVE.
- Se ajustó el presupuesto de CSS por componente a 16 kB de advertencia y 20 kB
  de error para la nueva página completa de comunidad. Se conservó el límite
  global inicial de 500 kB/1 MB; el bundle inicial actual es aproximadamente 278 kB.

## Límites de lo verificado

No se implementaron ni probaron Microsoft Entra/MSAL, JWT Microsoft, WebSocket,
llamadas, WebRTC, adjuntos ni paginación de más de 100 mensajes visibles.
No se reconstruyó/verificó la imagen Docker del backend demo en esta entrega:
la ejecución real usada aquí es Maven local, con PostgreSQL Docker.
El backend Docker opcional requiere --build para incorporar los cambios.

Referencia de diseño técnico:
[Angular HttpClient e interceptores](https://angular.dev/guide/http/interceptors),
[arquitectura de filtros Spring Security](https://docs.spring.io/spring-security/reference/servlet/architecture.html).
