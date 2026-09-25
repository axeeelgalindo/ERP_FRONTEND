// src/lib/comprobanteVacacionesPDF.js
import { jsPDF } from "jspdf";
import { calcularDiasHabilesVacaciones } from "@/lib/diasHabiles";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/**
 * Formatea fecha en español formal: "8 de Septiembre 2025" o "08/09/2025"
 */
export function fmtFechaEspanol(dateVal, includeYear = true) {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  const dia = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  const ano = d.getUTCFullYear();
  return includeYear ? `${dia} de ${mes} ${ano}` : `${dia} de ${mes}`;
}

export function fmtFechaCorta(dateVal) {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function fmtDias(num) {
  if (num == null || isNaN(num)) return "0";
  const parsed = Number(num);
  // Si tiene decimales, mostrar 2 decimales con coma (estilo chileno: 12,21)
  if (parsed % 1 !== 0) {
    return parsed.toFixed(2).replace(".", ",");
  }
  return String(parsed);
}

/**
 * Calcula el período contractual anual que corresponde al feriado tomado
 */
export function getPeriodoContractual(fechaIngreso, fechaVacacion) {
  const fVac = fechaVacacion ? new Date(fechaVacacion) : new Date();
  const anoVac = !isNaN(fVac.getTime()) ? fVac.getUTCFullYear() : new Date().getFullYear();

  if (!fechaIngreso) {
    return `${anoVac} - ${anoVac + 1}`;
  }

  const fIng = new Date(fechaIngreso);
  if (isNaN(fIng.getTime())) {
    return `${anoVac} - ${anoVac + 1}`;
  }

  const mesIng = fIng.getUTCMonth();
  const diaIng = fIng.getUTCDate();

  // Fecha aniversario en el año de la vacación
  const anivEsteAno = new Date(Date.UTC(anoVac, mesIng, diaIng));
  let startAno = anoVac;
  if (fVac < anivEsteAno) {
    startAno = anoVac - 1;
  }
  const endAno = startAno + 1;

  const fDesdeStr = `${String(diaIng).padStart(2, "0")}/${String(mesIng + 1).padStart(2, "0")}/${startAno}`;
  const fHastaDate = new Date(Date.UTC(endAno, mesIng, diaIng - 1));
  const fHastaStr = `${String(fHastaDate.getUTCDate()).padStart(2, "0")}/${String(fHastaDate.getUTCMonth() + 1).padStart(2, "0")}/${endAno}`;

  return `${fDesdeStr} al ${fHastaStr} (${startAno} - ${endAno})`;
}

/**
 * Carga imagen como DataURL para incrustar en el PDF
 */
async function loadImageDataURL(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Genera el documento PDF con diseño idéntico al comprobante_vacaciones.doc
 * 
 * @param {Object} params
 * @param {Object} params.empleado Datos del empleado (nombre, rut, cargo, sede, fecha_ingreso)
 * @param {Object} params.vacacion Datos del periodo de vacaciones (desde, hasta, dias, saldo_anterior, saldo_pendiente)
 * @param {Object} [params.empresa] Datos de la empresa (nombre, rut, direccion, ciudad)
 * @param {Date|string} [params.fechaEmision] Fecha de emisión del documento (defecto: hoy)
 * @returns {Promise<{ doc: jsPDF, blob: Blob, filename: string }>}
 */
export async function generateComprobanteVacacionesPDF({
  empleado = {},
  vacacion = {},
  empresa = {},
  fechaEmision = new Date(),
}) {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4", // 210 x 297 mm
  });

  const W = 210;
  const H = 297;
  const mx = 24; // margen lateral izquierdo y derecho

  // 1. Sede y Datos de Empresa
  const sede = String(empleado.sede || "PMC").toUpperCase();
  const ciudadSede = sede === "PUQ" ? "Punta Arenas" : "Puerto Montt";
  const direccionSede = sede === "PUQ" 
    ? "Capitán Juan Guillermos 02233, Punta Arenas" 
    : "Av San Agustin La Paloma PC38 Puerto Montt";

  const empresaNombre = empresa.nombre || "Blue Ingenieria Spa";
  const empresaRut = empresa.rut || "78.115.957-3";
  const empresaDireccion = empresa.direccion || direccionSede;

  // 2. Cargar Logo
  try {
    const logoDataUrl = await loadImageDataURL("/Logo_blue.png");
    if (logoDataUrl) {
      // Relación de aspecto 779 x 285 ~ 2.73
      const logoW = 52;
      const logoH = 52 / (779 / 285);
      doc.addImage(logoDataUrl, "PNG", mx, 16, logoW, logoH, "logo_blue", "FAST");
    }
  } catch (err) {
    console.warn("No se pudo cargar el logo de la empresa para el PDF", err);
  }

  // 3. Membrete de la Empresa
  let y = 41;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(empresaNombre, mx, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105); // Slate 600
  y += 5;
  doc.text(`R.U.T.:   ${empresaRut}`, mx, y);
  y += 5;
  doc.text(empresaDireccion, mx, y);

  // 4. Título Principal
  y = 74;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text("CERTIFICADO DE VACACIONES", W / 2, y, { align: "center" });

  // 5. Ciudad y Fecha (Alineado a la derecha)
  y = 86;
  const fechaEmisionStr = fmtFechaEspanol(fechaEmision);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`${ciudadSede}, ${fechaEmisionStr}`, W - mx, y, { align: "right" });

  // 6. Cálculos de días y períodos
  const calc = calcularDiasHabilesVacaciones(vacacion.desde, vacacion.hasta);
  const diasHabiles = Number(vacacion.dias ?? calc.diasHabiles ?? 1);
  const domingosInhabiles = calc.finesDeSemana + calc.feriadosCount;
  const totalDiasCorridos = calc.diasTotales > 0 ? calc.diasTotales : diasHabiles;

  const periodoContractual = vacacion.periodo_contractual || getPeriodoContractual(empleado.fecha_ingreso, vacacion.desde);

  // Saldos: anterior y pendiente
  let saldoAnterior = vacacion.saldo_anterior;
  let saldoPendiente = vacacion.saldo_pendiente;

  if (saldoAnterior == null) {
    if (vacacion.saldo_disponible != null) {
      saldoAnterior = Number(vacacion.saldo_disponible) + diasHabiles;
      saldoPendiente = Number(vacacion.saldo_disponible);
    } else if (empleado.saldo_disponible != null) {
      saldoAnterior = Number(empleado.saldo_disponible);
      saldoPendiente = saldoAnterior - diasHabiles;
    } else {
      saldoAnterior = diasHabiles;
      saldoPendiente = 0;
    }
  }

  if (saldoPendiente == null) {
    saldoPendiente = saldoAnterior - diasHabiles;
  }

  // 7. Bloque de Datos Generales
  y = 102;
  const labelX = mx;
  const colonX = mx + 46;
  const valueX = mx + 50;
  const lineSpacing = 7.5;

  const printRow = (label, value, isBold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, labelX, y);
    doc.text(":", colonX, y);

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(value ?? "—"), valueX, y);
    y += lineSpacing;
  };

  printRow("Período Contractual", periodoContractual);
  printRow("Funcionario", String(empleado.nombre || empleado.usuario?.nombre || "—").toUpperCase(), true);
  printRow("Rut", empleado.rut || "—");
  
  const fechaDesdeStr = fmtFechaCorta(vacacion.desde);
  const fechaHastaStr = fmtFechaCorta(vacacion.hasta);
  printRow("Vacaciones concedidas", `${fechaDesdeStr} al ${fechaHastaStr}`);

  // Total días
  const totalDiasLabel = totalDiasCorridos > diasHabiles 
    ? `${fmtDias(diasHabiles)} días hábiles (${totalDiasCorridos} días corridos)`
    : `${fmtDias(diasHabiles)} días hábiles`;
  printRow("Total días", totalDiasLabel);

  // 8. Sección: Detalle del Feriado
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Detalle del Feriado:", labelX, y);

  // Subrayado elegante
  const textWidth = doc.getTextWidth("Detalle del Feriado:");
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.line(labelX, y + 1.2, labelX + textWidth, y + 1.2);

  y += 9;
  printRow("Saldo anterior", `${fmtDias(saldoAnterior)} días`);
  printRow("Días Hábiles", `${fmtDias(diasHabiles)} días`);
  printRow("Domingos e Inhábiles", `${fmtDias(domingosInhabiles)} días`);
  printRow("Saldo pendiente", `${fmtDias(saldoPendiente)} días  (al terminar las vacaciones)`);
  printRow("Fecha Ingreso", fmtFechaEspanol(empleado.fecha_ingreso));

  // 9. Bloque de Firmas al Pie
  const firmaY = 226;
  const firmaAncho = 64;
  const firmaLeftX = mx + 4;
  const firmaRightX = W - mx - firmaAncho - 4;

  // Líneas
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(firmaLeftX, firmaY, firmaLeftX + firmaAncho, firmaY);
  doc.line(firmaRightX, firmaY, firmaRightX + firmaAncho, firmaY);

  // Títulos de Firmas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("FIRMA DEL TRABAJADOR", firmaLeftX + (firmaAncho / 2), firmaY + 5.5, { align: "center" });
  doc.text("FIRMA DEL EMPLEADOR", firmaRightX + (firmaAncho / 2), firmaY + 5.5, { align: "center" });

  // Nombres y RUTs bajo cada firma
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const nomTrabajador = String(empleado.nombre || empleado.usuario?.nombre || "TRABAJADOR").toUpperCase();
  doc.text(nomTrabajador, firmaLeftX + (firmaAncho / 2), firmaY + 10.5, { align: "center" });
  doc.text(`RUT: ${empleado.rut || "—"}`, firmaLeftX + (firmaAncho / 2), firmaY + 14.5, { align: "center" });

  doc.text(empresaNombre.toUpperCase(), firmaRightX + (firmaAncho / 2), firmaY + 10.5, { align: "center" });
  doc.text(`RUT: ${empresaRut}`, firmaRightX + (firmaAncho / 2), firmaY + 14.5, { align: "center" });

  // 10. Nota Legal de Pie
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(
    "Comprobante oficial extendido en duplicado según disposiciones del Código del Trabajo de Chile.",
    W / 2,
    278,
    { align: "center" }
  );
  doc.text(
    "Original: Carpeta Personal del Trabajador  |  Copia: Trabajador",
    W / 2,
    282.5,
    { align: "center" }
  );

  // 11. Generar Blob y Nombre de Archivo
  const safeNombre = String(empleado.nombre || empleado.usuario?.nombre || "Empleado")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  const fDesdeName = fmtFechaCorta(vacacion.desde).replace(/\//g, "-");
  const fHastaName = fmtFechaCorta(vacacion.hasta).replace(/\//g, "-");
  const filename = `Comprobante_Vacaciones_${safeNombre}_${fDesdeName}_al_${fHastaName}.pdf`;

  const blob = doc.output("blob");

  return { doc, blob, filename };
}

/**
 * Descarga directamente el comprobante en el navegador
 */
export async function downloadComprobanteVacaciones(params) {
  const { doc, filename } = await generateComprobanteVacacionesPDF(params);
  doc.save(filename);
}

/**
 * Abre el diálogo de impresión directamente para imprimir el comprobante
 */
export async function printComprobanteVacaciones(params) {
  const { blob } = await generateComprobanteVacacionesPDF(params);
  const blobUrl = URL.createObjectURL(blob);

  // Crear iframe invisible para impresión limpia sin ventanas emergentes residuales
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.open(blobUrl, "_blank");
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    }
  };
}

