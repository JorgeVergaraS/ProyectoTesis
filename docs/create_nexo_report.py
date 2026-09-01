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
r.font.color.rgb = RGBColor(73, 65, 180)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Autenticación Nexo: registro, login y Microsoft Entra ID")
r.bold = True
r.font.size = Pt(20)
r.font.color.rgb = RGBColor(41, 62, 120)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run("Evidencia de implementación — 1 de septiembre de 2026").font.size = Pt(11)

p = doc.add_paragraph()
p.add_run("Alcance. ").bold = True
p.add_run("Este informe documenta el login local con correo y contraseña, el registro de usuarios, la validación de Microsoft Entra ID, la persistencia en PostgreSQL y las evidencias visuales. La cuenta usada en las pruebas es del entorno local; la contraseña no se documenta.")

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
doc.add_paragraph("Redirect URI SPA: http://localhost:4200")
doc.add_paragraph("Scope: api://0f2d7cee-cabb-4482-900d-64fb07f5f81d/access_as_user")

heading(doc, "2. Paso a paso realizado en Azure")
for text in [
    "Se abrió Microsoft Azure > App registrations en el tenant Default Directory.",
    "Se registró Nexo Web como aplicación de la API y se dejó su Application ID URI con formato api://<client-id>.",
    "En Expose an API se creó el scope delegado access_as_user, habilitado y con textos de consentimiento.",
    "Se registró Nexo Frontend como Single-page application (SPA), con redirect URI http://localhost:4200.",
    "Se verificaron los identificadores públicos y el tenant en las pantallas Overview de Azure.",
    "Se eliminaron las App Registrations antiguas Pedidos360-API-BFF y Pedidos360-Frontend-Angular.",
    "Se actualizó environment.ts para usar los identificadores reales de Nexo, sin client secrets.",
]:
    doc.add_paragraph(text, style="List Number")

heading(doc, "3. Evidencia visual")
for filename, text in [
    ("01-nexo-frontend-overview.png", "Registro Nexo Frontend: SPA activa, tenant correcto y redirect URI configurado."),
    ("02-nexo-api-scope.png", "Registro Nexo Web: Application ID URI y scope access_as_user habilitado."),
    ("03-azure-clean-nexo-only.png", "Lista final: solo permanecen Nexo Frontend y Nexo Web; Pedidos360 fue retirado."),
    ("04-nexo-login-rendered.png", "Login visual de Nexo levantado en http://localhost:4200/login, con botón Continuar con Microsoft."),
    ("05-login-validation-errors.png", "Validación en línea: correo con formato incorrecto y contraseña menor a 8 caracteres."),
    ("06-login-success.png", "Login local exitoso: redirección a /home y datos del usuario autenticado."),
]:
    path = EVIDENCE / filename
    if path.exists():
        doc.add_picture(str(path), width=Inches(6.45))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption(doc, text)

heading(doc, "4. Flujo de registro y login")
for text in [
    "En /login, el usuario puede continuar con Microsoft o alternar al formulario de correo.",
    "El registro exige nombre, correo válido y contraseña de mínimo 8 caracteres. Los errores aparecen debajo del campo y el botón no envía formularios inválidos.",
    "El backend vuelve a validar el payload con Bean Validation, verifica que el correo no esté registrado y genera un JWT local al crear la cuenta.",
    "El login compara la contraseña recibida contra el hash BCrypt almacenado y entrega un JWT con issuer nexo-local y audience nexo-api.",
    "El interceptor adjunta Authorization: Bearer <JWT> a /api/users/me; la guarda permite /home solo con sesión válida.",
    "Microsoft Entra mantiene el flujo OAuth2/OIDC; sus tokens se validan con issuer, audience, firma y expiración mediante el Resource Server.",
]:
    doc.add_paragraph(text, style="List Number")

heading(doc, "5. Cambios en el frontend")
doc.add_paragraph("El frontend incluye formularios reactivos, validación visual accesible, interceptor para JWT local, interceptor MSAL condicionado a cuentas Microsoft, guardas compatibles con ambos métodos y las rutas /login, /home y /profile.")
doc.add_paragraph("Archivo actualizado: frontend/src/environments/environment.ts")
doc.add_paragraph("La configuración de producción permanece con placeholders hasta disponer de un dominio real. No se inventaron credenciales ni se guardaron secretos.")

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

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run("Nexo — Evidencia de configuración frontend y Azure").font.size = Pt(8)
doc.save(OUT)
print(OUT)
