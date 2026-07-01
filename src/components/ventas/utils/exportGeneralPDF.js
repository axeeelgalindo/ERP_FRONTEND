"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Formatter for CLP
const clp = (v) =>
  Number(v || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

const fmtDate = (d) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("es-CL");
  } catch {
    return "-";
  }
};

function calcTotalVenta(venta) {
  if (venta?.totalFinal != null) return Number(venta.totalFinal) || 0;
  const detalles = venta?.detalles || [];
  return detalles.reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

function calcTotalCosto(venta) {
  if (venta?.costoFinal != null) return Number(venta.costoFinal) || 0;
  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.costoTotal) || 0), 0);
}

function isCot(venta) {
  return !!(venta?.ordenVenta || venta?.ordenVentaId);
}

function getCotLabel(venta) {
  if (venta?.ordenVenta?.numero) return `COT #${venta.ordenVenta.numero}`;
  if (venta?.ordenVentaId)
    return `COT #${String(venta.ordenVentaId).slice(-4)}`;
  return "Sin Cotización";
}

const compressImageDataURL = (dataUrl, maxW = 400) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxW) {
        h = (maxW / w) * h;
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;

      const isPng = dataUrl.startsWith("data:image/png");
      if (isPng) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const loadImageDataURL = async (src) => {
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${src}`);
  const blob = await res.blob();
  const rawDataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return await compressImageDataURL(rawDataUrl);
};

const getImageDimensions = (dataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
    img.src = dataUrl;
  });
};

const drawPieChartOnCanvas = (canvas, data) => {
  const ctx = canvas.getContext("2d");
  
  // Set high resolution for rendering
  canvas.width = 1200;
  canvas.height = 1200;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) * 0.85;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.55, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    return;
  }

  let startAngle = -0.5 * Math.PI; // Start at 12 o'clock
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();

    // Draw percentage labels inside slices
    const middleAngle = startAngle + sliceAngle / 2;
    const pct = (item.value / total) * 100;
    if (pct > 5) {
      // Position label at 72% of the radius
      const labelX = centerX + Math.cos(middleAngle) * (radius * 0.72);
      const labelY = centerY + Math.sin(middleAngle) * (radius * 0.72);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 42px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Shadow for enhanced legibility
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;

      ctx.fillText(`${pct.toFixed(0)}%`, labelX, labelY);

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    startAngle += sliceAngle;
  });

  // Make it a donut
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.55, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
};

const drawParetoChartOnCanvas = (canvas, data) => {
  const ctx = canvas.getContext("2d");
  
  // Set high resolution for rendering
  canvas.width = 2400;
  canvas.height = 600;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Sort descending
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sin datos de costo para Pareto", canvas.width / 2, canvas.height / 2);
    return;
  }

  // 2. Chart Layout Margins
  const margin = { top: 60, right: 120, bottom: 80, left: 140 };
  const chartW = canvas.width - margin.left - margin.right;
  const chartH = canvas.height - margin.top - margin.bottom;

  // 3. Axes scales
  const maxVal = sorted[0].value * 1.1; // Max value on left Y axis
  const getX = (index) => margin.left + (index + 0.5) * (chartW / sorted.length);
  const getYLeft = (val) => margin.top + chartH - (val / maxVal) * chartH;
  const getYRight = (pct) => margin.top + chartH - (pct / 100) * chartH;

  // Draw Gridlines (left Y axis helper)
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartW, y);
    ctx.stroke();
  }

  // 4. Draw Bars (Cost per category)
  const barWidth = (chartW / sorted.length) * 0.5;
  sorted.forEach((item, idx) => {
    const x = getX(idx) - barWidth / 2;
    const y = getYLeft(item.value);
    const h = margin.top + chartH - y;

    // Gradient fill for bars
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "#3b82f6"); // Blue-500
    gradient.addColorStop(1, "#1d4ed8"); // Blue-700

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, h);

    // Border
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, barWidth, h);

    // Draw Bar Label (truncating long names)
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let displayName = item.name;
    if (displayName.length > 15) displayName = displayName.substring(0, 13) + "...";
    ctx.fillText(displayName, getX(idx), margin.top + chartH + 15);
  });

  // 5. Draw Cumulative Percentage Line
  let cumulative = 0;
  const points = sorted.map((item, idx) => {
    cumulative += item.value;
    const pct = (cumulative / total) * 100;
    return { x: getX(idx), y: getYRight(pct), pct };
  });

  // Draw line
  ctx.strokeStyle = "#f59e0b"; // Amber-500
  ctx.lineWidth = 5;
  ctx.beginPath();
  points.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  // Draw line dots and percentage texts
  points.forEach((pt) => {
    // Dot
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#d97706"; // Amber-600
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Text above point
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${pt.pct.toFixed(0)}%`, pt.x, pt.y - 12);
  });

  // 6. Draw Axes lines and labels
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Left Axis
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartH);
  // Bottom Axis
  ctx.lineTo(margin.left + chartW, margin.top + chartH);
  // Right Axis
  ctx.lineTo(margin.left + chartW, margin.top);
  ctx.stroke();

  // Y-Axis Labels (Left)
  ctx.fillStyle = "#1d4ed8";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * (4 - i);
    let label = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0);
    ctx.fillText(label, margin.left - 15, margin.top + (chartH / 4) * i);
  }

  // Y-Axis Labels (Right)
  ctx.fillStyle = "#d97706";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const pct = 100 - i * 25;
    ctx.fillText(`${pct}%`, margin.left + chartW + 15, margin.top + (chartH / 4) * i);
  }
};

