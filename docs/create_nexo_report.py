from pathlib import Path
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "Nexo-Frontend-Azure-Step-by-Step.docx"
EVIDENCE = ROOT / "docs" / "evidence"

def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)

def cell_text(cell, value, bold=False, color=None):
    cell.text = ""
    run = cell.paragraphs[0].add_run(value)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)

def caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(89, 89, 89)

def numbered(doc, items):
    for index, text in enumerate(items, 1):
        doc.add_paragraph(f"{index}. {text}")

doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.65)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)
doc.styles["Normal"].font.name = "Aptos"
doc.styles["Normal"].font.size = Pt(10.5)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("NEXO")
r.bold = True
r.font.size = Pt(32)
r.font.color.rgb = RGBColor(0, 0, 0)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Autenticación Nexo: registro, login y Microsoft Entra ID")
r.bold = True
r.font.size = Pt(20)
r.font.color.rgb = RGBColor(0, 0, 0)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run("Guía paso a paso de Azure, MSAL, JWT y publicación académica — 10 de septiembre de 2026").font.size = Pt(11)

p = doc.add_paragraph()
p.add_run("Alcance. ").bold = True
p.add_run("Este informe documenta la configuración de Microsoft Azure para Nexo: registro de aplicaciones, Microsoft Entra ID, MSAL, permisos OAuth2, JWT, URI de retorno, validación en navegador y su conexión con el frontend publicado en EC2. También incluye capturas de la interfaz y una guía de comprobación. No se incluyen contraseñas, client secrets ni tokens.")

heading(doc, "1. Resultado final")
doc.add_paragraph("Se dejaron dos registros funcionales en el tenant local de Microsoft Entra:")
table = doc.add_table(rows=1, cols=4)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = "Table Grid"
for i, value in enumerate(["Registro", "Uso", "Application (client) ID", "Estado"]):
    cell_text(table.rows[0].cells[i], value, True, (255, 255, 255))
    shade(table.rows[0].cells[i], "293E78")
for row in [
    ("Nexo Frontend", "SPA Angular", "480a8cf4-c729-4ca1-8043-6c1198dfaceb", "Activo"),
    ("Nexo Web", "API protegida / scope", "0f2d7cee-cabb-4482-900d-64fb07f5f81d", "Activo"),
]:
    cells = table.add_row().cells
    for i, value in enumerate(row):
        cell_text(cells[i], value)
doc.add_paragraph("Tenant ID: 21a4bbb2-fc48-4053-a98e-b805aa2306cc")
doc.add_paragraph("Redirect URI SPA de desarrollo: http://localhost:4200")
doc.add_paragraph("Redirect URI SPA publicado: https://34.196.97.226.nip.io")
doc.add_paragraph("Scope: api://0f2d7cee-cabb-4482-900d-64fb07f5f81d/access_as_user")

heading(doc, "2. Paso a paso realizado en Azure")
numbered(doc, [
    "Se abrió Microsoft Azure > Microsoft Entra ID > App registrations y se confirmó el tenant Default Directory.",
    "Se creó la aplicación Nexo Web para representar la API protegida y se verificó su Application (client) ID.",
    "En Expose an API se configuró el Application ID URI con formato api://<client-id>.",
    "En Expose an API > Add a scope se creó access_as_user como permiso delegado, con consentimiento para usuarios y administradores.",
    "Se creó Nexo Frontend como aplicación Single-page application (SPA), agregando http://localhost:4200 y la URI pública de EC2.",
    "En API permissions se agregó el permiso delegado de Nexo Web y se concedió consentimiento del tenant cuando Azure lo solicitó.",
    "Se revisaron Overview, Authentication, Certificates & secrets y API permissions; Nexo Frontend no utiliza client secret porque es una SPA.",
    "Se eliminaron las App Registrations antiguas Pedidos360-API-BFF y Pedidos360-Frontend-Angular para evitar confundir client IDs y redirect URIs.",
    "Se actualizó environment.ts y la configuración de producción para usar tenant, client ID, authority, redirectUri y scope de Nexo.",
    "Después del cambio de IP elástica, se agregó nuevamente la URI pública de EC2 y se validó el botón Continuar con Microsoft en Brave/Chrome.",
])

