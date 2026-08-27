# Nexo backend

Una aplicación Spring Boot 3.5.16, Java 21 y PostgreSQL, organizada por dominio.
No hay microservicios. El modo disponible es una demo local explícita.

## Arranque

Preparar `.env` y PostgreSQL según el [README raíz](../README.md).

```powershell
.\mvnw.cmd spring-boot:run
```

Linux/macOS: `./mvnw spring-boot:run`. Activar `SPRING_PROFILES_ACTIVE=local-demo`
para usar los tres perfiles. Sin ese perfil, la demo no queda habilitada.

## Dominios

| Dominio | Responsabilidad |
| --- | --- |
| auth | Credenciales opacas demo, filtro Spring Security y principal |
| user | Usuarios JPA, DTOs y fotos PNG persistidas |
| messaging | Canales, miembros, directos e historial con JdbcClient |
| realtime | Señalización HTTP y estado temporal de llamadas |
| common | CORS, errores, health y OpenAPI |

Flyway aplica V0–V4. V3 reside en `db/demo` y se carga solo bajo `local-demo`.
Hibernate valida el schema; no lo recrea. El historial Flyway está en `public`
y las tablas de dominio en `nexo`.

## Pruebas

```powershell
.\mvnw.cmd verify
```

16 pruebas con PostgreSQL de Testcontainers. Se necesita Docker activo; no se usa
la base demo. Cubren health, aislamiento del perfil, sesiones, permisos,
idempotencia, fotos y señalización de llamadas.

La imagen Docker omite tests al construir. Ejecutarlos antes mediante verify/CI.

## Diagnóstico

- `GET /api/public/health`: público, estado básico.
- `GET /actuator/health/readiness`: incluye disponibilidad de PostgreSQL.
- `/swagger-ui/index.html`: contratos y bearer demo.
- Sin credencial válida, las rutas privadas responden 401; sin permisos, 403.

No se emiten JWT ni se valida Microsoft todavía. Ver el
[alcance de seguridad](../SECURITY.md) y el [contrato API](../README.md#api).