export async function exportGeneralPDF(filteredVentas, range, q, session, setBusy) {
  if (setBusy) setBusy(true);

  try {
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableMod?.default || autoTableMod;

    const W = 210;
    const H = 297;
    const mx = 9;

    const colorsPalette = {
      blue: [11, 95, 137], // #0b5f89
      blueDark: [23, 71, 102], // #174766
      blueSoft: [235, 243, 248], // #ebf3f8
      blueSoft2: [235, 243, 248],
      text: [38, 51, 63], // #26333f
      muted: [107, 114, 128], // #6b7280
      tableGray: [240, 242, 245], // #f0f2f5
      line: [184, 192, 200], // #b8c0c8
      white: [255, 255, 255],
    };

    const docTitle = "REPORTE GENERAL DE COSTEOS";

    let logo = null;
    const MAX_LOGO_W = 43;
    const MAX_LOGO_H = 18;

    let logoW = MAX_LOGO_W;
    let logoH = MAX_LOGO_H;
    let logoY = 14.0;

    // Extract company info from session/token
    const empId = session?.user?.empresa?.id || session?.user?.empresaId || null;
    const empNombre = session?.user?.empresa?.nombre || session?.user?.empresaNombre || "Blue Ingeniería";
    const empRut = session?.user?.empresa?.rut || "RUT 76.123.456-7";
    const empCorreo = session?.user?.empresa?.correo || "administracion@blueinge.com";
    const isBlue = String(empNombre).toLowerCase().includes("blue");

    try {
      if (empId) {
        const backendBase = API_URL ? API_URL.replace(/\/api$/, "") : "";
        let dbLogoUrl = null;
        if (session?.user?.empresa?.logo_url) {
          const rawUrl = session.user.empresa.logo_url;
          if (rawUrl.startsWith("http")) {
            dbLogoUrl = rawUrl;
          } else {
            let cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
            if (cleanPath.startsWith("/uploads/") && !cleanPath.startsWith("/api/")) {
              cleanPath = `/api${cleanPath}`;
            }
            dbLogoUrl = `${backendBase}${cleanPath}`;
          }
        }

        const pathsToTry = [
          dbLogoUrl,
          `/logos/logo_${empId}.png`,
          `/logos/${empId}.png`,
          `/logo_${empId}.png`,
          `/${empId}.png`,
          ...(isBlue ? [`/Logo_blue.png`] : []),
        ].filter(Boolean);
        for (const p of pathsToTry) {
          try {
            logo = await loadImageDataURL(p);
            if (logo) break;
          } catch {
            // try next
          }
        }
      } else {
        logo = await loadImageDataURL("/Logo_blue.png");
      }

      if (logo) {
        const dimensions = await getImageDimensions(logo);
        if (dimensions.width > 0 && dimensions.height > 0) {
          const ratio = dimensions.width / dimensions.height;
          const maxRatio = MAX_LOGO_W / MAX_LOGO_H;
          if (ratio > maxRatio) {
            logoW = MAX_LOGO_W;
            logoH = MAX_LOGO_W / ratio;
          } else {
            logoH = MAX_LOGO_H;
            logoW = MAX_LOGO_H * ratio;
          }
          logoY = 14.0 + (MAX_LOGO_H - logoH) / 2;
        }
      }
    } catch {
      logo = null;
    }

    const doc = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: [W, H],
      compress: true,
    });

    const drawHeader = () => {
      doc.setFillColor(...colorsPalette.blueSoft);
      doc.moveTo(0, 0);
      doc.lineTo(210, 0);
      doc.lineTo(210, 35);
      doc.curveTo(175, 33, 140, 36, 105, 38);
      doc.curveTo(70, 40, 35, 34, 0, 36);
      doc.close();
      doc.fill();

      if (logo) {
        doc.addImage(logo, "PNG", mx, logoY, logoW, logoH, "logo", "FAST");
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(...colorsPalette.blue);
        doc.text("BLUE", mx, 24);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...colorsPalette.blueDark);
        doc.text("Ingeniería SPA", mx, 28);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(38, 56, 69);
      doc.text(empNombre, W - mx, 14, { align: "right" });
      doc.text(empRut, W - mx, 18, { align: "right" });
      doc.text(empCorreo, W - mx, 22, { align: "right" });
      doc.text("Reporte de Gestión y Control", W - mx, 26, { align: "right" });
    };

    const drawFooter = (page, pages) => {
      doc.setFillColor(...colorsPalette.blueSoft2);
      doc.moveTo(0, 274);
      doc.curveTo(35, 276, 70, 270, 105, 272);
      doc.curveTo(140, 274, 175, 277, 210, 275);
      doc.lineTo(210, 297);
      doc.lineTo(0, 297);
      doc.close();
      doc.fill();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(38, 51, 63);
      doc.text(empCorreo, W / 2, H - 14, { align: "center" });

      doc.setTextColor(140, 153, 163);
      doc.setFontSize(7.5);
      doc.text(`Página ${page} / ${pages}`, W / 2, H - 7, { align: "center" });
    };

    drawHeader();
    drawFooter(1, 1);

    let y = 50;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...colorsPalette.blue);
    doc.text(docTitle, mx, y);
    y += 8;

    // Filter information
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...colorsPalette.text);

    let rangeLabel = "Todo el histórico";
    if (range === "mes") rangeLabel = "Mes actual";
    else if (range === "porMes") rangeLabel = "Por Mes";
    else if (range === "dia") rangeLabel = "Día actual";

    doc.text(`Período / Rango: ${rangeLabel}`, mx, y);
    y += 5;
    if (q && q.trim()) {
      doc.text(`Filtro de búsqueda: "${q.trim()}"`, mx, y);
      y += 5;
    }
    doc.text(`Fecha Emisión: ${fmtDate(new Date())}`, mx, y);
    y += 8;

    // ==========================================
    // FINANCIAL SUMMARY CARDS
    // ==========================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorsPalette.blueDark);
    doc.text("RESUMEN FINANCIERO DEL PERIODO", mx, y);
    y += 5;

    // Calculate metrics
    let totalCosto = 0;
    let totalVenta = 0;
    for (const v of filteredVentas) {
      totalCosto += calcTotalCosto(v);
      totalVenta += calcTotalVenta(v);
    }
    const utilidad = totalVenta - totalCosto;
    const margenProm = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;
    const count = filteredVentas.length;

    const cardW = (W - mx * 2) / 5;
    const cardH = 16;

    // Card 1: Cantidad
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.roundedRect(mx, y, cardW - 2, cardH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text("Total Costeos", mx + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(String(count), mx + 3, y + 11);

    // Card 2: Venta Total
    doc.setFillColor(236, 253, 245); // Emerald-50
    doc.roundedRect(mx + cardW, y, cardW - 2, cardH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text("Venta Proyectada", mx + cardW + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(clp(totalVenta), mx + cardW + 3, y + 11);

    // Card 3: Costo Total
    doc.setFillColor(254, 242, 242); // Red-50
    doc.roundedRect(mx + cardW * 2, y, cardW - 2, cardH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text("Costo Proyectado", mx + cardW * 2 + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(clp(totalCosto), mx + cardW * 2 + 3, y + 11);

    // Card 4: Utilidad
    doc.setFillColor(243, 244, 246); // Gray-50
    doc.roundedRect(mx + cardW * 3, y, cardW - 2, cardH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99); // Gray-600
    doc.text("Utilidad Est.", mx + cardW * 3 + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(clp(utilidad), mx + cardW * 3 + 3, y + 11);

    // Card 5: % Margen
    doc.setFillColor(238, 242, 255); // Indigo-50
    doc.roundedRect(mx + cardW * 4, y, cardW - 2, cardH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("Margen Prom.", mx + cardW * 4 + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`${margenProm.toFixed(1)}%`, mx + cardW * 4 + 3, y + 11);

    y += cardH + 10;

    // ==========================================
    // SECCIÓN DE ANÁLISIS OPERATIVO Y GRÁFICOS
    // ==========================================
    if (y + 55 > H - 42) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorsPalette.blueDark);
    doc.text("ANÁLISIS OPERATIVO Y DISTRIBUCIÓN DEL COSTO", mx, y);
    y += 5;

    // 1. Data Costos
    let costoHH = 0;
    const gruposCompra = {};
    for (const v of filteredVentas) {
      costoHH += Number(v.extraVenta || 0);
      for (const d of v.detalles || []) {
        const c = Number(d.costoTotal || 0);
        if (d.modo === "HH") {
          costoHH += c;
        } else {
          const tipo = d.tipoItem?.nombre || "Otros Insumos";
          gruposCompra[tipo] = (gruposCompra[tipo] || 0) + c;
        }
      }
    }

    const costSegments = [];
    if (costoHH > 0) {
      costSegments.push({
        name: "Horas Hombre (HH)",
        value: costoHH,
        color: "#10b981", // Emerald
      });
    }

    const compraColors = [
      "#3b82f6", // Blue
      "#8b5cf6", // Violet
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#ec4899", // Pink
      "#14b8a6", // Teal
      "#64748b", // Slate
    ];

    Object.entries(gruposCompra).forEach(([name, value], idx) => {
      if (value > 0) {
        costSegments.push({
          name,
          value,
          color: compraColors[idx % compraColors.length],
        });
      }
    });

    const totalCostSegments = costSegments.reduce((sum, item) => sum + item.value, 0);

    // 2. Data Vinculación
    const vinculados = filteredVentas.filter(isCot).length;
    const noVinculados = count - vinculados;

    const linkSegments = [];
    if (vinculados > 0) {
      linkSegments.push({
        name: "Vinculados",
        value: vinculados,
        color: "#10b981",
      });
    }
    if (noVinculados > 0) {
      linkSegments.push({
        name: "Sin Vincular",
        value: noVinculados,
        color: "#f59e0b",
      });
    }
    const totalLinkSegments = linkSegments.reduce((sum, item) => sum + item.value, 0);

    // Canvas drawing
    let chart1DataURL = null;
    let chart2DataURL = null;

    try {
      const canvas1 = document.createElement("canvas");
      canvas1.width = 300;
      canvas1.height = 300;
      drawPieChartOnCanvas(canvas1, costSegments);
      chart1DataURL = canvas1.toDataURL("image/png");

      const canvas2 = document.createElement("canvas");
      canvas2.width = 300;
      canvas2.height = 300;
      drawPieChartOnCanvas(canvas2, linkSegments);
      chart2DataURL = canvas2.toDataURL("image/png");
    } catch (e) {
      console.error("Error generating report canvases:", e);
    }

    const startYCharts = y;

    // ==========================================
    // ROW 1: Cost Breakdown (Distribución de Costos)
    // ==========================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colorsPalette.blueDark);
    doc.text("Distribución de Costos", mx + 2, y + 4);

    let finalY1 = y + 54;
    if (chart1DataURL && costSegments.length > 0) {
      doc.addImage(chart1DataURL, "PNG", mx + 10, y + 7, 46, 46, "global_cost_chart", "NONE");

      const legend1Body = costSegments.map((item) => {
        const pct = totalCostSegments > 0 ? (item.value / totalCostSegments) * 100 : 0;
        return [
          { content: "", styles: { fillColor: item.color } },
          item.name,
          clp(item.value),
          `${pct.toFixed(1)}%`,
        ];
      });

      autoTable(doc, {
        startY: y + 7,
        margin: { left: mx + 70, right: mx },
        tableWidth: 110,
        head: [["", "Tipo Costo", "Monto", "Porcentaje"]],
        body: legend1Body,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 8,
          textColor: colorsPalette.text,
          cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
        },
        columnStyles: {
          0: { cellWidth: 5 },
          1: { cellWidth: 55, fontStyle: "bold" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 20, halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "head") {
            data.cell.styles.lineWidth = { bottom: 0.15 };
            data.cell.styles.lineColor = colorsPalette.line;
            data.cell.styles.textColor = [31, 41, 51];
          } else if (data.column.index !== 0) {
            data.cell.styles.fillColor = colorsPalette.tableGray;
          }
        },
      });
      if (doc.lastAutoTable) finalY1 = doc.lastAutoTable.finalY;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colorsPalette.muted);
      doc.text("No hay costos registrados en este período.", mx + 2, y + 10);
    }

    y = Math.max(y + 54, finalY1 + 6);

    // ==========================================
    // ROW 2: Quote Linkage (Tasa de Vinculación a Cotizaciones)
    // ==========================================
    if (y + 58 > H - 42) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colorsPalette.blueDark);
    doc.text("Tasa de Vinculación a Cotizaciones", mx + 2, y + 4);

    let finalY2 = y + 54;
    if (chart2DataURL && linkSegments.length > 0) {
      doc.addImage(chart2DataURL, "PNG", mx + 10, y + 7, 46, 46, "global_link_chart", "NONE");

      const legend2Body = linkSegments.map((item) => {
        const pct = totalLinkSegments > 0 ? (item.value / totalLinkSegments) * 100 : 0;
        return [
          { content: "", styles: { fillColor: item.color } },
          item.name,
          `${item.value} ${item.value === 1 ? "Costeo" : "Costeos"}`,
          `${pct.toFixed(1)}%`,
        ];
      });

      autoTable(doc, {
        startY: y + 7,
        margin: { left: mx + 70, right: mx },
        tableWidth: 110,
        head: [["", "Estado", "Cantidad", "Porcentaje"]],
        body: legend2Body,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 8,
          textColor: colorsPalette.text,
          cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
        },
        columnStyles: {
          0: { cellWidth: 5 },
          1: { cellWidth: 55, fontStyle: "bold" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 20, halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "head") {
            data.cell.styles.lineWidth = { bottom: 0.15 };
            data.cell.styles.lineColor = colorsPalette.line;
            data.cell.styles.textColor = [31, 41, 51];
          } else if (data.column.index !== 0) {
            data.cell.styles.fillColor = colorsPalette.tableGray;
          }
        },
      });
      if (doc.lastAutoTable) finalY2 = doc.lastAutoTable.finalY;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colorsPalette.muted);
      doc.text("No hay vinculaciones en este período.", mx + 2, y + 10);
    }

    // 3. Pareto Chart
    let paretoDataURL = null;
    try {
      const canvasP = document.createElement("canvas");
      drawParetoChartOnCanvas(canvasP, costSegments);
      paretoDataURL = canvasP.toDataURL("image/png");
    } catch (e) {
      console.error("Error generating Pareto canvas:", e);
    }

    y = Math.max(finalY2, y + 54) + 6;

    if (paretoDataURL && costSegments.length > 0) {
      if (y + 60 > H - 42) {
        doc.addPage();
        y = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("Análisis de Pareto: Distribución y Acumulación del Costo", mx + 2, y + 4);
      doc.addImage(paretoDataURL, "PNG", mx + 2, y + 6, 190, 47.5, "global_pareto_chart", "NONE");
      y += 59;
    } else {
      y += 2;
    }

    // ==========================================
    // DETAILS TABLE WITH SUB-ITEMS
    // ==========================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorsPalette.blueDark);
    doc.text("LISTADO DETALLADO DE COSTEOS", mx, y);
    y += 6;

    const itemsBody = [];
    filteredVentas.forEach((v) => {
      const vTotal = calcTotalVenta(v);
      const cTotal = calcTotalCosto(v);
      const ut = vTotal - cTotal;
      const margin = vTotal > 0 ? (ut / vTotal) * 100 : 0;

      const numLabel = v.numero != null ? `#${v.numero}` : "—";
      const descLabel = v.descripcion || "Sin descripción";
      const fechaLabel = fmtDate(v.fecha || v.createdAt);
      const cotLabel = getCotLabel(v);

      // Parent row
      const parentRow = [
        numLabel,
        descLabel,
        fechaLabel,
        cotLabel,
        clp(cTotal),
        clp(vTotal),
        clp(ut),
        `${margin.toFixed(0)}%`,
      ];
      parentRow.isSubItem = false;
      itemsBody.push(parentRow);

      // Child details (sub-items)
      if (v.detalles && v.detalles.length > 0) {
        v.detalles.forEach((d, idx) => {
          const subCosto = Number(d.costoTotal || 0);
          const subVenta = Number(d.ventaTotal || 0);
          const subUt = subVenta - subCosto;
          const subMargin = subVenta > 0 ? (subUt / subVenta) * 100 : 0;

          const parentNumStr = v.numero != null ? String(v.numero) : "—";
          const subId = `  ${parentNumStr}.${idx + 1}`;
          const subDesc = `  ${d.descripcion || "Item sin descripción"}`;
          const subCotLabel = d.modo === "HH" ? "Horas Hombre" : (d.tipoItem?.nombre || "Otros Insumos");

          const childRow = [
            subId,
            subDesc,
            "", // Empty date
            subCotLabel, // Mode/Type
            clp(subCosto),
            clp(subVenta),
            clp(subUt),
            `${subMargin.toFixed(0)}%`,
          ];
          childRow.isSubItem = true;
          itemsBody.push(childRow);
        });
      }
    });

    autoTable(doc, {
      startY: y,
      margin: { left: mx, right: mx, top: 48, bottom: 42 },
      tableWidth: W - mx * 2,
      head: [["ID", "Descripción / Proyecto / Ítem", "Fecha", "Cotización / Modo", "Costo", "Venta", "Utilidad", "Margen"]],
      body: itemsBody,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        textColor: colorsPalette.text,
        cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 55 },
        2: { cellWidth: 18 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 14, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          data.cell.styles.lineWidth = { bottom: 0.25 };
          data.cell.styles.lineColor = colorsPalette.line;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [31, 41, 51];
          data.cell.styles.fillColor = [255, 255, 255];
        } else {
          const isSub = data.row.raw.isSubItem;
          if (isSub) {
            data.cell.styles.fillColor = [248, 250, 252]; // Slate-50 background for sub-items
            data.cell.styles.textColor = [71, 85, 105]; // Slate-600 text for better contrast
            data.cell.styles.fontSize = 7;
            data.cell.styles.fontStyle = "normal";
          } else {
            data.cell.styles.fillColor = [255, 255, 255]; // White background for parent rows
            data.cell.styles.fontStyle = "bold"; // Bold text for parent costing rows
            data.cell.styles.textColor = [15, 23, 42]; // Slate-900 strong text
            // Add a thin slate line above the parent row to group items neatly
            data.cell.styles.lineWidth = { top: 0.15 };
            data.cell.styles.lineColor = [226, 232, 240];
          }
        }
      },
    });

    // Page numbers & re-renders
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      drawHeader();
      drawFooter(p, pageCount);
    }

    const fileName = `Reporte_General_Costeos_${fmtDate(new Date()).replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error("Error generating PDF:", err);
    alert("Error al generar el PDF: " + (err.message || String(err)));
  } finally {
    if (setBusy) setBusy(false);
  }
}
