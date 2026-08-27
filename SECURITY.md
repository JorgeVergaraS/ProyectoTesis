# Seguridad de Nexo

## Estado del proyecto

Nexo es un prototipo local con un perfil explícito `local-demo`.
Cualquier persona que acceda a la demo puede elegir Jorge, Jean o Fernando.
El selector y las credenciales opacas separan sesiones de prueba, pero no
autentican a una persona real. No exponer esta demo a Internet.

El backend valida membresías y participantes; esas comprobaciones no compensan
la ausencia de autenticación real. No hay MSAL ni Resource Server JWT integrado.
No se debe usar con información académica, personal o institucional sensible.

## Datos y credenciales

- No versionar `.env`, tokens, passwords, claves privadas, backups ni logs privados.
- `.env.example` solo contiene marcadores y valores ilustrativos.
- No guardar secretos en Angular: su código y configuración son públicos.
- Las fotos de perfil son públicas en la demo. No subir imágenes privadas.
- Los mensajes no implementan cifrado de extremo a extremo.
- El audio WebRTC no se graba; el servidor guarda señalización temporal en memoria.
- No asumir que un perfil demo, su nombre o su foto acreditan identidad.
- Si se expone una credencial, revocarla o rotarla; borrarla del último archivo no
  la elimina del historial ni de copias existentes.

## Reportar un problema

No abrir issues públicas con secretos, datos personales o instrucciones de
explotación detalladas de un servicio activo. Si el repositorio tiene habilitado
**Security → Report a vulnerability**, utilizar ese canal privado. Si no aparece,
contactar al mantenedor por un canal privado acordado antes de compartir detalles.
No se presupone que el reporte privado esté habilitado.

Incluir versión o commit, componente afectado, condiciones de reproducción,
impacto y evidencia sanitizada. No se promete un plazo de respuesta ni se define
una política de soporte de producción en esta etapa.

## Antes de un despliegue real

Integrar identidad Microsoft, validar JWT y permisos, desactivar/eliminar las rutas
demo, revisar datos de prueba, usar HTTPS, gestionar secretos y respaldos, limitar
tráfico y tamaño de recursos y completar una revisión de seguridad y privacidad.
La infraestructura STUN/TURN para voz requiere su propia configuración de acceso.
