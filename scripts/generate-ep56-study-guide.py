from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = r"docs/guia-estudio-EP5-EP6.docx"
NAVY = "172B4D"
INDIGO = "5C51D8"
MINT = "36A98C"
PALE = "EEF0F8"
PALE_MINT = "EAF6F2"
GRAY = "D9DDE6"
TEXT = "25324A"


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def borders(table):
    tblPr = table._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "5")
        el.set(qn("w:color"), GRAY)
        b.append(el)
    tblPr.append(b)


def set_cell(cell, text, bold=False, color=TEXT, size=9.5):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text)
    r.bold = bold
    r.font.name = "Aptos"
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    borders(t)
    for i, h in enumerate(headers):
        set_cell(t.rows[0].cells[i], h, True, "FFFFFF", 9)
        shade(t.rows[0].cells[i], NAVY)
        if widths: t.rows[0].cells[i].width = Inches(widths[i])
    trPr = t.rows[0]._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    trPr.append(repeat)
    for idx, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            set_cell(cells[i], value, False, TEXT, 9.2)
            if idx % 2 == 1: shade(cells[i], "F5F7FA")
            if widths: cells[i].width = Inches(widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return t


def bullet(doc, text, style="List Bullet"):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p


def qa(doc, q, a):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(q)
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(INDIGO)
    p.paragraph_format.keep_with_next = True
    p2 = doc.add_paragraph(a)
    p2.paragraph_format.left_indent = Inches(.18)
    p2.paragraph_format.space_after = Pt(6)


doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(.7)
sec.bottom_margin = Inches(.65)
sec.left_margin = Inches(.75)
sec.right_margin = Inches(.75)
sec.page_width = Inches(8.5)
sec.page_height = Inches(11)

styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"].font.size = Pt(10.5)
styles["Normal"].font.color.rgb = RGBColor.from_string(TEXT)
styles["Normal"].paragraph_format.space_after = Pt(5)
for name, size, color in [("Title", 28, NAVY), ("Heading 1", 18, NAVY), ("Heading 2", 13, INDIGO), ("Heading 3", 11, MINT)]:
    s = styles[name]
    s.font.name = "Aptos Display" if name != "Heading 3" else "Aptos"
    s.font.size = Pt(size)
    s.font.bold = True
    s.font.color.rgb = RGBColor.from_string(color)
    s.paragraph_format.space_before = Pt(12 if name != "Title" else 0)
    s.paragraph_format.space_after = Pt(5)

# Remove the built-in Word Title paragraph rule for a clean cover heading.
title_ppr = styles["Title"]._element.get_or_add_pPr()
for border in title_ppr.findall(qn("w:pBdr")):
    title_ppr.remove(border)

header = sec.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
rr = header.add_run("NEXO  /  GUÍA DE ESTUDIO")
rr.bold = True; rr.font.name = "Aptos"; rr.font.size = Pt(8); rr.font.color.rgb = RGBColor.from_string(INDIGO)
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
rf = footer.add_run("EP5 · EP6  |  Streaming de eventos · Kafka")
rf.font.name = "Aptos"; rf.font.size = Pt(8); rf.font.color.rgb = RGBColor.from_string("697386")

# Cover page
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(86)
r = p.add_run("NEXO  /  EP5 + EP6")
r.bold = True; r.font.size = Pt(12); r.font.color.rgb = RGBColor.from_string(MINT)
t = doc.add_paragraph("Guía de estudio de streaming", style="Title")
t.paragraph_format.space_after = Pt(8)
for border in t._p.get_or_add_pPr().findall(qn("w:pBdr")):
    t._p.get_or_add_pPr().remove(border)
p = doc.add_paragraph()
r = p.add_run("Kafka · RabbitMQ · observabilidad · privacidad")
r.font.size = Pt(16); r.font.color.rgb = RGBColor.from_string(INDIGO)
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(18)
p.add_run("Conceptos, decisiones de arquitectura, pauta y preguntas para preparar una explicación técnica clara.")
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(18)
r = p.add_run("Conclusión para recordar")
r.bold = True; r.font.color.rgb = RGBColor.from_string(NAVY)
p = doc.add_paragraph("RabbitMQ distribuye trabajo asíncrono; Kafka conserva un flujo particionado para varios consumidores; Grafana ayuda a observar métricas. Son piezas distintas y se complementan.")
p.paragraph_format.space_after = Pt(14)

table(doc, ["Evaluación", "Qué debes demostrar"], [
    ("EP5 · implementación", "Código Java/Spring y Angular, productores/consumidores, administración de topics, configuración, errores y Compose."),
    ("EP6 · presentación", "Explicar arquitectura y decisiones, demostrar el flujo y responder preguntas en una exposición de 5–10 minutos."),
], [1.65, 5.35])
p = doc.add_paragraph("Preparada a partir de los encargos EP5 y EP6 entregados para Nexo. La pauta evalúa evidencia observada; esta guía no garantiza una calificación.")
p.paragraph_format.space_before = Pt(12)

doc.add_page_break()

doc.add_heading("1. Mapa mental de la arquitectura", level=1)
doc.add_paragraph("Sigue un evento de extremo a extremo. El frontend no publica directamente a Kafka: la capa backend conserva el dato y el flujo asíncrono lo entrega a los componentes especializados.")
table(doc, ["Paso", "Componente", "Responsabilidad"], [
    ("1", "Angular + API Nexo", "Autentica, valida permisos, guarda el mensaje y registra el evento outbox dentro de la transacción."),
    ("2", "RabbitMQ", "Enruta el evento por exchange y routing key a colas separadas. El ACK confirma una etapa de trabajo."),
    ("3", "Streaming Worker", "Consume la cola puente, transforma solo metadata del evento y publica en Kafka."),
    ("4", "Kafka", "Escribe en topics particionados con clave de evento y retención definida."),
    ("5", "Consumer groups", "Proyecciones independientes leen los topics y avanzan offsets propios."),
    ("6", "Kafbat UI / Grafana", "Kafbat inspecciona Kafka; Prometheus recoge métricas y Grafana las representa."),
], [0.6, 1.65, 4.75])

doc.add_heading("Por qué usar ambos brokers", level=2)
bullet(doc, "RabbitMQ es adecuado para repartir comandos/tareas a trabajadores, confirmar procesamiento y enviar fallos a DLQ.")
bullet(doc, "Kafka es adecuado para guardar eventos ordenados por partición durante un periodo, permitir relectura y conectar consumidores independientes.")
bullet(doc, "No son un reemplazo uno del otro. El puente entre ellos agrega una frontera de entrega y exige tratar duplicados.")

doc.add_heading("Garantía real del puente", level=2)
doc.add_paragraph("El flujo ofrece entrega al menos una vez, no exactly-once entre RabbitMQ y Kafka. El publicador puede confirmar Kafka y perder la conexión antes del ACK Rabbit; en ese caso Rabbit vuelve a entregar y Kafka puede ver un duplicado. Usa UUID estable, clave Kafka y consumidores idempotentes. El texto del chat no se copia al evento de streaming.")

doc.add_heading("2. Vocabulario que debes explicar", level=1)
table(doc, ["Concepto", "Explicación breve", "Cómo lo conectas a Nexo"], [
    ("Exchange", "Punto de entrada que enruta publicaciones.", "El topic exchange distribuye `message.*` a colas según bindings."),
    ("Routing key", "Nombre que compara el exchange con los bindings.", "`message.created` identifica el evento creado."),
    ("Queue", "Almacén de trabajo que consumen workers.", "Avisos, auditoría, actividad y el puente Kafka tienen responsabilidades separadas."),
    ("ACK / Unacked", "Confirmación de procesamiento / entrega aún no confirmada.", "ACK manual después del trabajo evita confirmar antes de tiempo."),
    ("DLQ", "Destino de mensajes que no pudieron procesarse.", "Se conserva para investigar; hay que corregir la causa antes de reprocesar."),
    ("Topic", "Flujo Kafka identificado por nombre.", "`nexo.messages.v1` y `nexo.activity.v1` separan usos."),
    ("Partición", "Subflujo ordenado que permite distribuir lectura/escritura.", "Tres particiones pueden permitir paralelismo si hay suficientes consumidores."),
    ("Réplicas / ISR", "Copias por partición / copias sincronizadas.", "RF=3 y min ISR=2 con `acks=all` equilibran disponibilidad y durabilidad."),
    ("Consumer group", "Consumidores que comparten el trabajo de un topic.", "Auditoría y analítica avanzan offsets separados."),
    ("Offset", "Posición de lectura dentro de una partición.", "Se confirma para que el grupo retome desde su progreso."),
    ("Lag", "Registros disponibles que aún no confirmó el grupo.", "Lag creciente alerta que el procesamiento va detrás."),
    ("Retención", "Tiempo/condición para conservar datos del topic.", "Messages/activity: 7 días; `.failed`: 14 días en el laboratorio."),
], [1.3, 2.7, 3.0])

doc.add_heading("3. Particiones, réplicas y disponibilidad", level=1)
doc.add_paragraph("Con tres particiones puedes procesar hasta tres unidades paralelas por grupo (una asignación activa de cada partición por consumidor). Añadir más consumidores que particiones deja algunos sin asignación. El orden se garantiza dentro de una partición, no de forma global para todo el topic.")
doc.add_paragraph("El factor de replicación 3 mantiene tres copias por partición. Con min ISR 2, el productor `acks=all` puede seguir escribiendo mientras haya dos réplicas sincronizadas. Si solo queda una, la escritura se bloquea para reducir el riesgo de confirmar una copia insuficiente. En un cluster real la ubicación de réplicas debe distribuirse entre brokers y dominios de falla.")
doc.add_paragraph("Importante para la exposición: el Compose de la pauta incluye tres brokers y tres nodos ZooKeeper, pero todos corren en un solo host. Demuestra configuración y conceptos, no tolerancia a la caída del host. El AWS anterior usa Kafka 4/KRaft con un broker y RF=1; no mezcles esas dos evidencias ni llames HA a ese despliegue.")

doc.add_heading("4. Topics y grupos de Nexo", level=1)
table(doc, ["Topic", "Uso", "Particiones / RF", "Retención"], [
    ("nexo.messages.v1", "Metadata mínima de eventos de mensaje para auditoría/consumidores.", "3 / 3", "7 días"),
    ("nexo.activity.v1", "Evento derivado de actividad para analítica.", "3 / 3", "7 días"),
    ("*.failed", "Mensajes no procesados tras reintentos.", "3 / 3", "14 días"),
], [1.7, 3.15, 1.1, 1.05])
doc.add_paragraph("Los grupos `nexo-message-audit` y `nexo-analytics` son independientes; cada grupo mantiene sus propios offsets. Dentro de un grupo cada partición solo se asigna a un miembro a la vez.")

doc.add_heading("5. Eventos y privacidad", level=1)
doc.add_paragraph("El DTO `NexoStreamEvent` incluye `eventId`, `eventType`, `routingKey`, `occurredAt` y `source`. Cada campo permite correlación, clasificación y diagnóstico. El mensaje de chat, correo, nombre y token se omiten para minimizar la exposición.")
table(doc, ["Control", "Qué significa", "Qué no significa"], [
    ("Hash BCrypt", "Verificación unidireccional de una contraseña local.", "No cifra ni protege automáticamente nombres, correo o mensajes."),
    ("TLS", "Protege la comunicación en tránsito entre extremos configurados.", "No prueba cifrado de la base en disco."),
    ("Cifrado RDS/EBS", "Protege almacenamiento/respaldos según la configuración cloud.", "No convierte los datos en anónimos ni reemplaza controles de acceso."),
    ("Retención Kafka", "Acota cuánto tiempo quedan eventos en el log.", "No borra por sí sola toda réplica, copia externa o log derivado."),
    ("OIDC/Entra", "Identifica y autentica usuarios con tokens.", "El consentimiento de Microsoft no es el aviso/base jurídica de Nexo."),
], [1.35, 2.9, 2.75])
doc.add_paragraph("Para hablar de cumplimiento legal, presenta controles técnicos como evidencia parcial. El responsable debe definir finalidades, base jurídica, plazos, aviso de privacidad, canal de derechos, encargados y transferencias. No prometas cumplimiento legal basándote solo en tener login o una base cifrada.")

doc.add_heading("6. Qué mirar durante una prueba", level=1)
table(doc, ["Lugar", "Qué revisar", "Interpretación"], [
    ("RabbitMQ Overview / Queues", "Rates publish/deliver/ack, consumers, Ready, Unacked y DLQ.", "Backlog cero puede ser normal si el worker procesa rápidamente; mira tasas."),
    ("Kafbat → Topics", "Dos topics, particiones, líderes, replicas, mensajes.", "El mensaje debería aparecer tras una acción nueva; no hace falta que permanezca visible en pantalla para estar en el log."),
    ("Kafbat → Consumer groups", "Estado, asignaciones, committed/end offset y lag.", "Lag que vuelve a cero sugiere que el grupo alcanzó el final observado."),
    ("Grafana", "Series temporales y rango de tiempo.", "No Data significa que la consulta no obtuvo serie; cero es un valor medido; revisa scrape y unidad."),
    ("Logs del worker", "Evento/UUID, topic, partición, offset, retry o fallo.", "No deberían imprimir cuerpo del chat ni credenciales."),
], [1.7, 2.7, 2.6])

doc.add_heading("Prueba corta de ida", level=2)
for step in [
    "Confirma que la plataforma y el laboratorio estén saludables y que Kafka UI muestre 3 brokers.",
    "Envía un mensaje sintético nuevo en Nexo. Anota hora aproximada, sin usar datos sensibles.",
    "En RabbitMQ observa un pulso de publicación y entrega; comprueba que la cola puente vuelve a Ready=0.",
    "En Kafbat comprueba los dos topics y el grupo; el offset debe avanzar y el lag volver a 0.",
    "Si el test falla, revisa primero logs del puente y el estado de las DLQ/`.failed`; no abras puertos públicos como primera medida.",
]: bullet(doc, step, "List Number")

doc.add_heading("7. Respuestas para preguntas frecuentes", level=1)
qa(doc, "¿Por qué RabbitMQ puede mostrar cero mensajes?", "Ready y Unacked son una instantánea. Si hay consumidores activos que confirman rápido, el backlog se vacía. Revisa también tasas de publicación, entrega y ACK; el cero no significa que no hubo tráfico.")
qa(doc, "¿Por qué Kafka si ya existe RabbitMQ?", "RabbitMQ distribuye trabajo operativo. Kafka mantiene un log particionado que varios grupos pueden leer de forma independiente y volver a procesar mientras exista retención.")
qa(doc, "¿Qué pasa si un consumidor se cae?", "El grupo reasigna particiones y retoma desde el offset confirmado; mientras tanto el lag puede subir. Las réplicas recuperan datos solo dentro de los límites del cluster y de los dominios de falla reales.")
qa(doc, "¿Tres réplicas garantizan disponibilidad?", "No por sí solas. El cluster necesita brokers independientes, ISR suficiente, almacenamiento/red y placement en dominios de falla. Tres contenedores en un host caen juntos si falla el host.")
qa(doc, "¿Es exactly-once?", "No de extremo a extremo entre RabbitMQ y Kafka. Se asume al menos una vez y se diseñan claves/consumidores idempotentes para tolerar duplicados.")
qa(doc, "¿Las contraseñas y datos personales están hasheados?", "No generalices. Las contraseñas locales usan un hash unidireccional; otros atributos necesitan minimización, acceso controlado, retención y cifrado en tránsito/reposo donde corresponda.")
qa(doc, "¿Grafana procesa los eventos?", "No. Observa métricas que expone/recoge otra capa y las presenta como paneles. Kafka transporta eventos; Grafana no sustituye el broker ni una base de datos.")

doc.add_heading("8. Preguntas de práctica", level=1)
for question in [
    "Explica por qué el outbox evita perder el evento entre el commit SQL y la publicación.",
    "¿Qué diferencia hay entre ACK RabbitMQ y offset confirmado en Kafka?",
    "Si un grupo tiene 4 miembros y 3 particiones, ¿qué ocurre con el cuarto miembro?",
    "¿Qué valor de lag esperarías luego de consumir todos los registros disponibles?",
    "¿Qué comportamiento esperas con RF=3 y min ISR=2 si solo queda una réplica sincronizada?",
    "¿Cómo correlacionarías un mensaje de prueba entre Nexo, RabbitMQ, Kafka y Grafana?",
    "¿Por qué los errores van a DLQ y qué revisión haces antes de reintentarlos?",
    "¿Qué datos personales podrían filtrarse aunque la contraseña use BCrypt?",
]:
    bullet(doc, question)

doc.add_heading("9. Tarjeta de repaso", level=1)
table(doc, ["Recuerda", "Frase corta"], [
    ("RabbitMQ", "Exchange enruta; queue espera trabajo; ACK confirma; DLQ conserva fallos."),
    ("Kafka", "Topic contiene; partición paraleliza; réplica copia; offset posiciona; lag mide atraso."),
    ("Consumer group", "Un grupo comparte particiones y offsets; grupos distintos leen independientemente."),
    ("Operación", "Observa tasas y estado, correlaciona hora/UUID, revisa logs sin datos sensibles."),
    ("Prudencia", "Distingue el lab de 3 brokers de AWS KRaft 1 broker; no declares HA o cumplimiento sin evidencia."),
], [1.55, 5.45])

# Keep headings with following paragraph and set core properties
for paragraph in doc.paragraphs:
    if paragraph.style.name.startswith("Heading"):
        paragraph.paragraph_format.keep_with_next = True

doc.core_properties.title = "Guía de estudio de streaming EP5 y EP6"
doc.core_properties.subject = "Nexo, Kafka, RabbitMQ, observabilidad y privacidad"
doc.core_properties.author = "Nexo"
doc.save(OUT)
print(OUT)
