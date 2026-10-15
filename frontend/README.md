# Nexo frontend

Angular 21 standalone, TypeScript, Tailwind CSS 4, signals, rutas lazy y Reactive Forms.

## Arranque

```bash
npm ci
npm start
```

Requiere Node 24/npm 11 y Spring Boot; `local-demo` habilita además los perfiles de demostración. Abrir
[localhost:4200](http://localhost:4200). El proxy envía `/api` al backend en 8080.

## Organización

- `core/auth`: sesiones demo, locales y Microsoft; `guards` e `interceptors` protegen la UI
  y limitan el envío de credenciales a la API propia.
- `core/media`: captura local de cámara, pantalla y micrófono, dispositivos, nivel y liberación.
- `core/services`: clientes de chat, perfil y health, además de la preferencia visual
  persistente.
- `core/realtime`: WebRTC de voz/videollamadas 1:1, permisos explícitos de cámara/micrófono,
  mute de cámara con liberación del dispositivo, ICE progresivo y señalización HTTP.
- En una llamada de video, si cámara no está disponible o se deniega pero el micrófono sí funciona,
  Nexo contesta en modo audio. La cámara no se solicita al cargar la página.
- En una llamada activa, el estudio LiveKit no captura por segunda vez el micrófono de WebRTC;
  puede enviar video/pantalla y audio de pestaña/sistema por separado, evitando duplicar el audio
  de voz y reducir el riesgo de eco.
- `core/realtime/call-notification.service.ts`: timbre de llamada entrante con preferencia local
  y avisos opcionales del navegador. El usuario habilita permisos desde **Notificaciones**; el
  aviso del sistema oculta el nombre de quien llama y el timbre se detiene al responder o terminar.
- `shared/components`: avatares, iconos, enlaces seguros y panel de voz.
- `features/auth`: selector visual de perfiles.
- `features/home`: inicio, comunidades, bandeja, mensajes, personas y panel de perfil
  reutilizable con edición persistente. Los mensajes ofrecen acciones para editar, borrar,
  copiar, responder y reenviar. La tuerca junto al usuario abre la configuración con temas
  predeterminado, OLED y claro, además de acabados Mate, Style SkayGlass y Y2K 2000 para
  los botones. El perfil también abre un estudio multimedia de vista previa privada.
- `features/status`: diagnóstico técnico.

Rutas: `/login`, `/home`, `/profile` y `/status`. Crear pestañas nuevas sin
duplicarlas para usar perfiles locales independientes. MSAL delega el login
Microsoft a Entra ID y solicita el scope público configurado para la API Nexo.

Los tres temas pueden combinarse con botones Mate, Style SkayGlass —inspirado en Frutiger
Aero e iOS 4— o Y2K 2000. La interfaz usa una jerarquía tipográfica Gotham con alternativas
geométricas del sistema. Ambas preferencias se conservan en el navegador.
Para reproducir Gotham exactamente se deben aportar archivos de fuente con licencia;
el repositorio no distribuye tipografías propietarias.

## Pruebas y build

```bash
npm run format:check
npm run test:ci
npm run build
```

La suite automatizada cubre los servicios y componentes de la aplicación. Los tests unitarios de
voz y estudio simulan medios;
la conectividad WebRTC real se verifica por separado y el estudio requiere una prueba manual
con dispositivos reales. `npm run format` aplica
Prettier. El build de producción genera `dist/nexo`, que no se versiona.

Las variables de environment son públicas. Nunca colocar secretos o credenciales
Microsoft allí. Ver [README raíz](../README.md), [seguridad](../SECURITY.md) y
[verificación de voz y fotos](../docs/photos-and-calls-verification.md) y
[verificación del estudio](../docs/multimedia-studio-verification.md).
