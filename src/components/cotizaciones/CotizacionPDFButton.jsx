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

      // ✅ Hoja “menos larga y un poco más ancha”
      const W = 226;
      const H = 260;

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
        cotizacion?.numero != null
          ? String(cotizacion.numero)
          : safe(cotizacion?.id);

      const numDoc = numero ? `S${numero.padStart(5, "0")}` : "S00000";
      const docTitle = `Cotización ${numDoc}`;

      // ✅ vigencia (del model nuevo)
      const vigenciaDiasRaw =
        cotizacion?.vigencia_dias ??
        cotizacion?.vigenciaDias ??
        cotizacion?.dias_vigencia ??
        cotizacion?.diasVigencia ??
        null;

      const vigenciaDias =
        vigenciaDiasRaw == null || vigenciaDiasRaw === ""
          ? null
          : Math.trunc(Number(vigenciaDiasRaw));

      const vigenciaLabel =
        Number.isFinite(vigenciaDias) && vigenciaDias > 0
          ? `${vigenciaDias} días vigencia`
          : "";

      // ===== Logo =====
      let logo = null;
      try {
        logo = await loadImageDataURL("/Logo_blue.png");
      } catch {
        logo = null;
      }

      const HEADER_H = 26;
      const FOOTER_H = 16;

      // ===== Wave =====
      const drawWaveBand = (yTop, height, mode = "down") => {
        doc.setFillColor(...C.lightBlue);
        doc.rect(0, yTop, W, height, "F");

        doc.setFillColor(...C.white);

        if (mode === "down") {
          doc.path(
            [
              ["M", 0, yTop + height - 6],
              [
                "C",
                W * 0.25,
                yTop + height + 8,
                W * 0.75,
                yTop + height - 18,
                W,
                yTop + height - 6,
              ],
              ["L", W, yTop],
              ["L", 0, yTop],
              ["Z"],
            ],
            "F"
          );
        } else if (mode === "up") {
          doc.path(
            [
              ["M", 0, yTop + 6],
              ["C", W * 0.25, yTop - 8, W * 0.75, yTop + 18, W, yTop + 6],
              ["L", W, yTop + height],
              ["L", 0, yTop + height],
              ["Z"],
            ],
            "F"
          );
        }
      };

      // ===== Header =====
      const drawHeader = () => {
        drawWaveBand(0, HEADER_H, "down");

        if (logo) doc.addImage(logo, "PNG", mx, 6.0, 44, 13.5);

        doc.setFont("cambria", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.muted);
        doc.text(
          "Tecnología que impulsa, soluciones que transforman",
          mx,
          22.0
        );

        const boxW = 72;
        const boxX = W - mx - boxW;

        const topPad = 3.2;
        const bottomPad = 3.2;

        const direccionLines = [
          "Punta Arenas",
          "Capitán Juan Guillermo 02233",
          "Puerto Montt",
          "Av. San Agustín S/N, La Paloma PC #38",
          "RUT 78115957-3",
        ];

        let fontSize = 8.1;
        let lineH = 3.4;
        const boxPadY = 4.8;
        const boxPadX = 4;

        const maxBoxH = HEADER_H - topPad - bottomPad;

        for (let k = 0; k < 8; k++) {
          const testH = direccionLines.length * lineH + boxPadY;
          if (testH <= maxBoxH) break;
          fontSize -= 0.2;
          lineH -= 0.15;
        }

        const boxH = Math.min(direccionLines.length * lineH + boxPadY, maxBoxH);
        const boxY = topPad + (maxBoxH - boxH) / 2;

        doc.setFont("cambria", "normal");
        doc.setFontSize(fontSize);

        doc.setDrawColor(180, 210, 230);
        doc.setFillColor(...C.lightBlue);
        doc.roundedRect(boxX, boxY, boxW, boxH, 2.5, 2.5, "FD");

        doc.setTextColor(...C.text);
        const rx = boxX + boxW - boxPadX;
        const ty = boxY + boxPadY / 2 + (lineH - 0.6);

        direccionLines.forEach((t, i) => {
          const yy = ty + i * lineH;
          if (yy <= boxY + boxH - 1.2) {
            doc.text(String(t), rx, yy, { align: "right" });
          }
        });
      };

      // ===== Footer =====
      const drawFooter = (page, pages) => {
        drawWaveBand(H - FOOTER_H, FOOTER_H, "up");

        doc.setFont("cambria", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.text);
        doc.text("administracion@blueinge.com", W / 2, H - 9.3, {
          align: "center",
        });

        doc.setTextColor(...C.blue);
        doc.text("https://blue-ingenieria.com/", W / 2, H - 5.8, {
          align: "center",
        });

        doc.setTextColor(...C.muted);
        doc.setFontSize(7.2);
        doc.text(`Página ${page} / ${pages}`, W / 2, H - 2.4, {
          align: "center",
        });
      };

      // ===== Página 1 base =====
      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [W, H],
      });
      drawHeader();
      drawFooter(1, 1);

      // ===== Cliente =====
      const yCliente = 38;
      doc.setFont("cambria", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      const clienteLabel =
        safe(cotizacion?.cliente?.nombre) +
        (cotizacion?.cliente?.rut ? ` | ${safe(cotizacion?.cliente?.rut)}` : "");
      doc.text(clienteLabel || "Cliente", mx, yCliente);

      // ===== Título + vigencia =====
      const yTitle = 52;
      doc.setFont("cambria", "normal");
      doc.setFontSize(17.5);
      doc.setTextColor(...C.blue);
      doc.text(docTitle, mx, yTitle);

      if (vigenciaLabel) {
        doc.setFont("cambria", "bold");
        doc.setFontSize(9.2);
        doc.setTextColor(...C.muted);
        doc.text(vigenciaLabel, W - mx, yTitle, { align: "right" });
      }

      // ===== Asunto uppercase =====
      const asuntoText = safe(cotizacion?.asunto || cotizacion?.descripcion);
      const asuntoUpper = asuntoText ? String(asuntoText).toUpperCase() : "";

      if (asuntoUpper) {
        doc.setFont("cambria", "bold");
        doc.setFontSize(8.4);
        doc.setTextColor(...C.muted);
        doc.text("ASUNTO", mx, yTitle + 6);

        doc.setFont("cambria", "normal");
        doc.setFontSize(9.2);
        doc.setTextColor(...C.text);

        const asuntoLines = doc.splitTextToSize(asuntoUpper, W - mx * 2);
        doc.text(asuntoLines, mx, yTitle + 10);
      }

      // ===== Barra info =====
      const barY = asuntoText ? yTitle + 14.5 : yTitle + 8.5;

      doc.setFillColor(...C.bar);
      doc.roundedRect(mx, barY, W - mx * 2, 12, 2.5, 2.5, "F");

      // ✅ 3 columnas: Fecha | Vencimiento | Vendedor
      doc.setFont("cambria", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...C.blue);
      doc.text("Fecha", mx + 4, barY + 5);
      doc.text("Vencimiento", mx + 58, barY + 5);
      doc.text("Vendedor", mx + 128, barY + 5);

      const vendedorNombre =
        safe(cotizacion?.vendedor?.nombre) ||
        safe(cotizacion?.vendedor?.correo) ||
        safe(cotizacion?.vendedor) ||
        "-";

      doc.setFont("cambria", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(...C.text);
      doc.text(fmtDate(cotizacion?.fecha_documento), mx + 4, barY + 10);
      doc.text(fmtDate(cotizacion?.vencimiento_documento), mx + 58, barY + 10);
      doc.text(vendedorNombre, mx + 128, barY + 10);

      // ===== Tabla glosas =====
      const glosas = Array.isArray(cotizacion?.glosas) ? cotizacion.glosas : [];
      const impuestoCell = "IVA 19%";

      const glosasBody = glosas.length
        ? glosas
            .slice()
            .sort((a, b) => Number(a?.orden ?? 0) - Number(b?.orden ?? 0))
            .map((g) => [
              safe(g.descripcion) || "—",
              "1",
              clp(Number(g.monto ?? 0)),
              impuestoCell,
              clp(Number(g.monto ?? 0)),
            ])
        : [["Esta cotización no tiene glosas.", "", "", "", ""]];

      const tableW = W - mx * 2;
      const col = {
        desc: 98,
        qty: 16,
        unit: 30,
        tax: 24,
        imp: tableW - (98 + 16 + 30 + 24),
      };

      const tableStartY = barY + 18;

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: mx, right: mx, top: HEADER_H, bottom: FOOTER_H + 2 },
        tableWidth: tableW,
        head: [["Descripción", "Cantidad", "Precio unitario", "Impuestos", "Importe"]],
        body: glosasBody,
        theme: "plain",
        styles: {
          font: "cambria",
          fontSize: 9.2,
          textColor: C.text,
          cellPadding: { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 },
          valign: "top",
        },
        headStyles: { fontStyle: "normal", textColor: C.text },
        columnStyles: {
          0: { cellWidth: col.desc },
          1: { cellWidth: col.qty, halign: "right" },
          2: { cellWidth: col.unit, halign: "right" },
          3: { cellWidth: col.tax, halign: "right" },
          4: { cellWidth: col.imp, halign: "right" },
        },
        didParseCell: (data) => {
          data.cell.styles.lineWidth = data.section === "head" ? 0.25 : 0.18;
          data.cell.styles.lineColor = C.line;
        },
      });

      // ===== Totales =====
      let y = (doc.lastAutoTable?.finalY ?? tableStartY + 40) + 5;

      autoTable(doc, {
        startY: y,
        margin: { left: W - mx - 84, right: mx },
        tableWidth: 84,
        theme: "plain",
        styles: {
          font: "cambria",
          fontSize: 9.4,
          cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
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
      const blocksStartY = (doc.lastAutoTable?.finalY ?? y) + 7;
      let yy = blocksStartY;

      const bottomLimit = H - (FOOTER_H + 8);

      const addBlock = (title, text) => {
        const t = safe(text);
        if (!t) return;

        if (yy + 20 > bottomLimit) {
          doc.addPage();
          yy = HEADER_H + 16;
        }

        doc.setFont("cambria", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(title, mx, yy);
        yy += 5;

        doc.setFont("cambria", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.text);

        const lines = doc.splitTextToSize(t, W - mx * 2);
        if (yy + lines.length * 4.0 + 4 > bottomLimit) {
          doc.addPage();
          yy = HEADER_H + 16;
        }

        doc.text(lines, mx, yy);
        yy += lines.length * 4.0 + 6;
      };

      addBlock("Términos y condiciones", cotizacion?.terminos_condiciones);
      addBlock("Acuerdo de pago", cotizacion?.acuerdo_pago);

      // ===== Redibujar header/footer en todas las páginas =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        drawHeader();
        drawFooter(p, pageCount);
      }

      const fileName = `Cotizacion_${numDoc}_${safeName(
        cotizacion?.cliente?.nombre ||
          cotizacion?.proyecto?.nombre ||
          "cotizacion"
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
