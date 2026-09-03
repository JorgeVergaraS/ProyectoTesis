# Nexo frontend

Angular 21 standalone, TypeScript, Tailwind CSS 4, signals, rutas lazy y Reactive Forms.

## Arranque

```bash
npm ci
npm start
```

Requiere Node 24/npm 11 y Spring Boot con `local-demo`. Abrir
[localhost:4200](http://localhost:4200). El proxy envía `/api` al backend en 8080.

## Organización

- `core/auth`: sesión demo por pestaña; `guards` e `interceptors` protegen la UI
  y limitan el envío de la credencial a la API propia.
- `core/services`: clientes de chat, perfil y health, además de la preferencia visual
  persistente.
- `core/realtime`: WebRTC de audio, permiso del micrófono y señalización HTTP.
- `shared/components`: avatares, iconos, enlaces seguros y panel de voz.
- `features/auth`: selector visual de perfiles.
- `features/home`: inicio, comunidades, bandeja, mensajes, personas y panel de perfil
  reutilizable con edición persistente. Los mensajes ofrecen acciones para editar, borrar,
  copiar, responder y reenviar. La tuerca junto al usuario abre la configuración con temas
  predeterminado, OLED y claro.
- `features/status`: diagnóstico técnico.

Rutas: `/login`, `/home`, `/profile` y `/status`. Crear pestañas nuevas sin
duplicarlas para usar perfiles locales independientes. MSAL delega el login
Microsoft a Entra ID y solicita el scope público configurado para la API Nexo.

Los tres temas usan botones de cristal mate con textura turbulenta y una jerarquía
tipográfica Gotham con alternativas geométricas del sistema. La preferencia se conserva en
el navegador.
Para reproducir Gotham exactamente se deben aportar archivos de fuente con licencia;
el repositorio no distribuye tipografías propietarias.

## Pruebas y build

```bash
npm run format:check
npm run test:ci
npm run build
```

51 pruebas en diecinueve archivos. Los tests unitarios de voz simulan medios;
la conectividad WebRTC real se verifica por separado. `npm run format` aplica
Prettier. El build de producción genera `dist/nexo`, que no se versiona.

Las variables de environment son públicas. Nunca colocar secretos o credenciales
Microsoft allí. Ver [README raíz](../README.md), [seguridad](../SECURITY.md) y
[verificación de voz y fotos](../docs/photos-and-calls-verification.md).
