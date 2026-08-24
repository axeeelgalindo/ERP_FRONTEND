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
  const comprasPorMes = data?.comprasPorMes || [];
  const comprasPorProveedor = data?.comprasPorProveedor || [];

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Paleta de Colores Corporativos
  const navy = [30, 58, 138]; // #1e3a8a
  const blue = [37, 99, 235]; // #2563eb
  const indigo = [79, 70, 229]; // #4f46e5
  const emerald = [5, 150, 105]; // #059669
  const amber = [217, 119, 6]; // #d97706
  const dark = [15, 23, 42]; // #0f172a
  const slate = [71, 85, 105]; // #475569
  const lightSlate = [148, 163, 184]; // #94a3b8
  const bgLight = [248, 250, 252]; // #f8fafc
  const borderCol = [226, 232, 240]; // #e2e8f0

  const nroCotStr = proyecto.nroCotizacion ? `COT-${proyecto.nroCotizacion}` : "SIN COTIZACIÓN";

  // =========================================================================
  // PÁGINA 1: DASHBOARD EJECUTIVO Y GRÁFICOS
  // =========================================================================
  let currentY = 36;

  // 1. Header Empresa & Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text(empresa.nombre || "BLUE INGENIERÍA SPA", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...slate);
  let subY = currentY + 12;
  if (empresa.rut) {
    doc.text(`RUT: ${empresa.rut}`, margin, subY);
    subY += 10;
  }
  if (empresa.direccion) {
    doc.text(`${empresa.direccion}`, margin, subY);
    subY += 10;
  }

  // Título a la derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...dark);
  doc.text("INFORME FINANCIERO EJECUTIVO", pageWidth - margin, currentY, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...blue);
  doc.text(nroCotStr, pageWidth - margin, currentY + 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...lightSlate);
  doc.text(`Emisión: ${new Date().toLocaleDateString("es-CL")}`, pageWidth - margin, currentY + 26, { align: "right" });

  // Línea divisoria
  currentY = Math.max(subY, currentY + 36);
  doc.setDrawColor(...borderCol);
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 2. Ficha del Proyecto y Cliente (Bloque estilizado)
  currentY += 8;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, currentY, contentWidth, 38, 6, 6, "FD");

  // Columna 1: Proyecto y Estado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text("PROYECTO:", margin + 12, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  const projNombre = doc.splitTextToSize(proyecto.nombre || "—", 185);
  doc.text(projNombre[0] || "—", margin + 65, currentY + 15);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...slate);
  doc.text("ESTADO:", margin + 12, currentY + 28);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text((proyecto.estado || "ACTIVO").toUpperCase(), margin + 65, currentY + 28);

  // Columna 2: Cliente y Cotización (con ancho acotado para evitar desborde)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("CLIENTE:", margin + 260, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  const rawCliente = `${proyecto.cliente?.nombre || "—"}${proyecto.cliente?.rut ? ` (${proyecto.cliente.rut})` : ""}`;
  const clienteLines = doc.splitTextToSize(rawCliente, 205);
  doc.text(clienteLines[0] || "—", margin + 308, currentY + 15);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...slate);
  doc.text("COTIZACIÓN:", margin + 260, currentY + 28);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text(`${nroCotStr} · ${money(kpis.montoTotalVentaNeto)} Neto`, margin + 326, currentY + 28);

  currentY += 46;

  // 3. 4 Tarjetas de KPIs Ejecutivos (Vectoriales con Barra de Progreso)
  const cardGap = 8;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 62;

  const pctComprasSobreVenta = Number(kpis.montoTotalVentaNeto || 0) > 0
    ? Number(((Number(kpis.montoTotalCompras || 0) / Number(kpis.montoTotalVentaNeto)) * 100).toFixed(1))
    : 0;

  const kpiCards = [
    {
      title: "1. VENTA TOTAL (100%)",
      value: money(kpis.montoTotalVentaNeto),
      sub: `Bruto: ${money(kpis.montoTotalVentaBruto)}`,
      pct: 100,
      color: blue,
      bgColor: [239, 246, 255],
    },
    {
      title: `2. COBRANZA (${kpis.porcentajeCobrado || 0}%)`,
      value: money(kpis.montoCobradoNeto),
      sub: `Por cobrar: ${money(kpis.saldoPorCobrarNeto)} (${kpis.porcentajePendiente || 0}%)`,
      pct: kpis.porcentajeCobrado || 0,
      color: amber,
      bgColor: [254, 243, 199],
    },
    {
      title: `3. COMPRAS RCV (${pctComprasSobreVenta}%)`,
      value: money(kpis.montoTotalCompras),
      sub: `Plan: ${money(costeo.compras?.plan)}`,
      pct: Math.min(100, costeo.compras?.porcentajeConsumido || 0),
      color: indigo,
      bgColor: [238, 242, 255],
    },
    {
      title: "4. UTILIDAD REAL",
      value: money(kpis.utilidadReal),
      sub: `Margen: ${kpis.margenRealPct || 0}% (Plan: ${kpis.margenPlanPct || 0}%)`,
      pct: Math.min(100, Math.max(0, kpis.margenRealPct || 0)),
      color: emerald,
      bgColor: [236, 253, 245],
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + cardGap);
    // Fondo Tarjeta
    doc.setFillColor(...card.bgColor);
    doc.setDrawColor(...borderCol);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 5, 5, "FD");

    // Título KPI
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...card.color);
    doc.text(card.title, x + 8, currentY + 12);

    // Monto Grande
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...dark);
    doc.text(card.value, x + 8, currentY + 28);

    // Barra de Progreso
    const barX = x + 8;
    const barY = currentY + 35;
    const barW = cardWidth - 16;
    const barH = 3;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, "F");
    if (card.pct > 0) {
      doc.setFillColor(...card.color);
      doc.roundedRect(barX, barY, (barW * Math.min(100, card.pct)) / 100, barH, 1.5, 1.5, "F");
    }

    // Subtítulo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...slate);
    doc.text(card.sub, x + 8, currentY + 50);
  });

  currentY += cardHeight + 14;

  // 4. SECCIÓN DE GRÁFICOS VECTORIALES (2 Columnas: Evolución Mensual y Concentración Proveedores)
  const chartColW = (contentWidth - 14) / 2;
  const chartH = 135;

  // COLUMNA IZQUIERDA: Gráfico de Barras Mensuales
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, currentY, chartColW, chartH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...navy);
  doc.text("Ritmo y Evolución Mensual de Compras", margin + 12, currentY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...slate);
  doc.text("Gasto imputado mes a mes vs acumulado", margin + 12, currentY + 26);

  if (comprasPorMes.length > 0) {
    const chartBaseY = currentY + 110;
    const maxMesMonto = Math.max(...comprasPorMes.map((m) => Number(m.total || 0)), 1);
    const maxBarH = 65;
    const numBars = comprasPorMes.length;
    const barSlotW = (chartColW - 36) / numBars;
    const barVisualW = Math.min(26, barSlotW * 0.6);

    // Eje base horizontal
    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.75);
    doc.line(margin + 16, chartBaseY, margin + chartColW - 16, chartBaseY);

    comprasPorMes.forEach((m, idx) => {
      const slotCenter = margin + 18 + idx * barSlotW + barSlotW / 2;
      const bH = (Number(m.total || 0) / maxMesMonto) * maxBarH;
      const bX = slotCenter - barVisualW / 2;
      const bY = chartBaseY - bH;

      // Barra
      doc.setFillColor(...indigo);
      doc.roundedRect(bX, bY, barVisualW, Math.max(2, bH), 2, 2, "F");

      // Monto sobre la barra
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...dark);
      const montoFmt = m.total >= 1000000 ? `$${(m.total / 1000000).toFixed(1)}M` : `$${Math.round(m.total / 1000)}k`;
      doc.text(montoFmt, slotCenter, bY - 3, { align: "center" });

      // Etiqueta del mes
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...slate);
      doc.text(m.mesLabel || "", slotCenter, chartBaseY + 10, { align: "center" });

      // Cantidad de facturas
      doc.setFontSize(5);
      doc.setTextColor(...lightSlate);
      doc.text(`${m.cantidad} docs`, slotCenter, chartBaseY + 18, { align: "center" });
    });
  }

  // COLUMNA DERECHA: Concentración por Proveedor (Barras Horizontales)
  const rightColX = margin + chartColW + 14;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderCol);
  doc.roundedRect(rightColX, currentY, chartColW, chartH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...navy);
  doc.text("Concentración de Compras por Proveedor", rightColX + 12, currentY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...slate);
  doc.text("Top proveedores con mayor participación en costo", rightColX + 12, currentY + 26);

  const topProveedores = (comprasPorProveedor || []).slice(0, 5);
  let provY = currentY + 38;

  if (topProveedores.length > 0) {
    topProveedores.forEach((p) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...dark);
      const name = p.proveedor.length > 22 ? p.proveedor.slice(0, 22) + "…" : p.proveedor;
      doc.text(name, rightColX + 12, provY + 6);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...slate);
      doc.text(`${money(p.total)} (${p.porcentaje}%)`, rightColX + chartColW - 12, provY + 6, { align: "right" });

      // Barra horizontal
      const pBarX = rightColX + 12;
      const pBarY = provY + 9;
      const pBarW = chartColW - 24;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(pBarX, pBarY, pBarW, 3, 1.5, 1.5, "F");

      doc.setFillColor(...navy);
      doc.roundedRect(pBarX, pBarY, (pBarW * Math.min(100, p.porcentaje)) / 100, 3, 1.5, 1.5, "F");

      provY += 18;
    });
  }

  currentY += chartH + 12;

  // 5. TABLA RESUMEN DE COSTEOS Y PRESUPUESTO COTIZADO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("Desglose de Costeos y Presupuesto Cotizado", margin, currentY);

  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 7.5, textColor: dark, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 150 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "center" },
      5: { halign: "center", fontStyle: "bold" },
    },
    head: [["Concepto de Costo", "Costeo Planificado", "Gasto Real Facturas", "Diferencia / Ahorro", "% Consumo", "Estado"]],
    body: [
      [
        "Compras y Materiales (RCV)",
        money(costeo.compras?.plan),
        money(costeo.compras?.real),
        `+${money(costeo.compras?.diferencia)}`,
        `${costeo.compras?.porcentajeConsumido || 0}%`,
        (costeo.compras?.porcentajeConsumido || 0) > 100 ? "Sobregirado" : "Ahorro a Favor",
      ],
      [
        `Mano de Obra (HH Cotizadas: ${costeo.hh?.horasPlan || 0} hrs)`,
        money(costeo.hh?.plan),
        "—",
        "—",
        "100%",
        "Plan Cotización",
      ],
      [
        "TOTAL PRESUPUESTO Y COSTOS",
        money(costeo.total?.costoPlan),
        money(costeo.compras?.real),
        `+${money(costeo.compras?.diferencia)}`,
        `${costeo.compras?.porcentajeConsumido || 0}%`,
        "En Rango",
      ],
    ],
    margin: { left: margin, right: margin },
  });

  // =========================================================================
  // PÁGINA 2: ANEXO DE FACTURAS Y DOCUMENTOS DETALLADOS
  // =========================================================================
  doc.addPage();
  currentY = 36;

  // Header de la Página 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("ANEXO: DETALLE DE FACTURAS Y DOCUMENTOS TRIBUTARIOS (RCV)", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...slate);
  doc.text(
    `Registro completo de compras asociadas al proyecto ${proyecto.nombre || ""} (${facturas.length} documentos emitidos)`,
    margin,
    currentY + 12
  );

  currentY += 22;

  const facturasBody = facturas.map((f) => {
    const isNC = Number(f.tipo_doc) === 61;
    const tipoStr =
      Number(f.tipo_doc) === 33
        ? "Fact. Elec. (33)"
        : Number(f.tipo_doc) === 34
        ? "Exenta (34)"
        : Number(f.tipo_doc) === 61
        ? "NC (61)"
        : `Doc. ${f.tipo_doc}`;

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
    theme: "striped",
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 7, textColor: dark, cellPadding: 3.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { cellWidth: 46 },
      2: { cellWidth: 105 },
      3: { cellWidth: 56 },
      4: { cellWidth: 42 },
      5: { cellWidth: 44 },
      6: { cellWidth: 62, halign: "right" },
      7: { cellWidth: 56, halign: "right" },
      8: { fontStyle: "bold", cellWidth: 70, halign: "right" },
    },
    head: [["Folio", "Tipo", "Proveedor", "RUT", "Fecha", "Imputación", "Neto", "IVA", "Total"]],
    body:
      facturasBody.length > 0
        ? facturasBody
        : [["—", "—", "Sin facturas registradas", "—", "—", "—", "—", "—", "—"]],
    foot: [
      [
        "TOTALES",
        "",
        "",
        "",
        `${facturas.length} docs`,
        "",
        money(facturas.reduce((acc, f) => acc + (Number(f.tipo_doc) === 61 ? -Number(f.subtotal || 0) : Number(f.subtotal || 0)), 0)),
        money(facturas.reduce((acc, f) => acc + (Number(f.tipo_doc) === 61 ? -Number(f.iva || 0) : Number(f.iva || 0)), 0)),
        money(kpis.montoTotalCompras),
      ],
    ],
    footStyles: {
      fillColor: bgLight,
      textColor: dark,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 3,
    },
    margin: { left: margin, right: margin },
  });

  // =========================================================================
  // FOOTER CON NUMERACIÓN DE PÁGINAS EN TODO EL DOCUMENTO
  // =========================================================================
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

    doc.text(
      `Blue Ingeniería ERP · Reporte Financiero ${nroCotStr} - ${proyecto.nombre || ""}`,
      margin,
      pageHeight - 12
    );

    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 12, {
      align: "right",
    });
  }

  // Guardar / Descargar PDF
  const filename = `Reporte_Financiero_${nroCotStr}_${(proyecto.nombre || "proyecto").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