heading(doc, "3. Evidencia visual")
for filename, text in [
    ("01-nexo-frontend-overview.png", "Registro Nexo Frontend: SPA activa, tenant correcto y redirect URI configurado."),
    ("02-nexo-api-scope.png", "Registro Nexo Web: Application ID URI y scope access_as_user habilitado."),
    ("03-azure-clean-nexo-only.png", "Lista final: solo permanecen Nexo Frontend y Nexo Web; Pedidos360 fue retirado."),
    ("04-nexo-login-rendered.png", "Login visual de Nexo levantado en http://localhost:4200/login, con botón Continuar con Microsoft."),
    ("05-login-validation-errors.png", "Validación en línea: correo con formato incorrecto y contraseña menor a 8 caracteres."),
    ("06-login-success.png", "Login local exitoso: redirección a /home y datos del usuario autenticado."),
    ("07-session-expired-msal.png", "Caso de diagnóstico: sesión Microsoft expirada y necesidad de iniciar sesión nuevamente."),
]:
    path = EVIDENCE / filename
    if path.exists():
        doc.add_picture(str(path), width=Inches(6.45))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption(doc, text)

heading(doc, "4. Flujo de registro y login")
numbered(doc, [
    "En /login, el usuario puede continuar con Microsoft o alternar al formulario de correo.",
    "El registro exige nombre, correo válido y contraseña de mínimo 8 caracteres. Los errores aparecen debajo del campo y el botón no envía formularios inválidos.",
    "El backend vuelve a validar el payload con Bean Validation, verifica que el correo no esté registrado y genera un JWT local al crear la cuenta.",
    "El login compara la contraseña recibida contra el hash BCrypt almacenado y entrega un JWT con issuer nexo-local y audience nexo-api.",
    "El interceptor adjunta Authorization: Bearer <JWT> a /api/users/me; la guarda permite /home solo con sesión válida.",
    "Microsoft Entra mantiene el flujo OAuth2/OIDC; sus tokens se validan con issuer, audience, firma y expiración mediante el Resource Server.",
])

heading(doc, "5. Cambios en el frontend")
doc.add_paragraph("El frontend incluye formularios reactivos, validación visual accesible, interceptor para JWT local, interceptor MSAL condicionado a cuentas Microsoft, guardas compatibles con ambos métodos y las rutas /login, /home y /profile.")
doc.add_paragraph("Archivo actualizado: frontend/src/environments/environment.ts")
doc.add_paragraph("La configuración de producción usa los valores cloud recuperados en la EC2; no se versiona dentro de este repositorio para evitar exponer configuración sensible. No se inventaron credenciales ni se guardaron secretos.")

heading(doc, "6. Persistencia y seguridad de datos")
doc.add_paragraph("La migración V5 agrega password_hash y permite identity_provider=LOCAL. La migración V6 elimina la restricción histórica incompatible con usuarios locales. La tabla nexo.users conserva el email, username, display_name, estado y timestamps; password_hash contiene únicamente un hash BCrypt y nunca la contraseña original.")
doc.add_paragraph("Consulta de verificación ejecutada en PostgreSQL: SELECT email, identity_provider, password_hash IS NOT NULL FROM nexo.users WHERE lower(email) = 'jor.vergaras@duocuc.cl'; Resultado: usuario LOCAL y hash presente. No se registran contraseñas en logs ni en el documento.")

heading(doc, "7. Verificaciones ejecutadas")
table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
table.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, value in enumerate(["Validación", "Comando", "Resultado"]):
    cell_text(table.rows[0].cells[i], value, True, (255, 255, 255))
    shade(table.rows[0].cells[i], "293E78")
for row in [
    ("Prettier", "npm run format:check", "OK"),
    ("Compilación backend", "backend/mvnw.cmd -DskipTests compile", "OK con Java 21"),
    ("Build Angular", "npm run build", "OK; warning de presupuesto inicial por MSAL"),
    ("Prueba API registro/login", "POST /api/auth/register y POST /api/auth/login", "OK; JWT emitido"),
    ("Prueba protegida", "GET /api/users/me con Bearer JWT", "200; usuario persistido"),
    ("Prueba visual", "Navegador local", "OK; errores y redirección /home verificados"),
]:
    cells = table.add_row().cells
    for i, value in enumerate(row):
        cell_text(cells[i], value)

