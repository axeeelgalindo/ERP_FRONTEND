"use client";

import React, { useMemo, useState } from "react";
import ModalBase from "@/components/compras/ModalBase";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export default function ReporteCotizacionesModal({ open, onClose, cotizaciones, session }) {
  const [busy, setBusy] = useState(false);

  // 1. Torta de Conversión (Total de cotizaciones)
  const conversionData = useMemo(() => {
    const list = cotizaciones || [];
    let aceptadas = 0;
    let rechazadas = 0;
    let pendientes = 0;

    const ACEPTADOS_ESTADOS = [
      "ACEPTADA",
      "ORDEN_VENTA",
      "ENTREGADO",
      "POR_FACTURAR",
      "FACTURADA",
      "PAGADA",
    ];

    list.forEach((c) => {
      if (ACEPTADOS_ESTADOS.includes(c.estado)) {
        aceptadas++;
      } else if (c.estado === "RECHAZADA") {
        rechazadas++;
      } else {
        pendientes++;
      }
    });

    return [
      { name: "Aceptadas / En Proceso", value: aceptadas, color: "#3b82f6" }, // Corporate Blue
      { name: "Pendientes / En Cotización", value: pendientes, color: "#64748b" }, // Slate
      { name: "Rechazadas", value: rechazadas, color: "#ef4444" }, // Red
    ];
  }, [cotizaciones]);

  const totalCotizaciones = useMemo(() => {
    return conversionData.reduce((sum, item) => sum + item.value, 0);
  }, [conversionData]);

  // 2. Torta de Progreso (Solo Aceptadas)
  const progresoData = useMemo(() => {
    const list = cotizaciones || [];
    let soloAceptadas = 0;
    let conOC = 0;
    let conHES = 0;
    let facturadas = 0;
    let pagadas = 0;

    list.forEach((c) => {
      if (c.estado === "ACEPTADA") {
        soloAceptadas++;
      } else if (c.estado === "ORDEN_VENTA" || c.estado === "ENTREGADO") {
        conOC++;
      } else if (c.estado === "POR_FACTURAR") {
        conHES++;
      } else if (c.estado === "FACTURADA") {
        facturadas++;
      } else if (c.estado === "PAGADA") {
        pagadas++;
      }
    });

    return [
      { name: "Aceptada (Pendiente OC)", value: soloAceptadas, color: "#93c5fd" }, // Light Blue
      { name: "Con Orden de Compra (OC)", value: conOC, color: "#3b82f6" }, // Medium Blue
      { name: "Con HES (Por Facturar)", value: conHES, color: "#f59e0b" }, // Amber
      { name: "Facturadas", value: facturadas, color: "#6366f1" }, // Indigo
      { name: "Pagadas", value: pagadas, color: "#10b981" }, // Emerald
    ];
  }, [cotizaciones]);

  const totalAceptadas = useMemo(() => {
    return progresoData.reduce((sum, item) => sum + item.value, 0);
  }, [progresoData]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const list = cotizaciones || [];
    let totalMontoCotizado = 0;
    let totalMontoAceptado = 0;
    let totalMontoFacturado = 0;
    let totalMontoPagado = 0;

    list.forEach((c) => {
      const total = Number(c.total || 0);
      totalMontoCotizado += total;

      if (c.estado !== "COTIZACION" && c.estado !== "RECHAZADA") {
        totalMontoAceptado += total;
      }
      if (c.estado === "FACTURADA") {
        totalMontoFacturado += total;
      }
      if (c.estado === "PAGADA") {
        totalMontoFacturado += total;
        totalMontoPagado += total;
      }
    });

    const conversionRate = totalCotizaciones > 0 ? (totalAceptadas / totalCotizaciones) * 100 : 0;

    return {
      totalMontoCotizado,
      totalMontoAceptado,
      totalMontoFacturado,
      totalMontoPagado,
      conversionRate,
    };
  }, [cotizaciones, totalCotizaciones, totalAceptadas]);

  // SVG Helper
  const r = 50;
  const C = 2 * Math.PI * r;

  const getDonutSegments = (data, total) => {
    let accumulatedAngle = 0;
    return data.map((item) => {
      const pct = total > 0 ? item.value / total : 0;
      const strokeDasharray = `${pct * C} ${C}`;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += pct * C;
      return {
        ...item,
        percent: pct * 100,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  };

  const donutConversion = useMemo(() => {
    return getDonutSegments(conversionData, totalCotizaciones);
  }, [conversionData, totalCotizaciones]);

  const donutProgreso = useMemo(() => {
    return getDonutSegments(progresoData, totalAceptadas);
  }, [progresoData, totalAceptadas]);

  // Canvas drawing for PDF (high-res)
  const drawPieChartOnCanvas = (canvas, data) => {
    const ctx = canvas.getContext("2d");
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

    let startAngle = -0.5 * Math.PI;
    data.forEach((item) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();

      const middleAngle = startAngle + sliceAngle / 2;
      const pct = (item.value / total) * 100;
      if (pct > 5) {
        const labelX = centerX + Math.cos(middleAngle) * (radius * 0.72);
        const labelY = centerY + Math.sin(middleAngle) * (radius * 0.72);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillText(`${pct.toFixed(0)}%`, labelX, labelY);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.55, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  };

  const handleExportPDF = async () => {
    try {
      setBusy(true);

      // 1. Load Logo
      let logo = null;
      let logoW = 36;
      let logoH = 14;
      let logoY = 14;

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
            const maxRatio = 36 / 14;
            if (ratio > maxRatio) {
              logoW = 36;
              logoH = 36 / ratio;
            } else {
              logoH = 14;
              logoW = 14 * ratio;
            }
            logoY = 14 + (14 - logoH) / 2;
          }
        }
      } catch (e) {
        console.error("Failed to load logo in PDF:", e);
      }

      // 2. Initialize jsPDF & autoTable
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod?.default || autoTableMod;

      const W = 210;
      const H = 297;
      const mx = 12;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      // Colors Palette
      const colorsPalette = {
        blue: [11, 95, 137], // #0b5f89
        blueDark: [23, 71, 102], // #174766
        blueSoft: [235, 243, 248], // #ebf3f8
        blueSoft2: [235, 243, 248],
        text: [38, 51, 63], // #26333f
        muted: [107, 114, 128], // #6b7280
        tableGray: [240, 242, 245], // #f0f2f5
        line: [184, 192, 200], // #b8c0c8
      };

      // Header Helper (Wavy Corporate Blue Design)
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
          doc.setFontSize(18);
          doc.setTextColor(...colorsPalette.blue);
          doc.text("BLUE", mx, 22);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...colorsPalette.blueDark);
          doc.text("Ingeniería SPA", mx, 26);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(38, 56, 69);
        doc.text(empNombre, W - mx, 14, { align: "right" });
        doc.text(empRut, W - mx, 18, { align: "right" });
        doc.text(empCorreo, W - mx, 22, { align: "right" });
        doc.text("Gestión y Control de Ventas", W - mx, 26, { align: "right" });
      };

      // Footer Helper (Wavy Corporate Blue Design)
      const drawFooter = (page, pages) => {
        doc.setPage(page);
        doc.setFillColor(...colorsPalette.blueSoft2);
        doc.moveTo(0, 264);
        doc.curveTo(35, 266, 70, 260, 105, 262);
        doc.curveTo(140, 264, 175, 267, 210, 265);
        doc.lineTo(210, 279);
        doc.lineTo(0, 279);
        doc.close();
        doc.fill();

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(38, 51, 63);
        doc.text(empCorreo, W / 2, 271, { align: "center" });

        doc.setTextColor(140, 153, 163);
        doc.setFontSize(7.5);
        doc.text(`Página ${page} / ${pages}`, W / 2, 276, { align: "center" });
      };

      // Draw Page 1
      drawHeader();
      let y = 48;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(...colorsPalette.blue);
      doc.text("Reporte de Análisis de Cotizaciones", mx, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...colorsPalette.text);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-CL")}`, mx, y);
      y += 10;

      // Financial KPIs (Stats Blocks)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("RESUMEN DE INDICADORES CLAVE", mx, y);
      y += 4;
      doc.setLineWidth(0.3);
      doc.setDrawColor(...colorsPalette.blue);
      doc.line(mx, y, W - mx, y);
      y += 6;

      const colW = (W - mx * 2 - 6) / 4;
      const kpiBlockY = y;

      const drawStatCard = (title, val, x, bg) => {
        doc.setFillColor(...bg);
        doc.rect(x, kpiBlockY, colW, 18, "F");
        doc.setDrawColor(...colorsPalette.line);
        doc.rect(x, kpiBlockY, colW, 18, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(80, 95, 110);
        doc.text(title.toUpperCase(), x + 4, kpiBlockY + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(val, x + 4, kpiBlockY + 13);
      };

      drawStatCard("Total Cotizadas", String(totalCotizaciones), mx, [248, 250, 252]);
      drawStatCard("Monto Cotizado", clp(kpis.totalMontoCotizado), mx + colW + 2, [239, 246, 255]);
      drawStatCard("Tasa Conversión", `${kpis.conversionRate.toFixed(1)}%`, mx + (colW * 2) + 4, [240, 253, 244]);
      drawStatCard("Monto Aceptado", clp(kpis.totalMontoAceptado), mx + (colW * 3) + 6, [243, 244, 246]);

      y += 28;

      // 1. Tasa de Conversión Donut
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("1. CONVERSIÓN GENERAL DE COTIZACIONES", mx, y);
      y += 4;
      doc.line(mx, y, W - mx, y);
      y += 6;

      const canvas1 = document.createElement("canvas");
      drawPieChartOnCanvas(canvas1, conversionData);
      const chart1Img = canvas1.toDataURL("image/png");

      doc.addImage(chart1Img, "PNG", mx + 10, y, 46, 46, undefined, "NONE");

      let legendY = y + 10;
      conversionData.forEach((item) => {
        const hex = item.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        doc.setFillColor(r, g, b);
        doc.rect(mx + 80, legendY - 3, 4, 4, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        const share = totalCotizaciones > 0 ? (item.value / totalCotizaciones) * 100 : 0;
        doc.text(`${item.name}: ${item.value} (${share.toFixed(0)}%)`, mx + 88, legendY + 0.5);

        legendY += 10;
      });

      y += 56;

      // 2. Progreso de Aceptadas Donut
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colorsPalette.blueDark);
      doc.text("2. PROGRESO Y FLUJO DE COTIZACIONES ACEPTADAS", mx, y);
      y += 4;
      doc.line(mx, y, W - mx, y);
      y += 6;

      const canvas2 = document.createElement("canvas");
      drawPieChartOnCanvas(canvas2, progresoData);
      const chart2Img = canvas2.toDataURL("image/png");

      doc.addImage(chart2Img, "PNG", mx + 10, y, 46, 46, undefined, "NONE");

      legendY = y + 6;
      progresoData.forEach((item) => {
        const hex = item.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        doc.setFillColor(r, g, b);
        doc.rect(mx + 80, legendY - 3, 4, 4, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        const share = totalAceptadas > 0 ? (item.value / totalAceptadas) * 100 : 0;
        doc.text(`${item.name}: ${item.value} (${share.toFixed(0)}%)`, mx + 88, legendY + 0.5);

        legendY += 9;
      });

      // Add Page 2 (Details Table)
      doc.addPage();
      drawHeader();
      y = 48;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorsPalette.blue);
      doc.text("LISTADO DE COTIZACIONES EVALUADAS", mx, y);
      y += 4;
      doc.line(mx, y, W - mx, y);
      y += 4;

      const tableRows = (cotizaciones || []).map((c) => [
        String(c.numero || "-"),
        c.asunto || c.descripcion || "-",
        c.cliente?.nombre || "-",
        fmtDate(c.creada_en),
        String(c.estado || "-"),
        clp(c.total),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Nº", "Asunto", "Cliente", "Fecha", "Estado", "Monto"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: colorsPalette.blue,
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: "bold",
          halign: "left",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 22 },
          4: { cellWidth: 25 },
          5: { cellWidth: 26, halign: "right" },
        },
        margin: { left: mx, right: mx },
      });

      // Page numbering footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        drawFooter(p, pageCount);
      }

      const fileName = `Reporte_Analisis_Cotizaciones_${safeName(empNombre)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar reporte PDF: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <ModalBase open={open} onClose={onClose} title="" hideHeader={true}>
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
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white rounded-t-2xl gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 bg-blue-500/10 p-2.5 rounded-xl text-3xl">
              bar_chart_4_bars
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Análisis de Cotizaciones y Conversión
              </h1>
              <p className="text-slate-400 text-xs mt-0.5 max-w-lg">
                Reporte corporativo de tasas de aceptación, rechazo y progreso de flujo comercial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/80 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-950/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {busy ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Generando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">download</span>
                  Descargar Reporte PDF
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
        <div className="max-h-[75vh] overflow-y-auto p-6 bg-slate-50/50 flex flex-col gap-6">
          {/* Financial Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Cotizadas
              </span>
              <span className="text-base font-bold text-slate-800 mt-1 block">
                {totalCotizaciones}
              </span>
            </div>

            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                Monto Cotizado
              </span>
              <span className="text-base font-bold text-blue-900 mt-1 block">
                {clp(kpis.totalMontoCotizado)}
              </span>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Tasa de Conversión
              </span>
              <span className="text-base font-bold text-emerald-900 mt-1 block">
                {kpis.conversionRate.toFixed(1)}%
              </span>
            </div>

            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                Monto Aceptado
              </span>
              <span className="text-base font-bold text-indigo-900 mt-1 block">
                {clp(kpis.totalMontoAceptado)}
              </span>
            </div>
          </div>

          {/* SVG Pie/Donut Charts (Stacked rows) */}
          <div className="grid grid-cols-1 gap-6">
            
            {/* Chart 1: Conversión */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                1. Tasa de Conversión (Cotizadas vs Aceptadas)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center py-2">
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg width="150" height="150" viewBox="0 0 120 120" className="transform -rotate-90">
                      <circle cx="60" cy="60" r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      {donutConversion.map((item, idx) => (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r={r}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="12"
                          strokeDasharray={item.strokeDasharray}
                          strokeDashoffset={item.strokeDashoffset}
                          className="transition-all duration-500 ease-out"
                        />
                      ))}
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center bg-white rounded-full w-24 h-24 shadow-inner border border-slate-100/50">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Cotizaciones
                      </span>
                      <span className="text-lg font-bold text-slate-800 mt-0.5">
                        {totalCotizaciones}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {donutConversion.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">{item.value}</span>
                        <span className="text-[10px] text-slate-400 font-medium ml-1.5">({item.percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 2: Progreso de Aceptadas */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                2. Flujo de Progreso (Sobre Aceptadas)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center py-2">
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg width="150" height="150" viewBox="0 0 120 120" className="transform -rotate-90">
                      <circle cx="60" cy="60" r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      {donutProgreso.map((item, idx) => (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r={r}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="12"
                          strokeDasharray={item.strokeDasharray}
                          strokeDashoffset={item.strokeDashoffset}
                          className="transition-all duration-500 ease-out"
                        />
                      ))}
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center bg-white rounded-full w-24 h-24 shadow-inner border border-slate-100/50">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Aceptadas
                      </span>
                      <span className="text-lg font-bold text-slate-800 mt-0.5">
                        {totalAceptadas}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {donutProgreso.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">{item.value}</span>
                        <span className="text-[10px] text-slate-400 font-medium ml-1.5">({item.percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </ModalBase>
  );
}
