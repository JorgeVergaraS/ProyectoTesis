from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).with_name("nexo-messaging-snapshot.png")
W, H = 1600, 1100
BG = "#0B1020"
PANEL = "#131C30"
PANEL_ALT = "#17243A"
TEXT = "#EEF4FF"
MUTED = "#97A8C4"
TEAL = "#36D6B0"
AMBER = "#FFC46B"
RED = "#FF7F86"
LINE = "#293750"

font_dir = Path("C:/Windows/Fonts")
regular = ImageFont.truetype(str(font_dir / "segoeui.ttf"), 24)
small = ImageFont.truetype(str(font_dir / "segoeui.ttf"), 19)
mono = ImageFont.truetype(str(font_dir / "consola.ttf"), 18)
title = ImageFont.truetype(str(font_dir / "segoeuib.ttf"), 38)
heading = ImageFont.truetype(str(font_dir / "segoeuib.ttf"), 25)
big = ImageFont.truetype(str(font_dir / "segoeuib.ttf"), 31)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)


def rounded(box, fill, radius=18, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def label(pos, text, font=regular, fill=TEXT, anchor=None):
    d.text(pos, text, font=font, fill=fill, anchor=anchor)


# Header
d.rectangle((0, 0, W, 9), fill=TEAL)
label((64, 40), "NEXO  /  MENSAJERÍA Y OBSERVABILIDAD", small, TEAL)
label((64, 77), "Evidencia operacional del stack", title)
label((64, 134), "Consulta en EC2 vía AWS Systems Manager · 14 oct 2026, 23:03 CLT", small, MUTED)
rounded((1282, 50, 1536, 104), "#10382F", radius=24)
label((1409, 77), "SNAPSHOT REAL", small, TEAL, anchor="mm")

# Main RabbitMQ panel
rounded((64, 190, 1536, 790), PANEL, radius=22, outline=LINE, width=2)
label((96, 216), "RabbitMQ", heading)
label((96, 251), "Broker en ejecución · RabbitMQ 4.2.9 · clúster de 2 nodos unido", small, MUTED)
rounded((1323, 213, 1497, 257), "#10382F", radius=19)
label((1410, 235), "●  ACTIVO", small, TEAL, anchor="mm")

# Metric cards
metrics = [
    (96, "NODOS", "2", "Clúster de 2 nodos; sano", TEAL),
    (454, "COLAS", "6", "0 mensajes listos o sin confirmar", TEAL),
    (812, "CONSUMIDORES", "3", "1 en cada una de 3 colas activas", TEAL),
    (1170, "CONEXIONES", "3", "5 canales AMQP en uso", TEAL),
]
for x, caption, value, detail, accent in metrics:
    rounded((x, 292, x + 322, 408), PANEL_ALT, radius=16)
    label((x + 20, 309), caption, small, MUTED)
    label((x + 20, 337), value, big, accent)
    label((x + 20, 378), detail, small, TEXT)

# Queue table
rounded((96, 432, 1504, 737), "#10192B", radius=14)
label((120, 449), "COLA", small, MUTED)
label((910, 449), "READY", small, MUTED, anchor="mm")
label((1050, 449), "UNACK", small, MUTED, anchor="mm")
label((1195, 449), "CONSUMIDORES", small, MUTED, anchor="mm")
label((1404, 449), "BYTES EN COLA", small, MUTED, anchor="mm")
d.line((120, 480, 1480, 480), fill=LINE, width=2)
queues = [
    ("nexo.conversation.activity", "0", "0", "1", "0"),
    ("nexo.conversation.activity.failed", "0", "0", "0", "0"),
    ("nexo.message.audit", "0", "0", "1", "0"),
    ("nexo.message.audit.failed", "0", "0", "0", "0"),
    ("nexo.message.created", "0", "0", "1", "0"),
    ("nexo.message.created.failed", "0", "0", "0", "0"),
]
for i, row in enumerate(queues):
    y = 493 + i * 37
    if i % 2 == 0:
        rounded((110, y - 4, 1488, y + 30), "#142137", radius=7)
    label((122, y), row[0], mono)
    for x, val in zip((910, 1050, 1195, 1404), row[1:]):
        label((x, y + 2), val, mono, TEAL if val != "0" else TEXT, anchor="mm")

# Traffic panel and implementation inventory
rounded((64, 818, 776, 1030), PANEL, radius=20, outline=LINE, width=2)
label((96, 844), "Tráfico observado", heading)
label((96, 892), "3 conexiones de aplicaciones · user nexo", small, MUTED)
label((96, 932), "6.7 KiB", big, TEAL)
label((96, 973), "recibidos en conexiones actuales", small, MUTED)
label((430, 932), "4.1 KiB", big, TEAL)
label((430, 973), "enviados en conexiones actuales", small, MUTED)
label((96, 1005), "Contadores recv_oct/send_oct desde la apertura de cada conexión.", small, MUTED)

rounded((800, 818, 1536, 1030), PANEL, radius=20, outline=LINE, width=2)
label((832, 844), "Inventario de despliegue", heading)
rounded((832, 892, 1163, 978), "#30251A", radius=13)
label((856, 907), "KAFKA", small, AMBER)
label((856, 937), "NO DESPLEGADO", heading, AMBER)
rounded((1182, 892, 1504, 978), "#302026", radius=13)
label((1206, 907), "GRAFANA", small, RED)
label((1206, 937), "NO DESPLEGADO", heading, RED)
label((832, 994), "No hay servicios, paneles ni datos históricos de Kafka/Grafana en este stack.", small, MUTED)

# Footer note
label((64, 1060), "RabbitMQ consultado con rabbitmqctl en la EC2. No es una captura de RabbitMQ Management ni una interfaz Grafana.", small, MUTED)
img.save(OUT, optimize=True)
print(OUT)
