# Contribuir a Nexo

Este monorepo contiene la SPA Angular, el monolito Spring Boot y la infraestructura
local. Antes de cambiar código, leer el [README](README.md) y
[SECURITY.md](SECURITY.md). La demo no verifica identidad real.

## Flujo de trabajo

1. Crear una issue para cambios amplios; definir alcance y criterios verificables.
2. Actualizar `main` y crear una rama corta con prefijo `feat/`, `fix/`, `docs/`,
   `test/`, `refactor/` o `chore/`.
3. Mantener commits pequeños y coherentes con Conventional Commits.
4. Ejecutar los controles pertinentes y abrir un pull request.
5. Revisar el diff, resolver observaciones y pasar CI.
6. Integrar con squash merge y eliminar la rama desde GitHub cuando esté integrada.

El [Git Pattern](docs/git-workflow.md) incluye comandos y protección de ramas.
La convención no crea automáticamente permisos ni protecciones.

## Reglas de código

- Backend organizado por dominios, dentro de una sola aplicación. Agregar un nuevo
  dominio cuando el comportamiento lo justifique; no crear controladores globales.
- Controladores con DTOs, validación de entrada y autorización del servidor.
- No confiar en remitentes, propietarios o roles elegidos por el navegador.
- Frontend standalone, rutas lazy y lógica compartida en servicios; usar signals
  cuando simplifiquen el estado y Reactive Forms para formularios.
- Reutilizar componentes visuales; probar foco, teclado y pantallas pequeñas.
- Las migraciones Flyway aplicadas son inmutables. Agregar una nueva y documentar
  impacto, compatibilidad y tratamiento de datos.
- Declarar dependencias antes de importarlas. Versionar el lockfile de npm.
- No cambiar comportamiento de seguridad para solucionar un fallo de desarrollo.

## Verificación

Con Docker iniciado:

```powershell
cd backend
.\mvnw.cmd verify
```

En otra terminal:

```bash
cd frontend
npm ci
npm run format:check
npm run test:ci
npm run build
```

Para formato, ejecutar `npm run format` dentro de frontend. Para salud local,
ejecutar `scripts/verify-local.ps1` desde la raíz con los servicios activos.

Extender suites existentes. Agregar pruebas para comportamiento nuevo o riesgos
reales, evitando pruebas que solo repitan configuración. Informar lo que no se
pudo comprobar; mocks WebRTC no demuestran conectividad real.

## Pull requests

Incluir motivo, archivos o dominios afectados, evidencia, resultados, migraciones
y riesgos. En cambios visuales, capturas reales con datos de demo. No incluir
credenciales, logs privados, volúmenes, `node_modules`, `dist` o `target`.

Las acciones remotas de CI no despliegan Nexo. Publicar código en GitHub no habilita
el servicio para producción ni implica una evaluación completa de seguridad.
