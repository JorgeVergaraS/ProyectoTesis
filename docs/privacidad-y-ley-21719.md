# Revisión de privacidad de Nexo para la Ley 21.719

**Revisión técnica del código:** 14-10-2026. **Entrada en vigencia general de la Ley 21.719:** 01-12-2026. Esta nota es un inventario técnico y una lista de trabajo; no es asesoría legal ni una declaración de cumplimiento.

## Qué muestra el aviso de Microsoft

La captura compartida informa que las aplicaciones **Nexo Frontend** y **Nexo Web** se conectaron a una cuenta Microsoft. El repositorio contiene un cliente SPA MSAL (Frontend) y una API protegida que publica el permiso delegado propio `access_as_user` (Nexo Web). Ver ambos nombres en la pantalla de cuenta Microsoft es coherente con ese diseño cliente/recurso. La captura, por sí sola, no enumera todos los consentimientos efectivos ni prueba qué información almacena Nexo.

En el código revisado, el inicio de sesión y el interceptor solicitan el scope API propio de Nexo. No encontré solicitudes explícitas de Microsoft Graph para correo, contactos, archivos u otros recursos. Microsoft documenta que MSAL.js agrega por defecto `openid`, `profile` y `offline_access`; este último permite recibir refresh tokens y explica el texto “mantener el acceso” del consentimiento. Nexo configura MSAL en `sessionStorage`, usa ese mecanismo para renovación silenciosa y no guarda los tokens en su PostgreSQL según el código revisado. Esto sigue siendo acceso persistente delegado para la sesión del cliente y debe informarse con claridad; deshabilitar renovación silenciosa exigiría reautenticaciones más frecuentes. Una organización externa puede exigir que su administrador apruebe el permiso delegado de Nexo según sus políticas. La aplicación no debe eludir esa aprobación ni pedir permisos adicionales para evitar el aviso.

## Inventario observado en el código

| Dato | Uso observado | Persistencia observada |
|---|---|---|
| Identidad Entra (`tid:oid`), correo/usuario y nombre | Autenticar y crear/actualizar el perfil de Nexo | PostgreSQL (`nexo.users`) |
| Nombre visible, nombre de usuario, biografía, color y disponibilidad | Perfil y colaboración | PostgreSQL (`nexo.users`) |
| Foto de perfil | Mostrar avatar | Bytes en PostgreSQL (`nexo.user_avatars`), máximo 2 MiB |
| Mensajes y metadatos de conversación | Mensajería, notificaciones y sincronización | PostgreSQL (`nexo.messages` y tablas relacionadas) |
| Eventos de mensajes | Entrega/proyección; la integración Kafka nueva publica identificadores y metadatos técnicos, sin cuerpo del mensaje ni correo | Outbox/auditoría PostgreSQL; Kafka, RabbitMQ y métricas según retención/configuración. Un UUID puede seguir siendo vinculable a una persona a través de la base de datos; no equivale a anonimización |
| Transmisión en vivo y llamadas | Video/audio en tiempo real y metadatos de sala/participación | El backend conserva metadatos de emisión; el diseño no graba los medios en PostgreSQL. Verificar proveedores, regiones y configuración del servidor multimedia desplegado |
| Tokens de Microsoft | Autenticación delegada | Caché de MSAL en `sessionStorage` del navegador; el backend valida el bearer token y no hay evidencia en el código revisado de persistirlo en PostgreSQL |

La vida útil real de copias, snapshots, logs, colas y backups depende de la configuración efectiva de AWS/servicios y debe inventariarse por separado. El código permite eliminar mensajes propios y fotos de perfil; no se encontró un flujo de exportación o eliminación integral de cuenta que elimine o anonimice perfil, pertenencias, relaciones y contenido conforme a una política aprobada.

## Brechas y decisiones pendientes

1. **Aviso de privacidad público:** redactar y publicar información accesible antes del registro que identifique al responsable y contacto, datos y fuentes, fines, fundamento jurídico, destinatarios/encargados, transferencias internacionales, plazos, derechos y canal/procedimiento para ejercerlos. El propietario debe proporcionar identidad y contacto; no se deben inventar.
2. **Finalidad y base jurídica:** el responsable debe definir y documentar la base para cada tratamiento (cuentas, colaboración, mensajería, seguridad/telemetría y analítica). El consentimiento Microsoft es autorización de inicio de sesión/API, no sustituye la base jurídica ni el aviso de privacidad de Nexo.
3. **Retención y borrado:** fijar plazos por categoría y por copia (DB, outbox/auditoría, broker Kafka/RabbitMQ, métricas/logs y backups), con eliminación verificable y excepciones justificadas. No se fijan plazos arbitrarios en esta revisión porque pueden afectar obligaciones y expectativas de usuarios.
4. **Derechos del titular:** definir un canal con responsables, verificación de identidad, plazos y trazabilidad para acceso, rectificación, supresión, oposición, bloqueo y portabilidad cuando correspondan. Diseñar la eliminación de cuenta considerando mensajes compartidos y obligaciones aplicables; no borrar datos de producción hasta aprobar la política y sus efectos.
5. **Encargados y transferencias:** documentar AWS, Microsoft y cualquier proveedor multimedia/analítico, regiones, contratos, subencargados, transferencias y medidas contractuales/técnicas. La región AWS configurada no acredita por sí sola cumplimiento de transferencias internacionales.
6. **Minimización y seguridad:** mantener el scope propio de Nexo y evitar permisos Microsoft Graph innecesarios; no registrar tokens ni cuerpos/respuestas de autenticación. El registro de error de sincronización se redujo a estado y tipo de error para no volcar mensajes/cuerpos potencialmente sensibles.
7. **Menores y operación real:** determinar población usuaria, tratamiento de datos sensibles/menores, roles de acceso, respuesta a incidentes, control de respaldos y evidencia de restauración/borrado. La política debe reflejar el producto y uso reales, no solo esta rama.

## Lista para cerrar con el responsable del producto

- [ ] Identidad legal del responsable y correo de privacidad/ejercicio de derechos.
- [ ] Finalidades y base jurídica por categoría, revisadas por asesoría competente.
- [ ] Plazos aprobados para datos activos, inactividad, eventos y backups.
- [ ] Procedimientos implementados y probados para solicitudes de derechos.
- [ ] Inventario de encargados, ubicaciones, contratos y transferencias.
- [ ] Aviso público revisado y publicado; revisar que las pantallas de alta/login lo enlacen.
- [ ] Revisión de permisos efectivos y consentimiento de ambas aplicaciones en Entra. Confirmar que `offline_access` solo se usa para renovación silenciosa de la sesión y que no existen permisos Graph no requeridos.
- [ ] Validación de que la infraestructura desplegada, logs y broker respetan las decisiones anteriores.

## Fuentes legales oficiales

- [Ley 21.719, texto oficial en Ley Chile](https://www.bcn.cl/leychile/Navegar?idNorma=1209272&idParte=10527471&idVersion=2026-12-01): principios de finalidad, proporcionalidad, limitación de conservación, seguridad, transparencia y confidencialidad; derechos de los titulares.
- [BCN, balance legislativo de la Ley 21.719](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13): publicación y fecha general de entrada en vigencia, 1 de diciembre de 2026.
- [Microsoft Learn, scopes en MSAL.js](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/resources-and-scopes): MSAL agrega por defecto `openid`, `profile` y `offline_access`.
- [Microsoft Learn, refresh tokens](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens): los refresh tokens emitidos a aplicaciones SPA tienen una vida de 24 horas.
