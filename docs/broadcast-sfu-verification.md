# Fase 4: transmisiones locales

Implementación y pruebas: 5 de septiembre de 2026.

## Ejecutar

Completa estas variables en `.env` (archivo ignorado por Git):

```dotenv
NEXO_BROADCASTS_ENABLED=true
LIVEKIT_API_KEY=<clave propia aleatoria>
LIVEKIT_API_SECRET=<secreto aleatorio de al menos 32 caracteres>
LIVEKIT_PUBLIC_URL=ws://127.0.0.1:7880
LIVEKIT_NODE_IP=<IPv4 del equipo>
```

En PowerShell, `Get-NetIPConfiguration` muestra la IPv4 de la interfaz con puerta de
enlace. En Docker Desktop, usa esa dirección para RTC: los candidatos de loopback pueden
fallar aunque la conexión WebSocket funcione. Si cambia la IP por DHCP, actualiza `.env`
y recrea LiveKit. No fijes otra dirección `rtc.node_ip` dentro de `infra/livekit.yaml`:
el argumento de Compose es la fuente de configuración.

Genera los valores de clave y secreto con un generador criptográfico. Por ejemplo,
`[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`.
No reutilices el secreto JWT de Nexo.

```powershell
docker compose --profile app --profile media up -d --build --wait
cd frontend
npm ci
npm start -- --host 127.0.0.1
```

Frontend: `http://127.0.0.1:4200`. API: puerto 8080. Señalización LiveKit: 7880.
Estos tres puertos quedan en loopback. Solo RTC 7881/TCP y 7882/UDP se enlazan a
`LIVEKIT_NODE_IP`. No se configura publicación en Internet ni se cambian reglas del firewall.
El perfil `media` es opcional; con la función desactivada sigue disponible la vista previa.

## Uso con dos cuentas

1. Inicia sesión como anfitrión. Abre **Perfil → Preparar transmisión**.
2. Elige **Cámara** o **Pantalla** y pulsa **Preparar vista previa**. Concede permisos.
3. Selecciona una conversación de la que seas miembro y escribe un título.
4. Pulsa **Iniciar transmisión**. Desde ese momento los miembros pueden verte y escucharte.
5. En otra sesión de navegador, entra con otra cuenta miembro de esa conversación.
6. Abre el canal y pulsa **Ver transmisión**. El espectador no necesita cámara ni micrófono.
7. Si el navegador bloquea el sonido, pulsa **Activar audio**.
8. El anfitrión puede silenciar/reactivar el micrófono y finalizar. Para cambiar dispositivos,
   termina la emisión y vuelve a preparar la vista previa.

La vista previa está silenciada para evitar eco; el medidor comprueba el micrófono.
Usa audífonos durante pruebas en el mismo equipo. No hay grabación ni videollamada bidireccional:
esta función es una transmisión de un anfitrión hacia espectadores.

## Contratos y comportamiento

- `POST /api/conversations/{id}/broadcasts`: borrador de un miembro autenticado.
- `GET /api/conversations/{id}/broadcasts/active`: directos de la conversación, solo para miembros.
- `GET /api/broadcasts/config`: disponibilidad de la función para la sesión.
- `POST /api/broadcasts/{id}/access`: token de sala con identidad y rol derivados del servidor.
- `POST /api/broadcasts/{id}/start`: confirma que LiveKit tiene audio y video del anfitrión;
  repetirlo renueva la conexión sin duplicar el directo. El cliente reintenta brevemente un
  `409` inicial mientras la publicación aparece en el API del SFU.
- `POST /api/broadcasts/{id}/end`: cierra la sala y desconecta participantes; es idempotente.
- El modo demo usa los mismos contratos bajo `/api/demo`, sujeto al perfil `local-demo` existente.

V10 guarda metadatos, estados, tiempos y motivo de cierre. Un índice parcial impide más de
un borrador/directo activo por anfitrión. No guarda audio, video, SDP ni tokens. Los tokens
de acceso duran 60 segundos, son exclusivos de una sala y se entregan con `Cache-Control:
no-store`; Angular los conserva solo en memoria. El espectador tiene `canPublish=false`.
Los clientes no reciben permisos administrativos ni de datos. LiveKit no permite crear
salas automáticamente con tokens antiguos después del cierre (`room.auto_create=false`).

El navegador renueva el directo cada 20 segundos. La conexión vence a los 90 segundos
sin renovación y un barrido cada 15 segundos cierra la sala. Una recarga/cierre inesperado
puede tardar hasta unos 105 segundos en reflejarse. Si LiveKit está caído, el barrido reintenta
al volver el servicio. El canal consulta cada 4 segundos y el SDK gestiona reconexiones.
El control del ciclo de vida está serializado para una instancia Spring; varias instancias
requerirán bloqueo distribuido o transacciones de estado coordinadas.

## Evidencia

- Backend: el 7 de septiembre se repitió `verify` completo con Java 21, Maven 3.9.16
  y Docker activo: 41 pruebas aprobadas, sin fallos, errores ni omisiones; `BUILD SUCCESS`.
  Se invocó `bin/mvn.cmd verify` de la distribución ya instalada porque `mvnw.cmd`
  falló antes de arrancar Maven al evaluar `.Target[0]` en Windows. El wrapper no fue modificado.
- Angular: 76 pruebas aprobadas, incluidas publicación separada, rol de espectador, cancelación
  de un acceso pendiente, reconexión, recuperación de autoplay y finalización remota.
  El 7 de septiembre se repitieron `npm run format:check`, `npm run test:ci` y
  `npm run build`: formato correcto, 76 pruebas en 22 archivos y build aprobado.
  Tests/build necesitaron ejecución fuera del sandbox por errores de acceso a archivos.
- Edge, dos sesiones aisladas: cámara + audio y pantalla + audio recibidos por WebRTC;
  se verificaron bytes RTP entrantes, imagen decodificada, mute/reactivación y liberación
  de tracks. El espectador no solicitó dispositivos y no pudo publicar.
- Cierre forzado del anfitrión: la conexión venció y el servidor cerró la sala.

La prueba de navegador usa canvas y un tono sintetizado, además de dispositivos ficticios
de Chromium para reproducir permisos. No utiliza cámara, pantalla ni micrófono reales.
Las pruebas manuales con dispositivos físicos y entre redes externas siguen pendientes.
La prueba WebRTC de navegador descrita arriba corresponde al 5 de septiembre; no se
repitió durante la verificación automatizada del 7 de septiembre.

`scripts/verify-broadcast.cjs` permite repetir la prueba con Playwright y Edge instalados;
ejecuta `node scripts/verify-broadcast.cjs` desde la raíz con el proyecto en marcha. Crea
cuentas de prueba `sfu-…@nexo.test` y conserva sus credenciales en `.tmp/` para reutilizarlas.
Las capturas y cualquier diagnóstico también quedan en `.tmp/`, ignorado por Git.

## Siguiente fase

HTTPS/WSS, TURN/TLS, eventos firmados de LiveKit, revocación de membresía durante una sesión,
límites operativos y pruebas entre redes. No se declara listo para producción.

Referencias: [SDK Java/Kotlin](https://github.com/livekit/server-sdk-kotlin),
[grants](https://docs.livekit.io/frontends/reference/tokens-grants/),
[despliegue LiveKit](https://docs.livekit.io/transport/self-hosting/deployment/).
