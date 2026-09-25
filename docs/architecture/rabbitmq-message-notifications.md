# Arquitectura de RabbitMQ para avisos de mensajes

- Estado: implementada y desplegada
- Fecha: 25 de septiembre de 2026
- Alcance: mensajería asíncrona y avisos persistentes

## Diagrama de arquitectura

```mermaid
flowchart TB
    subgraph USERS[Personas usuarias]
        EMITTER[Angular · persona emisora]
        RECEIVER[Angular · persona receptora]
    end

    ENTRA[Microsoft Entra ID<br/>Inicio de sesión y Access Token]

    subgraph AWS[AWS · EC2 nexo-backend-academico]
        subgraph NET[Red Docker privada · nexo-cloud]
            WEB[Caddy · nexo-web<br/>HTTPS y SPA]
            API[Spring Boot · nexo-backend<br/>auth · messaging · events]
            MQ[[RabbitMQ · nexo-rabbitmq<br/>nexo.message.created]]
            DLQ[[Cola de fallos<br/>nexo.message.created.failed]]
            MEDIA[LiveKit · nexo-livekit<br/>Llamadas y transmisiones]
        end
    end

    DB[(Amazon RDS PostgreSQL<br/>mensajes · outbox · avisos)]

    EMITTER -->|1 · HTTPS + token| WEB
    RECEIVER -->|7 · consulta workspace| WEB
    WEB -->|2 · /api| API
    ENTRA -.->|Valida identidad| EMITTER
    ENTRA -.->|Valida identidad| RECEIVER

    API -->|3 · misma transacción<br/>mensaje + evento pendiente| DB
    API -->|4 · publica message.created.v1<br/>solo identificadores| MQ
    MQ -->|5 · entrega al consumidor| API
    API -->|6 · crea aviso idempotente| DB
    API -->|8 · devuelve avisos pendientes| WEB
    WEB -->|9 · Avisos de mensajes| RECEIVER

    MQ -->|3 intentos fallidos| DLQ
    API <-->|Tokens y metadatos| MEDIA
    EMITTER <-->|WebRTC de medios| MEDIA
    RECEIVER <-->|WebRTC de medios| MEDIA

    classDef client fill:#251947,stroke:#9a78ff,color:#fff;
    classDef app fill:#102334,stroke:#5edacc,color:#fff;
    classDef queue fill:#3a2410,stroke:#f0a84b,color:#fff;
    classDef data fill:#123224,stroke:#67d89f,color:#fff;
    class EMITTER,RECEIVER client;
    class WEB,API,MEDIA app;
    class MQ,DLQ queue;
    class DB data;
```

## Cómo se representa

| Forma o línea | Significado |
| --- | --- |
| Rectángulos morados | Navegadores Angular de las personas usuarias |
| Rectángulos azules | Servicios que se ejecutan en EC2 |
| Figuras naranjas | Cola principal y cola de fallos de RabbitMQ |
| Cilindro verde | Datos persistentes en Amazon RDS |
| Flechas continuas numeradas | Recorrido real de un mensaje y su aviso |
| Flechas punteadas | Autenticación externa mediante Microsoft Entra |
| Marco `nexo-cloud` | Red Docker privada; RabbitMQ no tiene puertos públicos |

Los números muestran el orden lógico. La respuesta HTTP del mensaje puede finalizar
después del paso 3: la creación del aviso continúa de forma asíncrona en los pasos
4 a 6. La persona receptora lo ve cuando Angular actualiza el workspace.

## Qué representa cada almacenamiento

```text
PostgreSQL / RDS
├── messages                 mensaje definitivo del chat
├── message_outbox           evento pendiente de publicar
└── message_notifications    aviso persistente de cada destinatario

RabbitMQ
├── nexo.message.created           eventos listos para el consumidor
└── nexo.message.created.failed    eventos que agotaron los reintentos
```

RabbitMQ transporta el trabajo; RDS conserva el estado del producto. Por eso un
reinicio del consumidor no elimina mensajes ni avisos, y una caída temporal del
broker no obliga a rechazar el mensaje del chat.

## Relación con la interfaz

![Aviso generado mediante RabbitMQ](../images/nexo-rabbitmq-notifications.png)

El bloque **Avisos de mensajes** es la representación visible del resultado. La
interfaz no se conecta directamente al broker: consulta al backend, que lee
`message_notifications`, comprueba membresía y devuelve únicamente los avisos de
la identidad autenticada.

La explicación funcional y el guion de demostración están en
[RabbitMQ en Nexo: explicación y evidencia visual](../rabbitmq-explicacion-evidencia.md).
La configuración, recuperación y pruebas están en
[RabbitMQ aplicado a Nexo](../rabbitmq-en-nexo.md).
