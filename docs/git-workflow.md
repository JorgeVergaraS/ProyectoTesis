# Git Pattern de Nexo

## Decisión

Un monorepo con **GitHub Flow**: `main` integra el prototipo y cada cambio utiliza
una rama corta y un pull request. Es suficiente para el equipo y el estado local
del proyecto; no requiere ramas permanentes de integración o release.

Esta guía define la convención. Las reglas remotas requieren configuración en
GitHub y no se activan por añadir este archivo.

## Ramas

| Prefijo | Uso | Ejemplo |
| --- | --- | --- |
| feat | Funcionalidad | feat/entra-login |
| fix | Corrección | fix/call-reconnection |
| docs | Documentación | docs/local-setup |
| refactor | Reorganización sin cambio funcional | refactor/user-service |
| test | Cobertura y fixtures | test/avatar-limits |
| chore | Mantenimiento | chore/update-dependencies |

Usar nombres cortos en minúsculas y guiones. No crear ramas vacías para simular
avance. Una rama debe corresponder a un cambio revisable.

Después de la publicación inicial:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/nombre-del-cambio
```

Revisar antes de preparar el commit:

```bash
git status --short
git diff
git add ruta/al/archivo
git diff --cached
git commit -m "feat(dominio): describir el cambio"
git push -u origin feat/nombre-del-cambio
```

Seleccionar archivos de forma explícita. No subir `.env`, artefactos, logs,
dependencias ni datos de PostgreSQL. Nunca resolver conflictos con `push --force`
sobre `main`.

## Commits

Formato: `tipo(alcance): descripción`. Alcance opcional, por ejemplo
`auth`, `user`, `messaging`, `realtime`, `frontend` o `infra`.

- `feat`: comportamiento nuevo.
- `fix`: corrección observable.
- `docs`: documentación.
- `refactor`: reorganización.
- `test`: pruebas.
- `ci`: automatización de validaciones.
- `build` o `chore`: dependencias y mantenimiento.

Cambios incompatibles deben explicarse en el PR y el cuerpo del commit; utilizar
`!` o un pie `BREAKING CHANGE:` cuando corresponda. No inventar una historia
por cada fase: el primer commit puede ser una instantánea completa del prototipo.
Los cambios posteriores deben conservar su historia real.

## Pull request

1. Explicar problema, solución y alcance.
2. Relacionar una issue cuando exista.
3. Incluir pruebas ejecutadas y limitaciones.
4. Adjuntar capturas en cambios visuales.
5. Documentar migraciones, variables y riesgos.
6. Revisar que no existan secretos ni archivos generados.
7. Esperar CI y revisión antes de integrar.

Usar **squash merge** con título convencional para mantener un commit por cambio
integrado. Si la historia interna de una rama tiene valor, el equipo puede acordar
otro método. Eliminar solo ramas ya integradas, no trabajo pendiente.

## Configuración manual recomendada en GitHub

Con permisos de administrador, en **Settings → Rules → Rulesets** crear una regla
para `main` y revisar su disponibilidad según la visibilidad y el plan:

- Requerir pull request antes de integrar.
- Exigir los checks **Frontend** y **Backend**, una vez que CI los haya registrado.
- Bloquear force pushes y eliminación de la rama.
- Resolver conversaciones antes de integrar.
- Mantener la rama actualizada antes del merge.
- Exigir revisión de CODEOWNERS cuando haya un segundo colaborador habilitado.

En un proyecto con un solo mantenedor, no exigir una aprobación que nadie más
pueda dar. Agregar revisores cuando el equipo tenga acceso. No eludir reglas
existentes para publicar.

En **Settings → General**, habilitar squash merge y, si el equipo lo desea,
eliminación automática de ramas integradas. El archivo CODEOWNERS propone a
`@JorgeVergaraS`; GitHub solo puede solicitar revisión si esa cuenta tiene permisos
adecuados. La guía no acredita que estos ajustes ya estén activos.

## CI

`.github/workflows/ci.yml` valida Angular y Spring con jobs independientes.
El backend utiliza Docker del runner Ubuntu para Testcontainers, sin la base local
ni credenciales de aplicación. Los permisos del workflow son de lectura.

Las Actions se fijan a commits completos verificados en sus repositorios oficiales.
Actualizar esos SHA de manera explícita, revisando cambios y volviendo a validar.
No usar `pull_request_target` para ejecutar código no confiable con permisos elevados.

## Releases

Todavía no hay una versión de producción. Etiquetar una entrega solo cuando sus
criterios estén aprobados, usando SemVer, notas de cambios, restricciones conocidas
y evidencia. No generar tags o releases que afirmen validaciones no ejecutadas.

## Referencias

- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow).
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
- [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
- [Uso seguro de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use).