/**
 * Asigna el comprobante en PDF al empleado en el ERP:
 * 1. Asegura que exista la carpeta "Vacaciones" en sus documentos
 * 2. Sube el PDF directamente a dicha carpeta
 */
export async function assignComprobanteToEmpleado({
  session,
  empleadoId,
  vacacion,
  empleado,
  empresa,
}) {
  if (!session || !empleadoId) return null;

  try {
    // 1. Generar PDF
    const { blob, filename } = await generateComprobanteVacacionesPDF({
      empleado,
      vacacion,
      empresa,
    });

    // 2. Obtener lista de carpetas para buscar o crear carpeta "Vacaciones"
    let folderId = null;
    try {
      const docsRes = await fetch(`${API_URL}/empleados/${empleadoId}/documentos`, {
        headers: makeHeaders(session),
      });
      if (docsRes.ok) {
        const docsList = await docsRes.json();
        const vacFolder = (docsList || []).find(
          (d) => d.es_carpeta && String(d.nombre).trim().toLowerCase() === "vacaciones"
        );
        if (vacFolder) {
          folderId = vacFolder.id;
        } else {
          // Crear carpeta "Vacaciones"
          const createFolderRes = await fetch(
            `${API_URL}/empleados/${empleadoId}/documentos/carpeta`,
            {
              method: "POST",
              headers: makeHeaders(session),
              body: JSON.stringify({ nombre: "Vacaciones" }),
            }
          );
          if (createFolderRes.ok) {
            const newFolder = await createFolderRes.json();
            folderId = newFolder.id;
          }
        }
      }
    } catch (err) {
      console.warn("No se pudo verificar o crear la carpeta 'Vacaciones'", err);
    }

    // 3. Subir archivo a /empleados/:id/documentos/upload
    const formData = new FormData();
    if (folderId) {
      formData.append("parent_id", folderId);
    }
    const pdfFile = new File([blob], filename, { type: "application/pdf" });
    formData.append("files", pdfFile);

    const hdrs = makeHeaders(session);
    delete hdrs["Content-Type"];

    const uploadRes = await fetch(`${API_URL}/empleados/${empleadoId}/documentos/upload`, {
      method: "POST",
      headers: hdrs,
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error("No se pudo asignar el comprobante a documentos del empleado");
    }

    const uploadData = await uploadRes.json();
    return { success: true, filename, uploadData };
  } catch (err) {
    console.error("Error al asignar comprobante PDF a empleado:", err);
    return { success: false, error: err.message };
  }
}
