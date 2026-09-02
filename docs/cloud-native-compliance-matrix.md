# Matriz de cumplimiento cloud-native de Nexo

Fuente de requisitos: pauta entregada por el docente y
[guía práctica de Microsoft Entra ID](https://jmcandia.github.io/cloud-native-ms-entra-id/).
Fecha de corte: 2 de septiembre de 2026.

Los estados distinguen código, validación interactiva e infraestructura real.
`Preparado` no significa demostrado en Azure/AWS.

| Requisito | Estado | Evidencia actual | Trabajo restante |
| --- | --- | --- | --- |
| Angular modular y compilable | Implementado | standalone, lazy routes, signals y tests | repetir build en CI de repositorio frontend |
| MSAL Angular / Browser | Implementado | configuración, servicio y tests en `frontend/core/auth` | conservar evidencia con cuenta institucional |
| OAuth 2.0 / OIDC con PKCE | Preparado y validado localmente | `PublicClientApplication` + redirect MSAL | capturar login real sin exponer tokens |
| Login y logout Microsoft | Implementado | `loginRedirect` y `logoutRedirect` | defensa interactiva con tenant disponible |
| Guards de rutas | Implementado | guard unificado para sesión local o Microsoft | probar acceso directo a rutas antes/después de logout |
| Interceptor de Access Token | Implementado | `acquireTokenSilent` y bearer limitado a la API | demostrar cabecera redactada en navegador |
| Lectura de scopes y roles | Implementado en backend | `SCOPE_*` desde `scp/scope`, `ROLE_*` desde `roles` | mostrar claims redactados y autorización real |
| Resource Server Spring | Integrado en rama de trabajo | dependencia OAuth2 Resource Server y decoders JWT | endurecer configuración de producción |
| Firma, expiración e issuer | Implementado | JWK Set Entra y validadores Spring | validar con token real vigente/expirado |
| Audience | Implementado | lista de audiences admitidas | confirmar valor exacto del App ID URI y Gateway |
| 401 sin token / inválido | Cubierto por tests | `AuthIntegrationTests` | repetir por URL de API Gateway |
| 403 sin scope/rol | Cubierto por tests | reglas `/api/users/me` y `/api/admin/**` | repetir con usuarios/roles reales |
| 200 con permiso | Cubierto por tests | JWT válido y sincronización local | repetir con token Entra real |
| Usuario local sin password Microsoft | Implementado | `CurrentUserController` y usuarios `ENTRA` | demostrar alta/consulta en PostgreSQL cloud |
| Monolito modular | Decisión aceptada por equipo | ADR-001 y paquetes por dominio | obtener aprobación docente por desviación |
| Microservicios | No cumplido literalmente | existe una sola unidad Spring Boot | aprobación explícita o extraer un segundo servicio |
| Repositorios frontend/backend | Implementado | `ProyectoTesis` y `ProyectoTesisBackend`, estrategia polyrepo del ADR-001 | mantener pipelines independientes |
| Base de datos cloud | Pendiente | PostgreSQL local y Testcontainers | elegir servicio, red, TLS, backups y secretos |
| Backend en EC2 | Pendiente | Dockerfile y health checks locales | instancia, SG, runtime, HTTPS y despliegue |
| API Gateway desplegado | Pendiente | arquitectura y rutas planificadas | HTTP API, integración, stage y custom domain opcional |
| CORS en Gateway | Pendiente cloud | CORS explícito en Spring | configurar origen real del frontend |
| JWT Authorizer en Gateway | Pendiente | issuer/audience definidos para Spring | crear authorizer y asociarlo a rutas privadas |
| Evidencia integral | Parcial | pruebas locales y documentación | video/demo Angular → Gateway → EC2 → DB cloud |
| Secretos fuera de Git | Implementado localmente | `.gitignore` y `.env.example` | usar SSM/Secrets Manager o variables protegidas |

## Orden de trabajo

1. Integrar las ramas Angular/MSAL y backend/JWT y mantener todas las pruebas verdes.
2. Confirmar con el docente que el monolito modular satisface la equivalencia de componentes.
3. Terminar de retirar el backend histórico de `ProyectoTesis` cuando el frontend consuma exclusivamente `ProyectoTesisBackend`.
4. Validar tenant, scope, roles, issuer y audience con cuentas de prueba.
5. Crear PostgreSQL cloud y desplegar el backend en EC2 sin `local-demo`.
6. Crear HTTP API Gateway, CORS, integración y JWT Authorizer.
7. Ejecutar y registrar matriz 401 / 403 / 200 por la URL pública del Gateway.
8. Preparar demostración integral y plan de recuperación.

## Decisiones que requieren confirmación humana

- Aprobación docente del monolito modular frente al texto que exige microservicios.
- Permisos y reglas de protección que se aplicarán a ambos repositorios GitHub.
- Cuenta, región, presupuesto y responsable de AWS.
- Servicio de PostgreSQL cloud y política de respaldo.
- Tenant, usuarios de prueba, scope y roles permitidos en Entra ID.

No se crearán recursos cloud ni secretos como parte de una preparación local.
