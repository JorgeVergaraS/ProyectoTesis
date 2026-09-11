import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/Boryot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const ROOT = "D:/DESCARGAS U/cloudnativer/Nexo";
const OUT = `${ROOT}/docs/Nexo-Cloud-Native-Presentacion-Actualizada.pptx`;
const QA = `${ROOT}/tmp/pptx-qa`;
const W = 1280;
const H = 720;
const INK = "#0B1020";
const MUTED = "#5B6477";
const PANEL = "#F0F1F4";
const RULE = "#C8CBD3";
const VIOLET = "#4F46E5";
const BLUE = "#2D7FF9";
const GREEN = "#15803D";
const AMBER = "#B45309";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function textbox(slide, name, text, position, size = 26, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: size,
    typeface: "Arial",
    color: options.color ?? INK,
    bold: options.bold ?? false,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: "shrinkText",
  };
  return shape;
}

function panel(slide, name, position, fill = PANEL, line = RULE) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: "rounded-xl",
  });
}

function title(slide, text, index) {
  textbox(slide, `title-${index}`, text, { left: 52, top: 36, width: 1170, height: 82 }, 42, { bold: true });
  textbox(slide, `page-${index}`, String(index), { left: 1190, top: 664, width: 42, height: 22 }, 13, { color: MUTED, alignment: "right" });
}

function label(slide, text, x, y, color = VIOLET) {
  textbox(slide, `label-${text}-${x}`, text.toUpperCase(), { left: x, top: y, width: 300, height: 25 }, 14, { bold: true, color });
}

async function addImage(slide, name, path, position, fit = "cover") {
  const bytes = await fs.readFile(path);
  const blob = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  slide.images.add({ blob, contentType: "image/png", alt: name, fit, position, geometry: "roundRect", borderRadius: "rounded-xl" });
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1 — cover: sparse stacked-text layout.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  label(slide, "DSY1107 · Cloud Native I", 56, 48);
  textbox(slide, "cover-title", "Nexo", { left: 54, top: 170, width: 720, height: 120 }, 78, { bold: true });
  textbox(slide, "cover-subtitle", "Identidad institucional y autorización JWT, sin abandonar la aplicación FullStack existente.", { left: 58, top: 315, width: 760, height: 150 }, 31, { color: MUTED });
  panel(slide, "cover-accent", { left: 920, top: 96, width: 260, height: 520 }, "#EEF2FF", "#C7D2FE");
  textbox(slide, "cover-mark", "N", { left: 955, top: 225, width: 190, height: 170 }, 128, { bold: true, color: VIOLET, alignment: "center", verticalAlignment: "middle" });
  textbox(slide, "cover-meta", "Angular · MSAL · Entra ID\nSpring Boot · PostgreSQL\nEC2 · API Gateway", { left: 58, top: 555, width: 620, height: 95 }, 20, { color: MUTED });
}

// 2 — half text, half exact evidence image.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "La integración parte de Nexo, no de una aplicación nueva", 2);
  label(slide, "Funcionalidad seleccionada", 54, 175);
  textbox(slide, "selected-feature", "Inicio/cierre de sesión y consulta del perfil autenticado.", { left: 54, top: 215, width: 510, height: 115 }, 29, { bold: true });
  textbox(slide, "endpoint", "GET /api/users/me", { left: 54, top: 375, width: 510, height: 58 }, 34, { bold: true, color: VIOLET });
  textbox(slide, "endpoint-detail", "La ruta sincroniza al usuario en PostgreSQL y exige ROLE_USER local o SCOPE_access_as_user.", { left: 54, top: 455, width: 510, height: 125 }, 22, { color: MUTED });
  await addImage(slide, "Pantalla real de login Nexo", `${ROOT}/docs/evidence/04-nexo-login-rendered.png`, { left: 650, top: 145, width: 570, height: 470 });
}

