"use client";

import React, { useMemo, useState } from "react";
import ModalBase from "@/components/compras/ModalBase";

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

const safe = (v) => String(v ?? "").trim();

const safeName = (s) =>
  String(s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .slice(0, 80);

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

export default function ReporteCosteoModal({ open, onClose, venta, session }) {
  const [busy, setBusy] = useState(false);

  // Group details by TipoItem name + HH
  const comprasData = useMemo(() => {
    if (!venta || !venta.detalles) return [];

    let costoHH = Number(venta.extraVenta || 0);
    const gruposCompra = {};

    venta.detalles.forEach((d) => {
      const c = Number(d.costoTotal || 0);
      if (d.modo === "HH") {
        costoHH += c;
      } else {
        const tipo = d.tipoItem?.nombre || "Otros Insumos";
        gruposCompra[tipo] = (gruposCompra[tipo] || 0) + c;
      }
    });

    const segments = [];
    if (costoHH > 0) {
      segments.push({
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
        segments.push({
          name,
          value,
          color: compraColors[idx % compraColors.length],
        });
      }
    });

    return segments;
  }, [venta]);

  const totalCompras = useMemo(() => {
    return comprasData.reduce((sum, item) => sum + item.value, 0);
  }, [comprasData]);

  // SVG Donut Calculations
  const r = 50;
  const C = 2 * Math.PI * r;

  const donutChart = useMemo(() => {
    let accumulatedPercent = 0;
    return comprasData.map((item) => {
      const percent = totalCompras > 0 ? (item.value / totalCompras) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * C} ${C}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * C);
      accumulatedPercent += percent;
      return {
        ...item,
        percent,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [comprasData, totalCompras, C]);

  // Helper to draw pie chart in canvas for PDF
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
      // Draw a grey circle if no purchases
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

  const handleExportPDF = async () => {
    if (busy) return;
    try {
      setBusy(true);

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

      const numDoc = venta?.numero != null ? String(venta.numero).padStart(5, "0") : "00000";
      const docTitle = `Reporte de Costeo #C${numDoc}`;

      let logo = null;
      const MAX_LOGO_W = 43;
      const MAX_LOGO_H = 18;

      let logoW = MAX_LOGO_W;
      let logoH = MAX_LOGO_H;
      let logoY = 14.0;

      // Extract company info from session/token
      const empId = session?.user?.empresa?.id || session?.user?.empresaId || venta?.empresa_id || null;
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
          // Fallback text logo
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
        doc.text("Reporte Interno de Control", W - mx, 26, { align: "right" });
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

      // Set up page 1
      drawHeader();
      drawFooter(1, 1);

      let y = 50;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...colorsPalette.blue);
      doc.text(docTitle, mx, y);
      y += 8;

      // Project description / Project ID
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...colorsPalette.text);
      doc.text(`Proyecto: ${venta.descripcion || "Sin descripción"}`, mx, y);
      y += 5;
      doc.text(`Fecha Emisión: ${fmtDate(venta.createdAt || new Date())}`, mx, y);
      y += 8;

      // ==========================================
      // COTIZACION ASOCIADA / ASSOCIATED QUOTE
      // ==========================================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("Cotización Asociada", mx, y);
      y += 5;

      const hasQuote = !!venta.ordenVenta;
      if (hasQuote) {
        const q = venta.ordenVenta;
        const qNum = q.numero != null ? `COT #${String(q.numero).padStart(5, "0")}` : "COT #-----";
        
        doc.setFillColor(243, 248, 252);
        doc.roundedRect(mx, y, W - mx * 2, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...colorsPalette.blue);
        doc.text(qNum, mx + 4, y + 6);
        doc.text("Cliente:", mx + 4, y + 12);
        doc.text("Proyecto ERP:", mx + 4, y + 17);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colorsPalette.text);
        doc.text(`Estado: ${q.estado || "Aceptada"}`, mx + 40, y + 6);
        doc.text(`${q.cliente?.nombre || "—"} (${q.cliente?.rut || ""})`, mx + 20, y + 12);
        doc.text(q.proyecto?.nombre || "—", mx + 30, y + 17);

        doc.setFont("helvetica", "bold");
        doc.text("Valor Cotizado:", W - mx - 4, y + 12, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.text(clp(q.total), W - mx - 4, y + 17, { align: "right" });

        y += 28;
      } else {
        doc.setFillColor(254, 243, 199); // Amber soft
        doc.roundedRect(mx, y, W - mx * 2, 10, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(180, 83, 9); // Amber dark
        doc.text("⚠️ SIN COTIZACIÓN ASOCIADA", mx + 4, y + 6.5);
        y += 16;
      }

      // ==========================================
      // FINANCIAL SUMMARY CARDS
      // ==========================================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("Resumen Financiero del Costeo", mx, y);
      y += 5;

      const cardW = (W - mx * 2) / 4;
      const cardH = 16;

      // Card 1: Venta Total
      doc.setFillColor(236, 253, 245); // Emerald-50
      doc.roundedRect(mx, y, cardW - 2, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(5, 150, 105); // Emerald-600
      doc.text("Venta Proyectada", mx + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(clp(venta.totalFinal || venta.totalBase), mx + 3, y + 11);

      // Card 2: Costo Total
      doc.setFillColor(254, 242, 242); // Red-50
      doc.roundedRect(mx + cardW, y, cardW - 2, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(220, 38, 38); // Red-600
      doc.text("Costo Proyectado", mx + cardW + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(clp(venta.costoFinal || venta.costoBase), mx + cardW + 3, y + 11);

      // Card 3: Utilidad
      const utilityVal = (venta.totalFinal || venta.totalBase) - (venta.costoFinal || venta.costoBase);
      doc.setFillColor(243, 244, 246); // Gray-50
      doc.roundedRect(mx + cardW * 2, y, cardW - 2, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99); // Gray-600
      doc.text("Utilidad Est.", mx + cardW * 2 + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(clp(utilityVal), mx + cardW * 2 + 3, y + 11);

      // Card 4: % Margen
      const marginPct = (venta.totalFinal || venta.totalBase) > 0 ? (utilityVal / (venta.totalFinal || venta.totalBase)) * 100 : 0;
      doc.setFillColor(238, 242, 255); // Indigo-50
      doc.roundedRect(mx + cardW * 3, y, cardW - 2, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("Margen Prom.", mx + cardW * 3 + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(`${marginPct.toFixed(1)}%`, mx + cardW * 3 + 3, y + 11);

      y += cardH + 10;

      // ==========================================
      // GRAPHIC & PURCHASE BREAKDOWN
      // ==========================================
      if (y + 55 > H - 42) {
        doc.addPage();
        y = 50;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("Distribución del Costo Total", mx, y);
      y += 6;

      if (comprasData.length > 0) {
        // Draw Pie/Donut Chart on in-memory Canvas
        const canvas = document.createElement("canvas");
        drawPieChartOnCanvas(canvas, comprasData);
        const chartDataURL = canvas.toDataURL("image/png");

        // Embed the chart in the PDF
        doc.addImage(chartDataURL, "PNG", mx + 2, y, 50, 50, "donut_chart", "NONE");

        // Render Legend Table
        const legendBody = comprasData.map((item) => {
          const pct = totalCompras > 0 ? (item.value / totalCompras) * 100 : 0;
          return [
            { content: "", styles: { fillColor: item.color } }, // Color square
            item.name,
            clp(item.value),
            `${pct.toFixed(1)}%`,
          ];
        });

        autoTable(doc, {
          startY: y,
          margin: { left: mx + 59, right: mx },
          tableWidth: W - mx * 2 - 59,
          head: [["", "Tipo Costo", "Monto", "Porcentaje"]],
          body: legendBody,
          theme: "plain",
          styles: {
            font: "helvetica",
            fontSize: 8.5,
            textColor: colorsPalette.text,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          },
          columnStyles: {
            0: { cellWidth: 5 }, // Square color
            1: { cellWidth: 55, fontStyle: "bold" },
            2: { cellWidth: 35, halign: "right" },
            3: { cellWidth: 25, halign: "right" },
          },
          didParseCell: (data) => {
            if (data.section === "head") {
              data.cell.styles.lineWidth = { bottom: 0.2 };
              data.cell.styles.lineColor = colorsPalette.line;
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [31, 41, 51];
              data.cell.styles.fillColor = [255, 255, 255];
            } else {
              if (data.column.index === 0) {
                // Keep the color circle/square filled
              } else {
                data.cell.styles.fillColor = colorsPalette.tableGray;
              }
            }
          },
        });

        y = Math.max(y + 52, doc.lastAutoTable.finalY + 8);

        // Draw Pareto Chart for this Costing
        let paretoDataURL = null;
        try {
          const canvasP = document.createElement("canvas");
          drawParetoChartOnCanvas(canvasP, comprasData);
          paretoDataURL = canvasP.toDataURL("image/png");
        } catch (e) {
          console.error("Error generating Pareto canvas:", e);
        }

        if (paretoDataURL && comprasData.length > 0) {
          if (y + 60 > H - 42) {
            doc.addPage();
            y = 50;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(...colorsPalette.blueDark);
          doc.text("Análisis de Pareto: Distribución y Acumulación del Costo", mx + 2, y + 4);
          doc.addImage(paretoDataURL, "PNG", mx + 2, y + 6, W - mx * 2 - 4, 47, "costeo_pareto_chart", "NONE");
          y += 59;
        }
      } else {
        doc.setFillColor(243, 244, 246);
        doc.roundedRect(mx, y, W - mx * 2, 14, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text("Este costeo no contiene costos registrados.", mx + 4, y + 8.5);
        y += 20;
      }

      // ==========================================
      // DETAILS TABLE
      // ==========================================
      if (y + 35 > H - 42) {
        doc.addPage();
        y = 50;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("Desglose Detallado de Costos y Ventas", mx, y);
      y += 6;

      const itemsBody = (venta.detalles || []).map((d) => {
        const itemDesc = d.descripcion || "Item";
        const cant = Number(d.cantidad || 0);
        const modeLabel = d.modo === "HH" ? "Horas Hombre" : (d.tipoItem?.nombre || "Compra");
        const cUnit = Number(d.costoUnitario || d.costoTotal / (cant || 1) || 0);
        const cTotal = Number(d.costoTotal || 0);
        const vTotal = Number(d.ventaTotal || 0);
        const margin = vTotal > 0 ? ((vTotal - cTotal) / vTotal) * 100 : 0;

        return [
          itemDesc,
          modeLabel,
          { content: String(cant), styles: { halign: "right" } },
          clp(cUnit),
          clp(cTotal),
          clp(vTotal),
          `${margin.toFixed(0)}%`,
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: mx, right: mx, top: 48, bottom: 42 },
        tableWidth: W - mx * 2,
        head: [["Descripción", "Tipo / Modo", "Cant.", "Costo U.", "Costo T.", "Venta T.", "Margen"]],
        body: itemsBody,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 8.0,
          textColor: colorsPalette.text,
          cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 32 },
          2: { cellWidth: 12, halign: "right" },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 14, halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "head") {
            data.cell.styles.lineWidth = { bottom: 0.25 };
            data.cell.styles.lineColor = colorsPalette.line;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [31, 41, 51];
            data.cell.styles.fillColor = [255, 255, 255];
          } else {
            data.cell.styles.fillColor = colorsPalette.tableGray;
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

      const fileName = `Reporte_Costeo_C${numDoc}_${safeName(venta.descripcion || "costeo")}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar el PDF: " + (err.message || String(err)));
    } finally {
      setBusy(false);
    }
  };

  if (!open || !venta) return null;

  // General KPIs inside modal
  const totalCosto = Number(venta.costoFinal ?? venta.costoBase ?? 0);
  const totalVenta = Number(venta.totalFinal ?? venta.totalBase ?? 0);
  const utilidad = totalVenta - totalCosto;
  const margenProm = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;

  return (
    <ModalBase open={open} onClose={onClose} title="" hideHeader={true}>
      {/* Dynamic font stylesheet */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div style={{ fontFamily: "'Outfit', sans-serif" }} className="flex flex-col text-slate-800">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-t-2xl gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-400 bg-indigo-500/10 p-2.5 rounded-xl text-3xl">
              bar_chart_4_bars
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Reporte de Costeo #C{(venta.numero || 0).toString().padStart(5, "0")}
              </h1>
              <p className="text-slate-400 text-xs mt-0.5 max-w-lg truncate">
                Proyecto: {venta.descripcion || "Sin descripción"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={busy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/80 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Generando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">download</span>
                  Descargar PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="Cerrar modal"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Modal content body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 bg-slate-50/50 flex flex-col gap-6">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Associated Quotation Card */}
            <div className="lg:col-span-2 p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">
                    handshake
                  </span>
                  <span className="font-bold text-sm text-slate-900">Cotización Asociada</span>
                </div>
                {venta.ordenVenta ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                    {venta.ordenVenta.estado || "Aceptada"}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>

              {venta.ordenVenta ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Número Cotización
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      COT #{venta.ordenVenta.numero}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Cliente
                    </span>
                    <span className="font-medium text-slate-700">
                      {venta.ordenVenta.cliente?.nombre || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Proyecto ERP
                    </span>
                    <span className="font-medium text-slate-700">
                      {venta.ordenVenta.proyecto?.nombre || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Monto Cotizado (Venta)
                    </span>
                    <span className="font-bold text-indigo-600">
                      {clp(venta.ordenVenta.total)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <span className="material-symbols-outlined text-amber-500 text-3xl mb-1">
                    warning_amber
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    No hay cotización asociada a este costeo.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Puedes vincular o crear una cotización para este costeo desde la lista.
                  </p>
                </div>
              )}
            </div>

            {/* General Info Card */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between text-xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                <span className="material-symbols-outlined text-indigo-600 text-xl">
                  calendar_today
                </span>
                <span className="font-bold text-sm text-slate-900">Datos Generales</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Feriado/Festivo:</span>
                  <span className={`font-bold ${venta.isFeriado ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded" : "text-slate-500 bg-slate-100 px-2 py-0.5 rounded"}`}>
                    {venta.isFeriado ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Urgencia:</span>
                  <span className={`font-bold ${venta.isUrgencia ? "text-red-600 bg-red-50 px-2 py-0.5 rounded" : "text-slate-500 bg-slate-100 px-2 py-0.5 rounded"}`}>
                    {venta.isUrgencia ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Fecha Registro:</span>
                  <span className="font-bold text-slate-700">{fmtDate(venta.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Venta Proyectada
              </span>
              <span className="text-base font-bold text-emerald-950 mt-1 block">
                {clp(totalVenta)}
              </span>
            </div>

            <div className="p-4 bg-red-50/60 border border-red-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                Costo Proyectado
              </span>
              <span className="text-base font-bold text-red-950 mt-1 block">
                {clp(totalCosto)}
              </span>
            </div>

            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                Utilidad Estimada
              </span>
              <span className="text-base font-bold text-indigo-950 mt-1 block">
                {clp(utilidad)}
              </span>
            </div>

            <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                Margen Promedio
              </span>
              <span className="text-base font-bold text-purple-950 mt-1 block">
                {margenProm.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Pie Chart / Cost breakdown */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Distribución del Costo Total
            </h2>

            {comprasData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* SVG Donut render */}
                <div className="flex justify-center py-4">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg width="180" height="180" viewBox="0 0 120 120" className="transform -rotate-90">
                      {/* Grey background circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r={r}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="10"
                      />
                      {donutChart.map((item, idx) => (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r={r}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="10"
                          strokeDasharray={item.strokeDasharray}
                          strokeDashoffset={item.strokeDashoffset}
                          className="transition-all duration-500 ease-out"
                        />
                      ))}
                    </svg>

                    {/* Center stats */}
                    <div className="absolute flex flex-col items-center justify-center bg-white rounded-full w-32 h-32 shadow-inner border border-slate-100/50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Costo
                      </span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5">
                        {clp(totalCompras)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase List & Legend */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                    <span className="col-span-2">Tipo de Costo</span>
                    <span className="text-right">Monto (CLP)</span>
                    <span className="text-right">Porcentaje</span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {donutChart.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-4 items-center text-xs text-slate-700 py-1 border-b border-slate-50 last:border-0">
                        <div className="col-span-2 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full block shrink-0"
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                        </div>
                        <span className="text-right font-medium text-slate-600">{clp(item.value)}</span>
                        <span className="text-right font-bold text-slate-900">{item.percent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                  payments
                </span>
                <p className="text-xs font-semibold text-slate-500">No hay costos registrados para este costeo.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Agrega ítems de Horas Hombre o Compras/Insumos.</p>
              </div>
            )}
          </div>

          {/* Details breakdown table */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Detalle por Ítem
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[9px]">
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Tipo / Modo</th>
                    <th className="p-3 text-right">Cant.</th>
                    <th className="p-3 text-right">Costo Unit.</th>
                    <th className="p-3 text-right">Costo Total</th>
                    <th className="p-3 text-right">Venta Total</th>
                    <th className="p-3 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {venta.detalles && venta.detalles.length > 0 ? (
                    venta.detalles.map((d, index) => {
                      const cUnit = Number(d.costoUnitario || d.costoTotal / (d.cantidad || 1) || 0);
                      const cTotal = Number(d.costoTotal || 0);
                      const vTotal = Number(d.ventaTotal || 0);
                      const lineMargin = vTotal > 0 ? ((vTotal - cTotal) / vTotal) * 100 : 0;

                      return (
                        <tr key={index} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-medium text-slate-900 max-w-xs truncate" title={d.descripcion}>
                            {d.descripcion}
                          </td>
                          <td className="p-3">
                            {d.modo === "HH" ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                Horas Hombre
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                {d.tipoItem?.nombre || "Compra"}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-800">{d.cantidad}</td>
                          <td className="p-3 text-right text-slate-500">{clp(cUnit)}</td>
                          <td className="p-3 text-right font-semibold text-slate-900">{clp(cTotal)}</td>
                          <td className="p-3 text-right font-bold text-indigo-600">{clp(vTotal)}</td>
                          <td className="p-3 text-right">
                            <span className={`font-bold ${lineMargin >= 30 ? "text-emerald-600" : lineMargin >= 10 ? "text-amber-500" : "text-red-500"}`}>
                              {lineMargin.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-slate-400 italic">
                        Este costeo no tiene ítems de detalle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </ModalBase>
  );
}
