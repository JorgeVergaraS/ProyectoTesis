# Reconstrucción de AWS Academy

El laboratorio anterior fue eliminado. Esta rama reconstruye recursos nuevos en
`us-east-1`, cuenta `521227262079`, utilizando el rol existente `LabRole` y el perfil
`LabInstanceProfile`. No necesita crear usuarios IAM ni claves de acceso permanentes.

## Recursos y permisos

- EC2 `nexo-academic`, `t3.medium`, Amazon Linux 2023, IMDSv2, disco gp3 cifrado de 30 GiB.
- RDS PostgreSQL 17 `nexo-academic`, `db.t4g.micro`, 20 GiB cifrados, privado, Single-AZ.
- Grupo de aplicación: HTTPS/HTTP público; sin SSH, AMQP ni administración Rabbit pública.
- Grupo de base de datos: TCP 5432 únicamente desde el grupo de aplicación.
- SSM Session Manager para operar la instancia, sin puerto SSH público.
- S3 privado para el paquete de código; SSM SecureString para configuración privada.
- API Gateway HTTP con Lambda authorizer; Spring vuelve a validar JWT en cada servicio.

| Protocolo/puerto | Alcance | Servicio |
| --- | --- | --- |
| TCP 80/443 | Público | Web, API y señalización HTTPS/WSS de LiveKit |
| TCP 7881, UDP 7882 | Público | Transporte RTC de LiveKit para audio y transmisiones |
| UDP 3478 | Público | Listener TURN/STUN de Coturn (ya aplicado en AWS) |
| TCP 3478 | Público | Respaldo TURN para redes que bloquean UDP (pendiente de aplicar al grupo EC2) |
| UDP 49160–49200 | Público | Asignaciones relay de Coturn (ya aplicado en AWS) |
| TCP 15672/15692/15693 | Grupo de observabilidad | Consola de RabbitMQ y métricas Prometheus |
| TCP 9092 | Solo grupo de aplicación | Kafka desde los servicios Nexo |
| TCP 5432 | Solo grupo de aplicación | PostgreSQL/RDS |

TURN usa credenciales HMAC temporales entregadas por el backend autenticado; no debe
funcionar como relay anónimo. El estado consultado en AWS el 15 de octubre de 2026
mostró TCP 3478 ausente; la rama añade la regla y anuncia UDP/TCP, pero la regla
pública de TCP requiere confirmación antes de aplicarse. Las llamadas aún necesitan
prueba real entre redes distintas; TURN sobre TCP 3478 no cubre redes que solo permiten
TLS por 443.

Los dos nodos RabbitMQ comparten una EC2: cumplen la demostración de clúster, pero
no ofrecen tolerancia a la caída del host. Single-AZ y tamaños pequeños son decisiones
para el laboratorio académico. Detener el laboratorio limita la disponibilidad;
RDS, EIP y almacenamiento pueden consumir crédito incluso con EC2 detenida.

## Desplegar

Desde una sesión AWS temporal autorizada con Python y boto3:

```powershell
python scripts/package-cloud.py
python infra/aws/deploy.py
python infra/aws/deploy.py --apply --bundle .tmp/nexo-source.zip
python infra/aws/deploy.py --apply --stage gateway
# Actualizar código y servicios sin recrear la base ni la instancia:
python infra/aws/deploy.py --apply --stage release --bundle .tmp/nexo-source.zip
```

Por defecto el script solo consulta y muestra el plan. `--apply` crea recursos y
conserva sus identificadores en `~/.nexo/deployment-state.json`, junto con secretos.
No subir ese archivo a Git. `NEXO_DEPLOY_STATE` permite elegir otra ubicación privada.
`NEXO_AWS_SESSION_FILE` permite utilizar un JSON privado con credenciales temporales
de boto3; nunca debe incluirse en el paquete ni en capturas o evidencias públicas.

Registrar en Entra **Nexo Frontend**, plataforma SPA, la URL HTTPS de la nueva IP
elástica. Los identificadores de aplicaciones son configuración pública; el frontend
no utiliza client secret. `--admin-object-id` acepta el object ID del **usuario**
administrador de Entra, no el object ID de la aplicación. Sin esa asignación o rol
ADMIN, el servicio de administración deniega el acceso por defecto.

## Operación y evidencia

En `/opt/nexo` de EC2:

```sh
docker compose -f compose.platform.yml --profile web --profile media ps
docker compose -f compose.platform.yml exec -T rabbitmq1 rabbitmqctl cluster_status
docker compose -f compose.platform.yml logs --tail 100 backend event-worker rabbit-admin
```

La configuración `.env` y `runtime.json` son privadas. No mostrarlas en la presentación.
La integración de API Gateway incorpora una cabecera privada y Caddy rechaza llamadas
al origen que no la tengan. No copiar esa cabecera al navegador ni al JavaScript.

```sh
python scripts/verify-platform.py --help
```

El verificador es de lectura por defecto. `--allow-write` crea dos usuarios de prueba,
envía un mensaje, comprueba avisos/actividad y genera un mensaje inválido para verificar
las tres DLQ. Requiere acceso privado a Rabbit Management para esa última parte.
No ejecutarlo repetidamente sin necesidad: las cuentas y mensajes de prueba se conservan.

Antes de presentar: verificar HTTPS, flujo local y Entra, JWT válido/inválido en el
gateway, permisos del administrador, clúster de dos nodos, seis colas y llamada entre
dos dispositivos/redes. Una prueba de salud no demuestra por sí sola audio o vídeo.