// 3 — architecture flow.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "El token se valida en el borde y nuevamente en Spring", 3);
  const nodes = [
    ["Angular SPA", "MSAL + PKCE", 55, VIOLET],
    ["Microsoft Entra ID", "Emite access_as_user", 310, BLUE],
    ["HTTP API Gateway", "CORS + JWT Authorizer", 565, "#111827"],
    ["Spring Boot en EC2", "Issuer · audience · firma · exp", 820, "#111827"],
    ["Postgres", "Perfil; sin contraseña Microsoft", 1075, GREEN],
  ];
  for (const [name, detail, x, color] of nodes) {
    panel(slide, `node-${name}`, { left: x, top: 240, width: 180, height: 210 }, "#F7F7F8", color);
    textbox(slide, `node-title-${name}`, name, { left: x + 16, top: 275, width: 148, height: 65 }, 24, { bold: true, color });
    textbox(slide, `node-detail-${name}`, detail, { left: x + 16, top: 355, width: 148, height: 70 }, 17, { color: MUTED });
  }
  for (const x of [245, 500, 755, 1010]) textbox(slide, `arrow-${x}`, "→", { left: x, top: 315, width: 45, height: 60 }, 36, { bold: true, color: VIOLET, alignment: "center" });
  textbox(slide, "architecture-note", "Defensa en profundidad: API Gateway filtra antes de llegar a EC2; Spring Security sigue siendo la autoridad final.", { left: 120, top: 535, width: 1040, height: 75 }, 25, { bold: true, alignment: "center" });
}

// 4 — sequence.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "Authorization Code + PKCE evita secretos en Angular", 4);
  const steps = [
    ["1", "Redirección", "loginRedirect solicita access_as_user"],
    ["2", "Identidad", "Entra autentica; usuario completa MFA"],
    ["3", "Callback", "Procesa retorno y fija la cuenta activa"],
    ["4", "Token", "acquireTokenSilent obtiene Access Token"],
    ["5", "API", "Interceptor agrega Bearer a /api"],
  ];
  steps.forEach(([n, h, body], i) => {
    const x = 58 + i * 242;
    panel(slide, `step-${n}`, { left: x, top: 235, width: 205, height: 245 }, i === 2 ? "#EEF2FF" : PANEL, i === 2 ? VIOLET : RULE);
    textbox(slide, `step-num-${n}`, n, { left: x + 18, top: 252, width: 44, height: 48 }, 34, { bold: true, color: VIOLET });
    textbox(slide, `step-head-${n}`, h, { left: x + 18, top: 320, width: 165, height: 42 }, 24, { bold: true });
    textbox(slide, `step-body-${n}`, body, { left: x + 18, top: 380, width: 165, height: 82 }, 17, { color: MUTED });
  });
  textbox(slide, "pkce-note", "El Client ID y el scope son públicos. Angular nunca almacena un Client Secret.", { left: 150, top: 545, width: 980, height: 55 }, 26, { bold: true, alignment: "center" });
}

// 5 — four-point grid.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "La autorización distingue identidad, sesión y permiso", 5);
  const points = [
    ["Rutas Angular", "/login pública; /home y /profile protegidas."],
    ["Sesiones separadas", "demo, local y Microsoft no comparten credenciales."],
    ["Scopes y roles", "scp/scope → SCOPE_*; roles → ROLE_*."],
    ["Persistencia segura", "oid identifica al usuario; password_hash queda NULL."],
  ];
  points.forEach(([h, body], i) => {
    const x = i % 2 === 0 ? 58 : 655;
    const y = i < 2 ? 190 : 430;
    textbox(slide, `point-head-${i}`, h, { left: x, top: y, width: 520, height: 50 }, 29, { bold: true, color: i === 3 ? GREEN : INK });
    textbox(slide, `point-body-${i}`, body, { left: x, top: y + 68, width: 520, height: 105 }, 23, { color: MUTED });
  });
}

// 6 — metric-led evidence.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "Las pruebas locales ya cubren la matriz 401 / 403 / 200", 6);
  textbox(slide, "evidence-explainer", "Resultados repetibles sin exponer tokens completos. Falta repetirlos con un token Microsoft real y después en API Gateway.", { left: 55, top: 135, width: 1140, height: 72 }, 23, { color: MUTED });
  const metrics = [
    ["76/76", "Frontend", "22 archivos aprobados"],
    ["42/42", "Backend", "Testcontainers + JWT"],
    ["401·403·200", "Seguridad", "Casos automatizados"],
  ];
  metrics.forEach(([stat, head, body], i) => {
    const x = 55 + i * 405;
    panel(slide, `metric-${i}`, { left: x, top: 290, width: 360, height: 285 }, i === 2 ? "#EEF2FF" : PANEL, i === 2 ? VIOLET : RULE);
    textbox(slide, `metric-stat-${i}`, stat, { left: x + 28, top: 335, width: 304, height: 78 }, i === 2 ? 42 : 54, { bold: true, color: i === 2 ? VIOLET : INK });
    textbox(slide, `metric-head-${i}`, head, { left: x + 28, top: 450, width: 304, height: 40 }, 24, { bold: true });
    textbox(slide, `metric-body-${i}`, body, { left: x + 28, top: 505, width: 304, height: 45 }, 18, { color: MUTED });
  });
}

