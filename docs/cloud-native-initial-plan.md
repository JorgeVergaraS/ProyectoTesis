# Plan inicial cloud-native - Nexo

Fecha de inicio: 2 de septiembre de 2026  
Asignatura: DSY1107 - Desarrollo Cloud Native I  
Modalidad: trabajo en pareja

## 1. Proyecto y objetivo

**Nexo** es una comunidad universitaria FullStack existente, construida con Angular,
Spring Boot y PostgreSQL. La adaptación cloud-native mantendrá la solución actual y
añadirá autenticación institucional con Microsoft Entra ID, autorización por scope o
rol, publicación segura mediante Amazon HTTP API Gateway y despliegue del backend en
AWS EC2.

El objetivo técnico de esta etapa es demostrar un flujo OAuth 2.0 / OpenID Connect
Authorization Code con PKCE en Angular, adjuntar automáticamente el Access Token y
validarlo tanto en API Gateway como en Spring Security.

## 2. Funcionalidad y endpoint seleccionados

- Funcionalidad: inicio/cierre de sesión y consulta del perfil autenticado.
- Ruta Angular pública: `/login`.
- Rutas Angular protegidas: `/home` y `/profile`.
- Endpoint protegido: `GET /api/users/me`.
- Permiso delegado esperado: `access_as_user`.
- Scope completo: `api://0f2d7cee-cabb-4482-900d-64fb07f5f81d/access_as_user`.
- Respuesta exitosa: perfil sincronizado en PostgreSQL sin almacenar una contraseña
  para identidades Microsoft.

## 3. Responsabilidades

| Responsable | Trabajo principal | Entregables |
|---|---|---|
| Jorge Vergara Stuardo | Angular/MSAL, protección de rutas, pruebas frontend, coordinación Git y evidencia de interfaz | Frontend compilable, pruebas, capturas de login/callback/logout y PR frontend |
| Segundo integrante - nombre por confirmar | Spring Security/JWT, EC2, HTTP API Gateway, CORS/JWT Authorizer y pruebas de API | Backend compilable, despliegue, rutas Gateway, matriz 200/401/403 y PR backend |
| Ambos | Revisión cruzada, informe, arquitectura y presentación | README, informe, diagrama, guion de 5-10 minutos y revisión de PR |

El nombre del segundo integrante debe confirmarse antes de entregar; no se infiere a
partir de los usuarios ficticios Jorge, Jean y Fernando de la demo local.

## 4. Plan de dos semanas

### Semana 1 - funcionamiento local y seguridad

1. Diagnosticar Angular, Spring Boot, PostgreSQL y ramas Git.
2. Seleccionar y documentar `GET /api/users/me`.
3. Configurar MSAL con tenant, client ID, redirect URI SPA y scope de Nexo.
4. Implementar callback, cuenta activa, token silencioso, interceptor y guards.
5. Mantener sesiones local y Microsoft diferenciadas.
6. Configurar Spring Security para firma, issuer, audience, vigencia, scopes y roles.
7. Sincronizar el usuario Entra en PostgreSQL sin contraseña.
8. Automatizar pruebas 200, 401 y 403 y revisar que ningún token completo se registre.

### Semana 2 - nube, evidencias y entrega

1. Preparar artefacto backend y variables seguras para EC2.
2. Desplegar backend en EC2 con acceso mínimo necesario.
3. Crear HTTP API Gateway, integración, rutas, stage y CORS restringido.
4. Configurar JWT Authorizer con issuer y audience de Nexo.
5. Apuntar Angular al URL del stage y ejecutar pruebas extremo a extremo.
6. Capturar Entra, EC2, Gateway, Network y respuestas 200/401/403 con datos redactados.
7. Actualizar README, informe, diagrama y presentación.
8. Crear PR separados hacia `develop` y solicitar revisión cruzada.

## 5. Criterios de aceptación

| Caso | Resultado esperado | Evidencia |
|---|---:|---|
| Sin `Authorization` | 401 | Respuesta de API/Gateway sin token |
| Token malformado o expirado | 401 | Respuesta sin mostrar el JWT completo |
| JWT válido sin scope/rol requerido | 403 | Claims o autoridades redactadas y respuesta |
| JWT válido con `access_as_user` o rol permitido | 200 | JSON de `/api/users/me` y usuario sincronizado |
| Visita anónima a `/home` o `/profile` | Redirección a `/login` | Captura de ruta |
| Visita autenticada a `/login` | Redirección a `/home` | Captura de ruta |
| Logout Microsoft | Sesión cerrada y retorno controlado | Captura sin datos sensibles |

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Redirect URI distinta entre Angular y Entra | Bucle o error OAuth | Usar exactamente `http://localhost:4200`; no registrar `127.0.0.1` como redirect SPA |
| Audience o issuer incorrectos | 401 para tokens válidos | Centralizar valores y probar claims redactados |
| Scope ausente | 403 | Solicitar `access_as_user` en login y token silencioso; validar autoridad en backend/Gateway |
| Mezcla de JWT local, credencial demo y JWT Entra | Autorización incorrecta | Separar proveedores y aplicar cada token solo a su API |
| Exposición de secretos o tokens | Incidente de seguridad | `.gitignore`, variables de entorno, capturas redactadas y ningún Client Secret en Angular |
| CORS demasiado amplio o preflight fallido | Bloqueo o exposición | Permitir solo orígenes, métodos y headers requeridos |
| Configuración manual no reproducible | Entrega difícil de repetir | Registrar comandos, variables, rutas y resultados sin valores secretos |
| Diferencia entre monolito modular actual y exigencia de “varios microservicios” del PDF | Riesgo de pauta | Confirmar con el docente si un único backend Spring Boot es aceptable antes de dividir servicios |
| Rúbrica menciona autorregistro en tenant, pero se usa Entra ID organizacional | Flujo no disponible como en External ID/B2C | Confirmar si basta usuario institucional precreado; no cambiar de tenant ni crear flujo B2C sin aprobación |

## 7. Estado al iniciar la fase cloud

- Frontend: 30/30 pruebas aprobadas y build exitoso; existe un warning de presupuesto
  inicial del bundle que no bloquea la compilación.
- Backend: 24/24 pruebas aprobadas con PostgreSQL Testcontainers.
- Casos automatizados: 200, 401 sin token, 401 token malformado/expirado y 403 sin permiso.
- Pendiente: validación Microsoft real en navegador, evidencia de Entra y despliegue
  EC2/API Gateway.

## 8. Reglas de evidencia y Git

- Nunca incluir contraseñas, MFA, Client Secrets, claves privadas ni JWT completos.
- Redactar `Authorization` como `Bearer eyJ...<redactado>`.
- Trabajar frontend en `feature/auth-msal` y backend en
  `feature/backend-entra-jwt`.
- Usar Conventional Commits y PR separados hacia `develop`.
- Solicitar revisión a otro integrante antes de fusionar.
