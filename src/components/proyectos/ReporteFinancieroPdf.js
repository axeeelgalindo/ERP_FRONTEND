import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function money(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generarReporteFinancieroPDF({ data }) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const proyecto = data?.proyecto || {};
  const empresa = data?.empresa || {};
  const kpis = data?.kpis || {};
  const costeo = data?.costeo || {};
  const facturas = data?.facturas || [];

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Header Colors
  const primaryColor = [30, 58, 138]; // Deep Navy (#1e3a8a)
  const darkGray = [30, 41, 59]; // Slate 800
  const lightGray = [100, 116, 139]; // Slate 500
  const borderGray = [226, 232, 240]; // Slate 200

  // 1. HEADER EMPRESA
  let currentY = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text(empresa.nombre || "BLUE INGENIERÍA", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...lightGray);
  if (empresa.rut) {
    doc.text(`RUT: ${empresa.rut}`, margin, currentY + 14);
  }
  if (empresa.direccion) {
    doc.text(`${empresa.direccion}`, margin, currentY + 26);
  }
  if (empresa.correo || empresa.telefono) {
    doc.text(`${empresa.correo || ""} ${empresa.telefono ? "· " + empresa.telefono : ""}`, margin, currentY + 38);
  }

  // Título a la derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...darkGray);
  doc.text("REPORTE FINANCIERO EJECUTIVO", pageWidth - margin, currentY, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  const nroCotStr = proyecto.nroCotizacion ? `COT-${proyecto.nroCotizacion}` : "SIN COTIZACIÓN";
  doc.text(nroCotStr, pageWidth - margin, currentY + 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGray);
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString("es-CL")}`, pageWidth - margin, currentY + 28, { align: "right" });

  // Línea divisoria
  currentY += 50;
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 2. DETALLE DEL PROYECTO & CLIENTE (Caja estilizada)
  currentY += 12;
  autoTable(doc, {
    startY: currentY,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: primaryColor, cellWidth: 80 },
      1: { textColor: darkGray, cellWidth: 200 },
      2: { fontStyle: "bold", textColor: primaryColor, cellWidth: 70 },
      3: { textColor: darkGray },
    },
    body: [
      [
        "Proyecto:",
        `${proyecto.nombre || "—"}`,
        "Cliente:",
        `${proyecto.cliente?.nombre || "—"} ${proyecto.cliente?.rut ? `(${proyecto.cliente.rut})` : ""}`,
      ],
      [
        "Estado:",
        `${(proyecto.estado || "ACTIVO").toUpperCase()}`,
        "Cotización:",
        `${nroCotStr}`,
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // 3. TABLA DE KPIS PRINCIPALES (4 PILARES)
  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9.5,
      fontStyle: "bold",
      textColor: darkGray,
      halign: "center",
      cellPadding: 7,
    },
    head: [["Cobranza Neta Pagada", "Saldo Pendiente por Cobrar", "Gasto Compras (RCV)", "Utilidad Real"]],
    body: [
      [
        `${money(kpis.montoCobradoNeto)}\n(${kpis.porcentajeCobrado || 0}% Cobrado · Bruto: ${money(kpis.montoCobradoBruto)})`,
        `${money(kpis.saldoPorCobrarNeto || 0)}\n(${kpis.porcentajePendiente || 0}% Pendiente · Bruto: ${money(kpis.saldoPorCobrarBruto)})`,
        `${money(kpis.montoTotalCompras)}\n(${costeo.compras?.porcentajeConsumido || 0}% pres.)`,
        `${money(kpis.utilidadReal)}\n(Margen: ${kpis.margenRealPct || 0}%)`,
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 14;

  // 4. DESGLOSE DE COSTEO Y EJECUCIÓN (PLAN VS REAL)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text("Desglose de Costeos y Presupuesto Cotizado", margin, currentY);

  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    theme: "striped",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: darkGray,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: darkGray, cellPadding: 4 },
    head: [["Concepto de Costo", "Costeo Planificado", "Gasto Real Facturas", "Diferencia / Ahorro", "% Consumo", "Estado"]],
    body: [
      [
        "Compras y Materiales",
        money(costeo.compras?.plan),
        money(costeo.compras?.real),
        `+${money(costeo.compras?.diferencia)}`,
        `${costeo.compras?.porcentajeConsumido || 0}%`,
        (costeo.compras?.porcentajeConsumido || 0) > 100 ? "Sobregirado" : "En Rango (Ahorro)",
      ],
      [
        `Mano de Obra (HH Cotizadas: ${costeo.hh?.horasPlan || 0} hrs)`,
        money(costeo.hh?.plan),
        "—",
        "—",
        "100%",
        "Presupuestado en Cotización",
      ],
      [
        "TOTAL COSTOS PROYECTO",
        money(costeo.total?.costoPlan),
        money(costeo.compras?.real),
        `+${money(costeo.compras?.diferencia)}`,
        `${costeo.compras?.porcentajeConsumido || 0}%`,
        "Dentro de Presupuesto",
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 16;

  // 5. DETALLE DE FACTURAS DE COMPRA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text(`Detalle de Facturas de Compra (${facturas.length} Documentos)`, margin, currentY);

  currentY += 6;

  const facturasBody = facturas.map((f) => {
    const isNC = Number(f.tipo_doc) === 61;
    const tipoStr = Number(f.tipo_doc) === 33 ? "Fact. Elec. (33)" : Number(f.tipo_doc) === 34 ? "Exenta (34)" : Number(f.tipo_doc) === 61 ? "NC (61)" : `Doc. ${f.tipo_doc}`;
    return [
      `#${f.folio || f.numero}`,
      tipoStr,
      f.proveedor || "—",
      f.rut || "—",
      fmtDate(f.fecha),
      f.origen || "Directo",
      money(f.subtotal),
      money(f.iva),
      isNC ? `-${money(f.total)}` : money(f.total),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: { fontSize: 7, textColor: darkGray, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45 },
      1: { cellWidth: 55 },
      2: { cellWidth: 120 },
      3: { cellWidth: 60 },
      4: { cellWidth: 45 },
      5: { cellWidth: 55 },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { fontStyle: "bold", halign: "right" },
    },
    head: [["Folio", "Tipo", "Proveedor", "RUT", "Fecha", "Imputación", "Neto", "IVA", "Total"]],
    body: facturasBody.length > 0 ? facturasBody : [["—", "—", "Sin facturas registradas", "—", "—", "—", "—", "—", "—"]],
    margin: { left: margin, right: margin },
  });

  // 6. FOOTER CON NÚMERO DE PÁGINAS
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400

    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    doc.text(
      `Blue Ingeniería ERP · Reporte Financiero ${nroCotStr} - ${proyecto.nombre || ""}`,
      margin,
      pageHeight - 14
    );

    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 14, {
      align: "right",
    });
  }

  // Guardar / Descargar PDF
  const filename = `Reporte_Financiero_${nroCotStr}_${(proyecto.nombre || "proyecto").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
