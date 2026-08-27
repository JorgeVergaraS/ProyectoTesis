# Verificación por fases

> Evidencia histórica de las fases iniciales. El estado actual está en el
> [README](../README.md); este informe no describe la publicación actual en Git.

## Fase 1

Carpeta inicialmente vacía. Disponibles Node 24.14.0, npm 11.13.0,
Java Temurin 21.0.10, Docker Engine 29.7.2 y Docker Compose 5.4.0.
Puertos 4200, 5432 y 8080 libres al inicio.

Se crearon la estructura por dominios, Docker Compose, `.env.example`,
exclusiones de Git y README. Aún no hay aplicación que compilar en esta fase.

Compose validado con `docker compose config --quiet`. En la fase 1 no había
código ejecutable que compilar. Se inicializó Git localmente, sin commits ni
remotos. `.env`, `node_modules`, `target`, `.tools` y `.vscode` están ignorados.

## Fase 2

Ejecutado `docker compose up -d --wait --wait-timeout 120`.
PostgreSQL 17.10 quedó `healthy`, accesible únicamente en `127.0.0.1:5432`.
Una conexión TCP con contraseña ejecutó `SELECT current_database(), current_user,
version()`, confirmando base `nexo`, usuario `nexo` y PostgreSQL 17.10.
Los datos permanecen en el volumen `nexo_postgres_data`.

## Fase 3

Verificado el 27 de agosto de 2026 en Windows con Docker Desktop Linux.

| Comprobación ejecutada | Resultado |
| --- | --- |
| Maven Wrapper 3.9.16 | Descarga verificada, SHA-256 fijado |
| `backend/mvnw.cmd verify` | 7 pruebas, 0 fallos, 0 errores, 0 omitidas |
| `verify -Dspring.config.import=` | 7 pruebas pasan sin importar `.env` |
| Testcontainers | PostgreSQL 17.10 real y aislado de desarrollo |
| Inicio `mvnw.cmd spring-boot:run` | Spring Boot 3.5.16 en 8080 |
| Reinicio sobre base existente | Arranque correcto, ninguna migración repetida |
| `GET /api/public/health` sin token | 200, `UP`, `nexo-backend` |
| `GET /actuator/health/readiness` | 200, `UP` |
| PostgreSQL detenido temporalmente | Readiness 503; health HTTP sigue UP |
| PostgreSQL arrancado de nuevo | `healthy`; readiness vuelve a 200 UP |
| Swagger y `/v3/api-docs` | 200; health documentado |
| CORS Angular | Origen exacto permitido |
| CORS de origen desconocido | 403, sin Allow-Origin (test) |
| `npm install` | Dependencias instaladas, 0 vulnerabilidades reportadas |
| `npm run build` | Compilación de producción correcta |
| `npm run test:ci` | 4 pruebas, 2 archivos, todos pasan |
| `npm run format:check` | Correcto |
| `npm start` | Angular 21.2.22 en localhost:4200 |
| Angular `/api/public/health` | 200 mediante proxy hacia Spring |
| Navegador real | API «Conectada» y reintento funciona |
| Consola navegador | Sin errores en comprobación final |
| Vista móvil 390 × 844 | Sin overflow horizontal, contenido legible |
| Backend Docker con perfil `app` | Imagen construida y contenedor healthy |
| Usuario del contenedor Java | `uid=100(nexo)`, no root |
| `scripts/verify-local.ps1` | 6 comprobaciones HTTP correctas |

El backend Docker se verificó en el puerto temporal 8081 para no interferir con
el proceso local. Después se detuvo y eliminó únicamente ese contenedor; la
imagen queda disponible. Al entregar permanecen Angular en 4200, el backend
local en 8080 y PostgreSQL en Docker en 5432. No se borró el volumen.

### Corrección descubierta durante la verificación

En PostgreSQL el `search_path` predeterminado incluye el nombre del usuario.
Al crear el schema `nexo`, una nueva conexión del usuario `nexo` podía buscar
el historial de Flyway en ese schema y repetir V0. Se fijaron explícitamente
`spring.flyway.default-schema=public` y `spring.flyway.schemas=public`.

Se añadió a la prueba existente una segunda ejecución de Flyway con una conexión
nueva y usuario/base `nexo`. Debe aplicar cero migraciones y no crear historial
en el schema de dominio. La tabla de historial vacía que dejó el intento fallido
en desarrollo se inspeccionó y eliminó; el historial válido de `public` y la
migración aplicada se conservaron, sin modificar checksums ni usar `repair`.

### Advertencias no bloqueantes

Mockito emite un aviso de instrumentación dinámica en Java 21 durante las
pruebas. Springdoc recuerda que la documentación está habilitada. Ninguno
impide compilar o ejecutar; no equivalen a errores de arranque. Swagger solo
debe permanecer público en este entorno local.

## Alcance que no se afirma como completado

No hay MSAL, login Microsoft, guards, access tokens, JWT, roles, usuarios locales,
Tailwind, WebSocket ni WebRTC. Los criterios 6–20 del objetivo completo requieren
las fases siguientes. `/api/users/me` aún no existe y devuelve 404, no 401.
No se configuraron aplicaciones ni credenciales en Microsoft Entra.
