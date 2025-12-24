"use client";

import { Button } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import jsPDF from "jspdf";

/**
 * PDF estilo "Orden S00205" (similar al ejemplo)
 * Usa imágenes desde /public (recomendado: /iconbluein.png)
 */
export default function CotizacionPDFButton({ cotizacion }) {
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

  const loadImageDataURL = async (src) => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`No se pudo cargar imagen: ${src}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const generarPDF = async () => {
    const doc = new jsPDF("p", "mm", "a4");
    const W = 210;
    const H = 270;

    // ===== Colores (muy parecidos al template) =====
    const C = {
      blue: [21, 101, 192],
      lightBlue: [227, 242, 253],
      card: [238, 246, 252],
      grayHead: [245, 246, 248],
      grayRow: [250, 250, 251],
      text: [25, 25, 25],
      muted: [90, 90, 90],
      line: [210, 210, 210],
    };

    const mx = 14;

    // ===== Franjas =====
    doc.setFillColor(...C.lightBlue);
    doc.rect(0, 0, W, 30, "F");
    doc.rect(0, H - 26, W, 26, "F");

    // ===== Logo =====
    try {
      // Recomendado:
      const logo = await loadImageDataURL("/Logo_blue.png");
      doc.addImage(logo, "PNG", mx, 6.5, 46, 14);

      // Si quieres probar logoblanco (ojo con fondo blanco):
      // const logo = await loadImageDataURL("/logoblanco.png");
      // doc.addImage(logo, "PNG", mx, 6.5, 46, 14);
    } catch {
      // no bloquea
    }

    // ===== Slogan =====
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text("Tecnología que impulsa, soluciones que transforman", mx, 24);

    // ===== Datos empresa derecha =====
    doc.setTextColor(...C.text);
    doc.setFontSize(8.5);
    const rx = W - mx;
    const ty = 10;
    [
      "Punta Arenas",
      "Capitán Juan Guillermo 02233",
      "Puerto Montt",
      "Av. San Agustín S/N, La Paloma PC #38",
      "RUT 78115957-3",
    ].forEach((t, i) => doc.text(t, rx, ty + i * 4, { align: "right" }));

    // ===== Cliente (izquierda) =====
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(safe(cotizacion?.cliente?.nombre) || "Cliente", mx, 44);
    doc.setTextColor(...C.muted);
    doc.setFontSize(8.5);
    doc.text("Chile", mx, 48);

    // ===== Número de orden =====
    const numero = cotizacion?.numero != null ? String(cotizacion.numero) : safe(cotizacion?.id);
    const numDoc = numero ? `S${numero.padStart(5, "0")}` : "S00000";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15.5);
    doc.setTextColor(...C.blue);
    doc.text(`Número de orden ${numDoc}`, mx, 62);

    // ===== Cards =====
    const cardY = 68;
    const cardH = 12;
    const gap = 2;
    const cardW = (W - mx * 2 - gap) / 2;

    doc.setFillColor(...C.card);
    doc.rect(mx, cardY, cardW, cardH, "F");
    doc.rect(mx + cardW + gap, cardY, cardW, cardH, "F");

    doc.setFontSize(8.6);
    doc.setTextColor(...C.blue);
    doc.text("Fecha de la orden", mx + 3, cardY + 5);
    doc.text("Vendedor", mx + cardW + gap + 3, cardY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...C.text);
    doc.text(fmtDate(cotizacion?.creada_en), mx + 3, cardY + 10);
    doc.text(safe(cotizacion?.vendedor) || "-", mx + cardW + gap + 3, cardY + 10);

    // ===== Tabla =====
    let y = 90;

    // Header tabla
    doc.setFillColor(...C.grayHead);
    doc.rect(mx, y, W - mx * 2, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);

    const colDescX = mx + 2;
    const colCantX = 122;
    const colPUX = 153;
    const colImpX = 181;
    const colTotX = W - mx;

    doc.text("Descripción", colDescX, y + 5);
    doc.text("Cantidad", colCantX, y + 5, { align: "right" });
    doc.text("Precio unitario", colPUX, y + 5, { align: "right" });
    doc.text("Impuestos", colImpX, y + 5, { align: "right" });
    doc.text("Importe", colTotX, y + 5, { align: "right" });

    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.text);

    const items = Array.isArray(cotizacion?.items) ? cotizacion.items : [];

    // Ajuste: si tus "items" vienen como servicios desde ventas, asegúrate de que
    // el backend incluya items { include: { producto: true } } (ya lo tienes).
    if (!items.length) {
      doc.setTextColor(...C.muted);
      doc.text("Esta cotización no tiene ítems.", mx, y);
      y += 10;
    } else {
      items.forEach((it, idx) => {
        if (y > 230) {
          doc.addPage();
          doc.setFillColor(...C.lightBlue);
          doc.rect(0, 0, W, 18, "F");
          doc.rect(0, H - 18, W, 18, "F");
          y = 28;
        }

        // zebra
        if (idx % 2 === 0) {
          doc.setFillColor(...C.grayRow);
          doc.rect(mx, y - 6, W - mx * 2, 10, "F");
        }

        const nombre =
          it.tipo === "PRODUCTO"
            ? safe(it.producto?.nombre) || "Producto"
            : safe(it.Item) || "Servicio";

        doc.setTextColor(...C.text);
        doc.text(doc.splitTextToSize(nombre, 95), colDescX, y);

        doc.text(String(it.cantidad ?? 0), colCantX, y, { align: "right" });
        doc.text(clp(it.precioUnitario), colPUX, y, { align: "right" });

        doc.setTextColor(...C.muted);
        doc.text("IVA 19% Vta", colImpX, y, { align: "right" });

        doc.setTextColor(...C.text);
        doc.text(clp(it.total), colTotX, y, { align: "right" });

        y += 7;

        // descripción secundaria
        const extra = safe(it.descripcion);
        if (extra) {
          doc.setTextColor(...C.muted);
          doc.setFontSize(8.2);
          doc.text(doc.splitTextToSize(extra, 180), colDescX, y);
          doc.setFontSize(9);
          y += 7;
        }

        y += 4;
      });
    }

    // línea separadora
    doc.setDrawColor(...C.line);
    doc.line(mx, y, W - mx, y);
    y += 10;

    // ===== Totales (caja derecha) =====
    const boxW = 78;
    const boxX = W - mx - boxW;
    const boxY = y;
    const boxH = 28;

    doc.setFillColor(...C.grayHead);
    doc.rect(boxX, boxY, boxW, boxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);

    doc.text("Subtotal", boxX + 6, boxY + 8);
    doc.text(clp(cotizacion?.subtotal), boxX + boxW - 6, boxY + 8, { align: "right" });

    doc.text("IVA 19%", boxX + 6, boxY + 16);
    doc.text(clp(cotizacion?.iva), boxX + boxW - 6, boxY + 16, { align: "right" });

    doc.setTextColor(...C.text);
    doc.text("Total", boxX + 6, boxY + 24);
    doc.text(clp(cotizacion?.total), boxX + boxW - 6, boxY + 24, { align: "right" });

    y = boxY + boxH + 16;

    // ===== Bloques inferiores (como tu pantallazo) =====
    const descripcion = safe(cotizacion?.descripcion);
    const terminos = safe(cotizacion?.terminos_condiciones);
    const acuerdo = safe(cotizacion?.acuerdo_pago);

    const blockTitle = (t) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text(t, mx, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
    };

    const blockText = (t) => {
      if (!t) {
        doc.setTextColor(...C.muted);
        doc.text("-", mx, y);
        doc.setTextColor(...C.text);
        y += 8;
        return;
      }
      const lines = doc.splitTextToSize(t, 180);
      doc.text(lines, mx, y);
      y += lines.length * 4 + 6;
    };

    blockTitle("Descripción");
    blockText(descripcion);

    blockTitle("Términos y condiciones");
    blockText(terminos);

    blockTitle("Acuerdo de pago");
    blockText(acuerdo);

    // ===== Footer =====
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    doc.setFontSize(8.6);
    doc.text("administracion@blueinge.com", W / 2, H - 14, { align: "center" });

    doc.setTextColor(...C.blue);
    doc.text("https://blue-ingenieria.com/", W / 2, H - 9, { align: "center" });

    doc.setTextColor(...C.muted);
    doc.setFontSize(7.8);
    doc.text("Página 1 / 1", W / 2, H - 4, { align: "center" });

    doc.save(`Orden_${numDoc}.pdf`);
  };

  return (
    <Button
      size="small"
      variant="outlined"
      color="error"
      startIcon={<PictureAsPdfIcon />}
      onClick={generarPDF}
    >
      PDF
    </Button>
  );
}
