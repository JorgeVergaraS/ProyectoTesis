# Nexo backend

Una aplicación Spring Boot 3.5.16, Java 21 y PostgreSQL, organizada por dominio.
No hay microservicios. Conviven tres modos de identidad separados: demo local,
JWT local y Microsoft Entra ID.

## Arranque

Preparar `.env` y PostgreSQL según el [README raíz](../README.md).

`NEXO_JWT_SECRET` es obligatorio y debe contener al menos 32 bytes. No existe
un secreto predeterminado para ejecución normal; el perfil de tests utiliza un
valor aislado que no sirve fuera de la suite.

```powershell
.\mvnw.cmd spring-boot:run
```

Linux/macOS: `./mvnw spring-boot:run`. Activar `SPRING_PROFILES_ACTIVE=local-demo`
para usar los tres perfiles. Sin ese perfil, la demo no queda habilitada.

## Dominios

| Dominio | Responsabilidad |
| --- | --- |
| auth | Demo aislada, registro/login local y OAuth2 Resource Server para Entra |
| user | Usuarios JPA, DTOs y fotos PNG persistidas |
| messaging | Canales, miembros, directos e historial con JdbcClient |
| realtime | Señalización HTTP y estado temporal de llamadas |
| common | CORS, errores, health y OpenAPI |

Flyway aplica V0–V9. V3 reside en `db/demo` y se carga solo bajo `local-demo`;
V8 crea el canal `general` para cualquier ambiente y matricula a los usuarios
activos existentes. V9 separa la disponibilidad visible del estado administrativo,
protege las personalizaciones de perfil y garantiza la unicidad de `username` sin
distinguir mayúsculas.
Hibernate valida el schema; no lo recrea. El historial Flyway está en `public`
y las tablas de dominio en `nexo`.

## Pruebas

```powershell
.\mvnw.cmd verify
```

La suite usa PostgreSQL de Testcontainers. Se necesita Docker activo; no se usa
la base local. Cubre health, registro/login local, validaciones JWT, 401/403/200,
persistencia Entra sin contraseña, workspace autenticado, aislamiento, permisos,
fotos y llamadas.

La imagen Docker omite tests al construir. Ejecutarlos antes mediante verify/CI.

## Diagnóstico

- `GET /api/public/health`: público, estado básico.
- `GET /actuator/health/readiness`: incluye disponibilidad de PostgreSQL.
- `/swagger-ui/index.html`: contratos para JWT y bearer demo.
- `POST /api/auth/register`: registro local con contraseña BCrypt.
- `POST /api/auth/login`: entrega JWT local con issuer `nexo-local` y audience `nexo-api`.
- `GET /api/users/me`: acepta `ROLE_USER` local o `SCOPE_access_as_user` de Entra.
- `PATCH /api/users/me/profile`: actualiza únicamente los campos editables del perfil propio.
- `POST|DELETE /api/users/me/avatar`: guarda o elimina el avatar de la identidad autenticada.
- `GET /api/avatars/{userId}/{version}`: entrega el PNG normalizado de la versión vigente.
- `GET /api/workspace`: canales, conversaciones directas y directorio para la identidad autenticada.
- `POST /api/directs`: crea o recupera una conversación privada canónica.
- `GET|POST /api/conversations/{id}/messages`: exige membresía y deriva el remitente del token.
- `PATCH|DELETE /api/conversations/{conversationId}/messages/{messageId}`: permite modificar
  únicamente mensajes propios y rechaza a cualquier otro miembro con 403.
- Sin credencial válida, las rutas privadas responden 401; sin permisos, 403.

El decoder de Entra valida firma, issuer, audience y expiración mediante las claves
públicas del tenant. Los claims `scp`/`scope` se convierten a `SCOPE_*` y `roles`
a `ROLE_*`. Las identidades Microsoft se sincronizan por `oid` y nunca guardan
contraseña. Ver el [alcance de seguridad](../SECURITY.md) y el
[contrato API](../README.md#api).
