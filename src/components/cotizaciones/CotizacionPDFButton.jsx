"use client";

import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

export default function CotizacionPDFButton({ cotizacion }) {
  const [busy, setBusy] = useState(false);
  if (!cotizacion) return null;

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

  const loadImageDataURL = async (src) => {
    const res = await fetch(src, { cache: "force-cache" });
    if (!res.ok) throw new Error(`No se pudo cargar imagen: ${src}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };

  const generarPDF = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy) return;

    try {
      setBusy(true);

      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod?.default || autoTableMod;

      // ✅ Letter exacto como tu PDF wkhtmltopdf: 216 × 279 mm
      const W = 216;
      const H = 279;
      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [W, H],
      });

      const mx = 14;

      const C = {
        blue: [21, 101, 192],
        lightBlue: [227, 242, 253],
        bar: [238, 246, 252],
        text: [25, 25, 25],
        muted: [100, 100, 100],
        line: [220, 224, 230],
        white: [255, 255, 255],
      };

      const numero =
        cotizacion?.numero != null ? String(cotizacion.numero) : safe(cotizacion?.id);
      const numDoc = numero ? `S${numero.padStart(5, "0")}` : "S00000";

      // ===== Logo (cacheado) =====
      let logo = null;
      try {
        logo = await loadImageDataURL("/Logo_blue.png");
      } catch {
        logo = null;
      }

      /**
       * ✅ Wave “real” tipo wkhtmltopdf
       * - Pintamos banda celeste completa
       * - Luego “recortamos” el borde con blanco (fondo)
       */
      const drawWaveBand = (yTop, height, invert = false) => {
        // 1) Banda completa
        doc.setFillColor(...C.lightBlue);
        doc.rect(0, yTop, W, height, "F");

        // 2) Wave (recorte blanco)
        const amp = 6.5; // un pelín más notorio
        const steps = 90;

        // La curva vive cerca del borde:
        // Header: recortamos desde la curva hacia ABAJO (borde inferior)
        // Footer: recortamos desde la curva hacia ARRIBA (borde superior)
        const yEdge = invert ? yTop : yTop + height;

        const points = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = t * W;

          // curva suave tipo “panza” (como tu PDF)
          // (una sola onda, 0..PI)
          const yCurve = yEdge - amp * Math.sin(t * Math.PI);

          points.push([x, yCurve]);
        }

        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.white);
        doc.setLineWidth(0);

        if (!invert) {
          // HEADER: recortar (blanco) desde el borde inferior hacia la curva
          for (let i = 0; i < points.length - 1; i++) {
            const [x1, y1] = points[i];
            const [x2, y2] = points[i + 1];
            doc.triangle(x1, yTop + height, x2, yTop + height, x1, y1, "F");
            doc.triangle(x2, yTop + height, x2, y2, x1, y1, "F");
          }
        } else {
          // FOOTER: recortar (blanco) desde el borde superior hacia la curva
          for (let i = 0; i < points.length - 1; i++) {
            const [x1, y1] = points[i];
            const [x2, y2] = points[i + 1];
            doc.triangle(x1, yTop, x2, yTop, x1, y1, "F");
            doc.triangle(x2, yTop, x2, y2, x1, y1, "F");
          }
        }
      };

      // ===== Header / Footer por página =====
      const HEADER_H = 28;
      const FOOTER_H = 18;

      const drawHeader = () => {
        drawWaveBand(0, HEADER_H, false);

        if (logo) doc.addImage(logo, "PNG", mx, 6.0, 44, 13.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.muted);
        doc.text("Tecnología que impulsa, soluciones que transforman", mx, 22.5);

        doc.setFontSize(8.2);
        doc.setTextColor(...C.text);
        const rx = W - mx;
        const ty = 7.8;
        [
          "Punta Arenas",
          "Capitán Juan Guillermo 02233",
          "Puerto Montt",
          "Av. San Agustín S/N, La Paloma PC #38",
          "RUT 78115957-3",
        ].forEach((t, i) => doc.text(t, rx, ty + i * 3.7, { align: "right" }));
      };

      const drawFooter = (page, pages) => {
        drawWaveBand(H - FOOTER_H, FOOTER_H, true);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.text);
        doc.text("administracion@blueinge.com", W / 2, H - 10.0, { align: "center" });

        doc.setTextColor(...C.blue);
        doc.text("https://blue-ingenieria.com/", W / 2, H - 6.0, { align: "center" });

        doc.setTextColor(...C.muted);
        doc.setFontSize(7.4);
        doc.text(`Página ${page} / ${pages}`, W / 2, H - 2.7, { align: "center" });
      };

      // ===== Página 1 temporal =====
      drawHeader();
      drawFooter(1, 1);

      // ===== Cliente (izq) =====
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      doc.text(safe(cotizacion?.cliente?.nombre) || "Cliente", mx, 42);
      doc.setFontSize(8.3);
      doc.setTextColor(...C.muted);
      doc.text(safe(cotizacion?.cliente?.direccion) || "Chile", mx, 46);

      // ===== Título =====
      doc.setFont("helvetica", "normal");
      doc.setFontSize(18);
      doc.setTextColor(...C.blue);
      doc.text(`Número de orden ${numDoc}`, mx, 58);

      // ===== Barra info =====
      const barY = 62;
      doc.setFillColor(...C.bar);
      doc.roundedRect(mx, barY, W - mx * 2, 12, 2.5, 2.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...C.blue);
      doc.text("Fecha de la orden", mx + 4, barY + 5);
      doc.text("Vendedor", mx + 92, barY + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(...C.text);
      doc.text(fmtDate(cotizacion?.creada_en), mx + 4, barY + 10);
      doc.text(safe(cotizacion?.vendedor) || "-", mx + 92, barY + 10);

      // ===== Tabla (sutil) =====
      const items = Array.isArray(cotizacion?.items) ? cotizacion.items : [];

      const body = items.length
        ? items.map((it) => {
            const nombre =
              it.tipo === "PRODUCTO"
                ? safe(it.producto?.nombre) || "Producto"
                : safe(it.Item) || "Servicio";

            const extra = safe(it.descripcion);
            const desc = extra ? `${nombre}\n${extra}` : nombre;

            const cantidad = Number(it.cantidad ?? 0);
            const unidad = safe(it.unidad || it.unidades || "");
            const cantidadTxt = unidad ? `${cantidad} ${unidad}` : `${cantidad}`;

            const pu = Number(it.precioUnitario ?? 0);
            const total = Number(it.total ?? 0);

            return [desc, cantidadTxt, clp(pu), "IVA 19% Vta", clp(total)];
          })
        : [["Esta cotización no tiene ítems.", "", "", "", ""]];

      autoTable(doc, {
        startY: 82,
        margin: { left: mx, right: mx, top: HEADER_H, bottom: FOOTER_H + 2 },
        head: [["Descripción", "Cantidad", "Precio unitario", "Impuestos", "Importe"]],
        body,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.2,
          textColor: C.text,
          cellPadding: { top: 2.4, right: 2.2, bottom: 2.4, left: 2.2 },
          valign: "top",
        },
        headStyles: { fontStyle: "normal", textColor: C.text },
        columnStyles: {
          0: { cellWidth: 92 },
          1: { cellWidth: 30, halign: "right" },
          2: { cellWidth: 32, halign: "right" },
          3: { cellWidth: 28, halign: "right" },
          4: { cellWidth: 20, halign: "right" },
        },
        didParseCell: (data) => {
          data.cell.styles.lineWidth = 0.18;
          data.cell.styles.lineColor = C.line;
          if (data.section === "head") data.cell.styles.lineWidth = 0.25;
        },
      });

      // ===== Totales =====
      let y = (doc.lastAutoTable?.finalY ?? 160) + 6;

      autoTable(doc, {
        startY: y,
        margin: { left: W - mx - 84, right: mx },
        tableWidth: 84,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.4,
          cellPadding: { top: 2.6, right: 2.6, bottom: 2.6, left: 2.6 },
          textColor: C.text,
        },
        body: [
          ["Subtotal", clp(cotizacion?.subtotal)],
          ["IVA 19%", clp(cotizacion?.iva)],
          ["Total", clp(cotizacion?.total)],
        ],
        columnStyles: {
          0: { cellWidth: 44, halign: "left", textColor: C.muted },
          1: { cellWidth: 40, halign: "right" },
        },
        didParseCell: (data) => {
          data.cell.styles.lineWidth = 0.18;
          data.cell.styles.lineColor = C.line;
          if (data.row.index === 2) {
            data.cell.styles.fontStyle = "bold";
            if (data.column.index === 0) data.cell.styles.textColor = C.blue;
          }
        },
      });

      // ===== Bloques inferiores =====
      const blocksStartY = (doc.lastAutoTable?.finalY ?? y) + 10;
      let yy = blocksStartY;

      const bottomLimit = H - (FOOTER_H + 8);

      const addBlock = (title, text) => {
        const t = safe(text);
        if (!t) return;

        if (yy + 22 > bottomLimit) {
          doc.addPage();
          yy = HEADER_H + 18;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(title, mx, yy);
        yy += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.text);

        const lines = doc.splitTextToSize(t, W - mx * 2);
        if (yy + lines.length * 4.1 + 4 > bottomLimit) {
          doc.addPage();
          yy = HEADER_H + 18;
        }

        doc.text(lines, mx, yy);
        yy += lines.length * 4.1 + 6;
      };

      addBlock("Descripción", cotizacion?.descripcion);
      addBlock("Términos y condiciones", cotizacion?.terminos_condiciones);
      addBlock("Acuerdo de pago", cotizacion?.acuerdo_pago);

      // ===== Redibujar header/footer con pageCount real =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        drawHeader();
        drawFooter(p, pageCount);
      }

      const fileName = `Orden_${numDoc}_${safeName(
        cotizacion?.cliente?.nombre || cotizacion?.proyecto?.nombre || "cotizacion"
      )}.pdf`;

      doc.save(fileName);
    } catch (err) {
      console.error("❌ Error generando PDF:", err);
      alert(err?.message || "Error generando PDF (revisa consola)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={busy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
      onClick={generarPDF}
      disabled={busy}
      sx={{
        borderRadius: 2,
        textTransform: "none",
        fontWeight: 800,
        px: 1.25,
        minWidth: 92,
      }}
    >
      {busy ? "Generando..." : "PDF"}
    </Button>
  );
}