heading(doc, "8. Ejecución local")
doc.add_paragraph("1) Iniciar PostgreSQL: docker compose up -d. 2) Iniciar backend: backend\\mvnw.cmd spring-boot:run. 3) Iniciar frontend: npm start. 4) Abrir http://127.0.0.1:4200/login. 5) Para Microsoft, completar el consentimiento de la API Nexo en el tenant si Azure lo solicita.")

heading(doc, "9. Publicación en EC2 y comprobación de Azure")
numbered(doc, [
    "Se publicó la rama feat/experiencia-multimedia en la instancia académica nexo-backend-academico de us-east-1.",
    "Se reconstruyó el frontend Angular y se reinició el contenedor web con Docker. El backend quedó en el contenedor nexo-backend con restart: always.",
    "La aplicación pública quedó disponible en https://34.196.97.226.nip.io/. Se verificaron respuestas HTTP 200 para / y /login.",
    "El readiness interno del backend respondió {\"status\":\"UP\"}. La configuración de MSAL se conservó fuera del repositorio para no publicar secretos.",
    "Para validar Azure: abrir la URL pública, seleccionar Continuar con Microsoft, autenticarse con una cuenta permitida, aceptar el consentimiento si aparece y confirmar la redirección a /home.",
    "Si aparece un error de tenant, revisar que la cuenta exista en el tenant, que la URI usada coincida exactamente con Authentication y que el scope api://.../access_as_user esté concedido.",
])

heading(doc, "10. Pantalla completa y compatibilidad móvil")
doc.add_paragraph("El visor mantiene el mismo elemento de video y la misma conexión LiveKit al entrar o salir de pantalla completa. Para Android se agregó sincronización del ancho y alto reales del viewport en resize y orientationchange, con un frame adicional después del giro para esperar a que el navegador actualice sus dimensiones. Si el navegador rechaza requestFullscreen, se utiliza un fallback fijo que ocupa todo el viewport sin cortar la transmisión.")
doc.add_paragraph("La captura de sonido del sistema sigue dependiendo del navegador y de la fuente seleccionada. En PC, Chrome y Edge ofrecen la compatibilidad más completa; en móviles la reproducción es compatible, pero la captura del audio del sistema puede estar limitada por Android, iOS o el navegador.")

heading(doc, "11. Seguridad y límites de la evidencia")
doc.add_paragraph("MSAL obtiene los tokens de Microsoft Entra mediante OAuth2/OIDC y el interceptor los adjunta a las solicitudes protegidas. El backend valida issuer, audience, firma y expiración del JWT. El client ID y el tenant ID son identificadores públicos; los secretos, contraseñas y tokens no se guardan en el repositorio ni en este documento.")
doc.add_paragraph("La URI nip.io es temporal y depende de la IP pública/elástica de la instancia. Para un despliegue real se recomienda dominio propio, HTTPS con certificado administrado, API Gateway con JWT Authorizer y rotación de secretos. La validación descrita corresponde al alcance académico operativo.")

heading(doc, "12. Galería de capturas: MSAL, JWT y reflejo en Nexo")
doc.add_paragraph("Esta sección reúne únicamente capturas de la configuración y del comportamiento visible de la aplicación. El JWT completo no se muestra por seguridad: la evidencia se limita a la configuración del scope, la sesión autenticada y el resultado que Nexo recibe después de la validación.")
for filename, text in [
    ("01-nexo-frontend-overview.png", "MSAL/Entra: registro Nexo Frontend activo, tenant y aplicación SPA configurada."),
    ("02-nexo-api-scope.png", "JWT/claims: Nexo Web expone el scope access_as_user que se solicita al access token."),
    ("04-nexo-login-rendered.png", "Aplicación: pantalla de acceso Nexo con el botón Continuar con Microsoft."),
    ("06-login-success.png", "Aplicación: retorno autenticado a Nexo; la interfaz identifica la sesión con Microsoft Entra ID."),
    ("07-session-expired-msal.png", "MSAL: estado visible cuando la sesión expira y Nexo solicita iniciar sesión nuevamente."),
]:
    path = EVIDENCE / filename
    if path.exists():
        doc.add_picture(str(path), width=Inches(6.45))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption(doc, text)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run("Nexo — Evidencia de configuración frontend y Azure").font.size = Pt(8)
doc.save(OUT)
print(OUT)
