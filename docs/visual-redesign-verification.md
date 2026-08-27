
# Verificación del rediseño visual de Nexo

> Informe histórico de la etapa visual. Para las funciones de voz y fotos
> incorporadas posteriormente, ver [verificación actual](photos-and-calls-verification.md).

Fecha: 27 de agosto de 2026. Entorno local existente; sin cambios de backend, credenciales ni migraciones.

## Diseño aplicado

- Navegación principal con nombres: Inicio, Comunidades, Mensajes, Personas y Perfil. Se retiró la barra de servidores.
- Logotipo Nexo en violeta y azul, coherente también en el login.
- Bandeja independiente con búsqueda por nombre y filtros Todos / Personas / Grupos.
- Grupos de los que el usuario ya es miembro; descubrimiento de otros canales desde Comunidades.
- Burbujas entrantes a la izquierda y propias a la derecha, diferenciadas por el ID de la sesión.
- Avatares circulares con iniciales; datos de los perfiles locales existentes.
- Panel contextual con descripción y participantes reales.
- Inicio con resumen y accesos a las comunidades.
- En móvil, navegación superior y bandeja/conversación en vistas separadas; botón para regresar.
- Componentes standalone de navegación y bandeja dentro del dominio home. Se conservaron los límites de tamaño de CSS existentes.

No se representan llamadas activas, confirmaciones de lectura, mensajes sin leer, suscripciones premium ni cifrado de extremo a extremo inexistentes. Las llamadas se identifican como funcionalidad futura. Los textos de la bandeja indican cómo abrir una conversación: no simulan un último mensaje.

## Comprobaciones automáticas

Ejecutadas después de los cambios:

- `npm run build`: correcto, sin advertencias de presupuesto CSS. Carga inicial aproximada: 278,73 kB.
- `npm run test:ci`: 19 pruebas aprobadas, 7 archivos.
- `npm run format:check`: correcto.

Las pruebas añadidas en la suite existente de Home cubren:

- Clasificación de mensajes propios y recibidos.
- Filtros de personas/grupos y búsqueda sin cambiar la conversación activa.
- Exclusión de canales no unidos de la bandeja.
- Navegación al inicio y retorno al chat conservando el borrador.

Se mantuvieron las pruebas de envío, reintento idempotente, autenticación local, guard e interceptor. No se volvieron a ejecutar las pruebas backend en esta tarea visual; su verificación anterior está en local-demo-verification.md.

## Comprobaciones en navegador

- Escritorio a 1440 × 1000: navegación, bandeja, chat y panel contextual; sin desbordamiento horizontal.
- Móvil a 390 × 844: bandeja, búsqueda por Jean, selección de conversación, composición, envío y página Inicio; sin desbordamiento horizontal.
- Pantalla de 320 × 740: abrir general, mostrar/cerrar información, volver a la bandeja y acceder a Perfil; sin desbordamiento horizontal en el panel.
- Sesiones independientes de Jorge y Jean: envío desde Jorge, lectura en Jean, respuesta con Enter y recepción en Jorge.
- Conservación del historial existente y limpieza del campo después del envío.
- Logout de la sesión auxiliar de Jean devuelve el login.

Se añadieron dos mensajes de prueba identificados como comprobaciones del nuevo diseño al chat directo Jorge–Jean. No se borraron mensajes ni se cambiaron membresías.

## Límites que permanecen

Demo local con perfiles elegibles, no autenticación real Microsoft. Mensajería mediante HTTP y actualización cada dos segundos; sin WebSocket, WebRTC, adjuntos ni notificaciones. La presencia indica actividad reciente, no una conexión persistente.