// 7 — two-week/cloud timeline.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "La base local está lista; la nube aún requiere autorización", 7);
  const phases = [
    ["Diagnóstico", "Listo", GREEN],
    ["MSAL / Spring", "Listo", GREEN],
    ["Login real", "Listo", GREEN],
    ["EC2", "Listo", GREEN],
    ["API Gateway", "Pendiente", AMBER],
  ];
  phases.forEach(([name, status, color], i) => {
    const x = 55 + i * 242;
    textbox(slide, `phase-name-${i}`, name, { left: x, top: 175, width: 210, height: 55 }, 21, { bold: true, alignment: "center" });
    slide.shapes.add({ geometry: "line", name: `phase-rule-${i}`, position: { left: x, top: 245, width: 210, height: 1 }, fill: "none", line: { style: "solid", fill: RULE, width: 1 } });
    panel(slide, `phase-status-${i}`, { left: x, top: 290, width: 210, height: 105 }, "#F7F7F8", color);
    textbox(slide, `phase-status-text-${i}`, status, { left: x + 16, top: 325, width: 178, height: 38 }, 23, { bold: true, color, alignment: "center" });
  });
  textbox(slide, "timeline-next", "Siguiente decisión: completar HTTP API Gateway y repetir la matriz 401 / 403 / 200 en la nube.", { left: 120, top: 500, width: 1040, height: 100 }, 28, { bold: true, alignment: "center" });
}

// 8 — evidence gallery for the live demonstration.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  title(slide, "Evidencia visual para la rúbrica", 8);
  label(slide, "Capturas preparadas para la demo", 54, 130);
  await addImage(slide, "Azure App Registration", `${ROOT}/docs/images/cloud/02-entra-aplicaciones.png`, { left: 55, top: 185, width: 350, height: 185 }, "contain");
  await addImage(slide, "MSAL Microsoft login", `${ROOT}/docs/evidence/08-msal-microsoft-login-20260910.png`, { left: 465, top: 185, width: 350, height: 185 }, "contain");
  await addImage(slide, "Nexo publicado en EC2", `${ROOT}/docs/images/cloud/11-nexo-cloud-https.png`, { left: 875, top: 185, width: 350, height: 185 }, "contain");
  await addImage(slide, "RDS PostgreSQL", `${ROOT}/docs/images/cloud/09-rds-creacion-sencilla.png`, { left: 55, top: 430, width: 350, height: 120 }, "contain");
  await addImage(slide, "Permisos API y scope", `${ROOT}/docs/images/cloud/04-entra-permisos-spa.png`, { left: 465, top: 430, width: 350, height: 120 }, "contain");
  await addImage(slide, "Transmisión Nexo", `${ROOT}/docs/images/broadcast/05-transmision-en-vivo.png`, { left: 875, top: 430, width: 350, height: 120 }, "contain");
  textbox(slide, "evidence-captions", "Azure · MSAL · EC2/RDS · permisos JWT · transmisión", { left: 220, top: 610, width: 840, height: 35 }, 20, { color: MUTED, alignment: "center" });
}

// 9 — closing with concrete next actions.
{
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  label(slide, "Cierre", 55, 48);
  textbox(slide, "close-title", "Nexo ya tiene una base segura y verificable", { left: 55, top: 165, width: 1030, height: 165 }, 66, { bold: true });
  textbox(slide, "close-actions", "1. Completar login/MFA en Brave\n2. Desplegar EC2 + HTTP API Gateway\n3. Capturar 401 / 403 / 200 y abrir PR separados", { left: 58, top: 440, width: 800, height: 150 }, 28, { color: MUTED });
  panel(slide, "close-accent", { left: 1030, top: 430, width: 155, height: 155 }, "#EEF2FF", VIOLET);
  textbox(slide, "close-mark", "N", { left: 1045, top: 452, width: 125, height: 110 }, 82, { bold: true, color: VIOLET, alignment: "center", verticalAlignment: "middle" });
}

await fs.mkdir(QA, { recursive: true });
for (const [index, slide] of deck.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(`${QA}/${stem}.png`, await deck.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${QA}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
}
await writeBlob(`${QA}/montage.webp`, await deck.export({ format: "webp", montage: true, scale: 1 }));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);
