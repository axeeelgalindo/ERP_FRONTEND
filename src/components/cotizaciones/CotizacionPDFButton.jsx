"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button, CircularProgress } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import { safeJson } from "@/components/ventas/utils/safeJson";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function buildAuthHeaders(session) {
  const token = session?.user?.accessToken || session?.accessToken || "";
  const empresaId =
    session?.user?.empresa?.id ||
    session?.user?.empresaId ||
    session?.user?.empresa_id ||
    null;

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (empresaId) headers["x-empresa-id"] = String(empresaId);

  return { headers, token, empresaId };
}

export default function CotizacionPDFButton({ cotizacion }) {
  const { data: session } = useSession();
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

  const formatVendedorNombre = (nombreCompleto) => {
    if (!nombreCompleto) return "";
    if (nombreCompleto.includes(",")) {
      const [apellidosPart, nombresPart] = nombreCompleto.split(",");
      const apellidos = (apellidosPart || "").trim().split(/\s+/);
      const nombres = (nombresPart || "").trim().split(/\s+/);
      const primerNombre = nombres[0] || "";
      const primerApellido = apellidos[0] || "";
      return `${primerNombre} ${primerApellido}`.trim();
    }
    return nombreCompleto.trim();
  };

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

  const fetchCotizacionCompleta = async (id) => {
    if (!id) return null;

    const { headers, token, empresaId } = buildAuthHeaders(session);
    if (!token) throw new Error("Falta accessToken para generar PDF.");
    if (!empresaId)
      throw new Error("Falta empresaId (x-empresa-id) para generar PDF.");

    const res = await fetch(`${API_URL}/cotizaciones/${id}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(
        data?.detalle ||
        data?.error ||
        data?.message ||
        "No se pudo cargar la cotización",
      );
    }
    return data;
  };

  const round0 = (n) => Math.round(Number(n || 0));

  const clampPct = (v) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(99.99, n));
  };

  const generarPDF = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy) return;

    try {
      setBusy(true);

      let cot = cotizacion;
      const tieneObjResponsable = !!(
        cot?.cliente_responsable || cot?.clienteResponsable
      );
      const tieneEmpresa = !!cot?.empresa;
      if ((!tieneObjResponsable || !tieneEmpresa) && cot?.id) {
        const full = await fetchCotizacionCompleta(cot.id);
        if (full) cot = full;
      }

      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod?.default || autoTableMod;

      const W = 210;
      const H = 297;
      const mx = 9;

      const C = {
        blue: [11, 95, 137], // #0b5f89
        blueDark: [23, 71, 102], // #174766
        blueSoft: [235, 243, 248], // #ebf3f8 (Mismo color que la imagen)
        blueSoft2: [235, 243, 248], // #ebf3f8 (Mismo color que la imagen)
        text: [38, 51, 63], // #26333f
        muted: [107, 114, 128], // #6b7280
        tableGray: [240, 242, 245], // #f0f2f5
        line: [184, 192, 200], // #b8c0c8
        white: [255, 255, 255],
      };

      const numero = cot?.numero != null ? String(cot.numero) : safe(cot?.id);
      const numDoc = numero ? `S${numero.padStart(5, "0")}` : "S00000";
      const docTitle = `Cotización #${numDoc}`;

      let logo = null;
      const MAX_LOGO_W = 43;
      const MAX_LOGO_H = 18;

      let logoW = MAX_LOGO_W;
      let logoH = MAX_LOGO_H;
      let logoY = 14.0;

      try {
        const empId = cot?.empresa?.id || cot?.empresa_id || null;
        const empNombre = cot?.empresa?.nombre || "";
        const isBlue = String(empNombre).toLowerCase().includes("blue");

        if (empId) {
          const backendBase = API_URL ? API_URL.replace(/\/api$/, "") : "";
          let dbLogoUrl = null;
          if (cot?.empresa?.logo_url) {
            const rawUrl = cot.empresa.logo_url;
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
            ...(isBlue ? [`/Logo_blue.png`] : [])
          ].filter(Boolean);
          for (const p of pathsToTry) {
            try {
              logo = await loadImageDataURL(p);
              if (logo) break;
            } catch {
              // try next path
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

      const HEADER_H = 48;
      const FOOTER_H = 42;

      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [W, H],
        compress: true,
      });

      const drawHeader = () => {
        doc.setFillColor(...C.blueSoft);
        doc.moveTo(0, 0);
        doc.lineTo(210, 0);
        doc.lineTo(210, 35);
        doc.curveTo(175, 33, 140, 36, 105, 38);
        doc.curveTo(70, 40, 35, 34, 0, 36);
        doc.close();
        doc.fill();

        const emp = cot?.empresa || {};
        const empNombre = emp.nombre || "Blue Ingeniería";
        const empRut = emp.rut ? `RUT ${emp.rut}` : "RUT 78115957-3";

        if (logo) {
          doc.addImage(logo, "PNG", mx, logoY, logoW, logoH, "logo", "FAST");
        } else {
          // Fake logo "B BLUE Ingeniería"
          doc.setFont("helvetica", "bold");
          doc.setFontSize(28);
          doc.setTextColor(...C.blue);
          doc.text("B", mx, 24);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.setTextColor(...C.blueDark);
          doc.text("BLUE", mx + 10, 19);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text("Ingeniería", mx + 10, 23.5);
        }

        // Company info
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(38, 56, 69); // #263845
        doc.text("Punta Arenas", W - mx, 14, { align: "right" });
        doc.text("Capitán Juan Guillermo 02233", W - mx, 18, { align: "right" });
        doc.text("Puerto Montt", W - mx, 22, { align: "right" });
        doc.text("Av. San Agustín S/N, La Paloma PC #38", W - mx, 26, { align: "right" });
        doc.text(empRut, W - mx, 30, { align: "right" });
      };

      const drawFooter = (page, pages) => {
        // Draw footer wave band
        doc.setFillColor(...C.blueSoft2);
        doc.moveTo(0, 274);
        doc.curveTo(35, 276, 70, 270, 105, 272);
        doc.curveTo(140, 274, 175, 277, 210, 275);
        doc.lineTo(210, 297);
        doc.lineTo(0, 297);
        doc.close();
        doc.fill();

        const emp = cot?.empresa || {};
        const empCorreo = emp.correo || "administracion@blueinge.com";
        let empWeb = "https://blue-ingenieria.com/";
        if (empCorreo.includes("@")) {
          const domain = empCorreo.split("@")[1];
          if (!["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(domain.toLowerCase())) {
            empWeb = `https://www.${domain}/`;
          }
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(38, 51, 63); // #26333f
        doc.text(empCorreo, W / 2, H - 15, { align: "center" });

        doc.setTextColor(...C.blue);
        doc.text(empWeb, W / 2, H - 11, { align: "center" });

        doc.setTextColor(140, 153, 163); // #8c99a3
        doc.setFontSize(7.5);
        doc.text(`Página ${page} / ${pages}`, W / 2, H - 6, { align: "center" });
      };

      // Draw initial page decoration
      drawHeader();
      drawFooter(1, 1);

      // =========================
      // Parties Section
      // =========================
      let yContent = 55;

      const clienteNombre = safe(cot?.cliente?.nombre);
      const clienteRut = safe(cot?.cliente?.rut);
      const clienteCorreo = safe(cot?.cliente?.correo);

      const resp = cot?.cliente_responsable || cot?.clienteResponsable || null;
      const respNombre = safe(resp?.nombre);
      const respCargo = safe(resp?.cargo);
      const respCorreo = safe(resp?.correo);

      // Left Column: Cliente
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 51); // #1f2933
      doc.text("CLIENTE:", mx, yContent);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      let yLeft = yContent + 4.5;
      doc.text(clienteNombre || "Cliente", mx, yLeft);
      yLeft += 4;
      if (clienteRut) {
        doc.text(`RUT: ${clienteRut}`, mx, yLeft);
        yLeft += 4;
      }
      if (clienteCorreo) {
        doc.text(clienteCorreo, mx, yLeft);
        yLeft += 4;
      }
      if (respNombre) {
        doc.setFont("helvetica", "bold");
        doc.text("Contacto:", mx, yLeft);
        doc.setFont("helvetica", "normal");
        yLeft += 4;
        doc.text(respNombre, mx, yLeft);
        yLeft += 4;
        if (respCargo) {
          doc.text(respCargo, mx, yLeft);
          yLeft += 4;
        }
        if (respCorreo) {
          doc.text(respCorreo, mx, yLeft);
          yLeft += 4;
        }
      }

      yContent = yLeft + 6;

      // =========================
      // Document Title
      // =========================
      doc.setFont("helvetica", "normal");
      doc.setFontSize(24);
      doc.setTextColor(...C.blue);
      doc.text(docTitle, mx, yContent);
      yContent += 7;

      // =========================
      // Info Bar (4 Columns)
      // =========================
      const barH = 13;
      doc.setFillColor(231, 242, 251); // --blue-soft
      doc.roundedRect(mx, yContent, W - mx * 2, barH, 2, 2, "F");

      const colW = (W - mx * 2) / 4;

      // Col 1: Asunto
      const referenciaDoc = safe(cot?.referencia || cot?.asunto || "—");
      const refLines = doc.splitTextToSize(referenciaDoc, colW - 4);
      let colX = mx + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("Asunto", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      doc.text(refLines[0] || "—", colX, yContent + 9.5);

      // Col 2: Vendedor
      const vendedorNombre = formatVendedorNombre(
        safe(cot?.vendedor?.nombre || cot?.usuario?.nombre || "Víctor Morales")
      );
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164); // #0b6fa4
      doc.text("Vendedor", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(vendedorNombre, colX, yContent + 9.5);

      // Col 3: Fecha
      const fechaDoc = fmtDate(cot?.fecha_documento || cot?.creada_en || Date.now());
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("Fecha de la orden:", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(fechaDoc, colX, yContent + 9.5);

      // Col 4: Vencimiento
      let vencimientoRaw = cot?.vencimiento_documento;
      if (!vencimientoRaw && (cot?.fecha_documento || cot?.creada_en)) {
        vencimientoRaw = new Date(new Date(cot.fecha_documento || cot.creada_en).getTime() + 15 * 24 * 60 * 60 * 1000);
      }
      const venceLlegadaDoc = fmtDate(vencimientoRaw || Date.now());
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("Fecha expiración:", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(venceLlegadaDoc, colX, yContent + 9.5);

      yContent += barH + 6;

      // =========================
      // TOTALES con descuento general (calculado antes)
      // =========================
      const glosas = Array.isArray(cot?.glosas) ? cot.glosas : [];

      const brutoTotal = round0(
        glosas.reduce((a, g) => a + round0(g.monto || 0), 0),
      );
      const descGlosas = round0(
        glosas.reduce((a, g) => {
          const m = round0(g.monto || 0);
          const pct = Number(g.descuento_pct || 0);
          return a + Math.round(m * (pct / 100));
        }, 0),
      );
      const afterGlosas = Math.max(0, brutoTotal - descGlosas);
      const descGeneral = Math.round(
        afterGlosas * (Number(cot?.descuento_pct || 0) / 100),
      );
      const descTotal = round0(descGlosas + descGeneral);
      const neto = round0(Math.max(0, afterGlosas - descGeneral));

      const iva = round0(cot?.iva ?? Math.round(neto * 0.19));
      const total = round0(cot?.total ?? neto + iva);

      const descGeneralPct = clampPct(cot?.descuento_pct || 0);
      const hasDiscount = descTotal > 0 || glosas.some((g) => clampPct(g.descuento_pct || 0) > 0);

      // =========================
      // Items Table
      // =========================
      const ivaRate = Number(cot?.ivaRate ?? 0.19);
      const ivaRateNum = Number.isFinite(ivaRate) ? ivaRate : 0.19;

      const glosasBody = glosas.length
        ? glosas
          .slice()
          .sort((a, b) => Number(a?.orden ?? 0) - Number(b?.orden ?? 0))
          .map((g) => {
            const descripcion = safe(g.descripcion) || "—";
            let contentText = descripcion;
            if (g.comentario && String(g.comentario).trim()) {
              const commentLines = String(g.comentario).trim().split("\n");
              commentLines.forEach(() => {
                contentText += "\n "; // reserve space
              });
            }

            const descCell = {
              content: contentText,
              description: descripcion,
              comment: g.comentario ? String(g.comentario).trim() : null
            };

            const cantidad = Number(g.cantidad ?? 1);
            const precioUnitario = Number(g.precio_unitario ?? g.monto ?? 0);
            const brutoLinea = Number(g.monto ?? (cantidad * precioUnitario));

            const hasGeneralDesc = descGeneralPct > 0;
            let displayPctText = "N/A";
            let activePct = 0;

            if (hasGeneralDesc) {
              activePct = descGeneralPct;
              displayPctText = `${descGeneralPct}%`;
            } else {
              const gPct = clampPct(g.descuento_pct || 0);
              if (gPct > 0) {
                activePct = gPct;
                displayPctText = `${gPct}%`;
              } else {
                activePct = 0;
                displayPctText = "N/A";
              }
            }

            const descMonto = round0(brutoLinea * (activePct / 100));
            const netoLinea = Math.max(0, brutoLinea - descMonto);
            const impuestos = round0(netoLinea * ivaRateNum);
            const importe = round0(netoLinea + impuestos);

            const unitLabel = String(g.unidad || "").trim();
            const unitLower = unitLabel.toLowerCase();
            const qtyText = (!unitLabel || ["unidad", "unidades", "uni", "un", "u"].includes(unitLower))
              ? String(cantidad)
              : `${cantidad}\n${unitLabel}`;

            if (hasDiscount) {
              return [
                descCell,
                { content: qtyText, styles: { halign: "right" } },
                clp(precioUnitario),
                displayPctText,
                clp(netoLinea),
              ];
            } else {
              return [
                descCell,
                { content: qtyText, styles: { halign: "right" } },
                clp(precioUnitario),
                clp(netoLinea),
              ];
            }
          })
        : [hasDiscount ? ["Esta cotización no tiene glosas.", "", "", "", ""] : ["Esta cotización no tiene glosas.", "", "", ""]];

      const tableW = W - mx * 2;
      const tableHeaders = hasDiscount
        ? ["Descripción", "Cant.", "Precio unitario", "Desc.", "Subtotal"]
        : ["Descripción", "Cant.", "Precio unitario", "Subtotal"];

      const columnStyles = hasDiscount
        ? {
          0: { cellWidth: 102 }, // Descripción
          1: { cellWidth: 18, halign: "right" }, // Cant.
          2: { cellWidth: 26, halign: "right" }, // Precio unitario
          3: { cellWidth: 18, halign: "right" }, // Desc.
          4: { cellWidth: 28, halign: "right", fontStyle: "bold" }, // Subtotal
        }
        : {
          0: { cellWidth: 120 }, // Descripción
          1: { cellWidth: 18, halign: "right" }, // Cant.
          2: { cellWidth: 26, halign: "right" }, // Precio unitario
          3: { cellWidth: 28, halign: "right", fontStyle: "bold" }, // Subtotal
        };

      autoTable(doc, {
        startY: yContent,
        margin: { left: mx, right: mx, top: 48 + 4, bottom: 42 + 4 },
        tableWidth: tableW,
        head: [tableHeaders],
        body: glosasBody,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.0,
          textColor: C.text,
          cellPadding: { top: 4.0, right: 2.2, bottom: 4.0, left: 2.2 },
          valign: "top",
        },
        columnStyles,
        willDrawCell: (data) => {
          if (data.column.index === 0 && data.section === "body") {
            const rawCell = data.cell.raw;
            if (rawCell && typeof rawCell === "object" && rawCell.comment) {
              const descLines = doc.splitTextToSize(rawCell.description, data.cell.width - 4.4);
              data.cell.text = descLines;
            }
          }
        },
        didParseCell: (data) => {
          if (data.section === "head") {
            data.cell.styles.lineWidth = { bottom: 0.25 };
            data.cell.styles.lineColor = C.line;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [31, 41, 51]; // #1f2933
            data.cell.styles.fillColor = [255, 255, 255];
          } else {
            data.cell.styles.fillColor = C.tableGray;
          }
        },
        didDrawCell: (data) => {
          if (data.column.index === 0 && data.section === "body") {
            const rawCell = data.cell.raw;
            if (rawCell && typeof rawCell === "object" && rawCell.comment) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(8.0);
              doc.setTextColor(...C.muted);

              const commentLines = doc.splitTextToSize(rawCell.comment, data.cell.width - 4.4);
              const commentHeight = commentLines.length * 3.2;
              const startY = data.cell.y + data.cell.height - 4.0 - commentHeight + 2.5;

              commentLines.forEach((line, i) => {
                doc.text(line, data.cell.x + 2.2, startY + (i * 3.2));
              });

              // Restore styles
              doc.setFont("helvetica", "normal");
              doc.setTextColor(...C.text);
            }
          }
        },
      });

      // =========================
      // Totales Box
      // =========================
      let yTotals = (doc.lastAutoTable?.finalY ?? yContent + 40) + 4;

      const totalsBody = [];
      if (hasDiscount) {
        totalsBody.push(["Subtotal", clp(brutoTotal)]);
        totalsBody.push(["Descuento", clp(descTotal)]);
      } else {
        totalsBody.push(["Subtotal", clp(neto)]);
      }

      if (cot?.sin_iva) {
        totalsBody.push(["IVA (0%)", "Exento"]);
      } else {
        totalsBody.push(["IVA (19%)", clp(iva)]);
      }
      totalsBody.push(["Total", clp(total)]);

      autoTable(doc, {
        startY: yTotals,
        margin: { left: W - mx - 64, right: mx },
        tableWidth: 64,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.5,
          cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
          textColor: C.text,
        },
        body: totalsBody,
        columnStyles: {
          0: { cellWidth: 30, halign: "left", textColor: C.muted },
          1: { cellWidth: 34, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          data.cell.styles.fillColor = C.tableGray;
          if (data.row.index === totalsBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = C.blue;
          }
        },
      });

      // =========================
      // Terms Section
      // =========================
      let yTerms = (doc.lastAutoTable?.finalY ?? yTotals + 20) + 6;
      if (yTerms + 25 > H - 42) {
        doc.addPage();
        yTerms = 48 + 14;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 51);
      doc.text("Términos y condiciones:", mx, yTerms);
      yTerms += 5.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);

      const rawTerms = [cot?.terminos_condiciones, cot?.acuerdo_pago].filter(Boolean).join("\n");
      const termsLines = rawTerms ? rawTerms.split("\n").filter(line => line.trim()) : [];

      if (termsLines.length > 0) {
        termsLines.forEach((line, idx) => {
          const cleanLine = `${idx + 1}. ${line.replace(/^\d+[\.\)\s]+/, "")}`;
          const splitLines = doc.splitTextToSize(cleanLine, W - mx * 2);
          if (yTerms + splitLines.length * 3.5 > H - 42) {
            doc.addPage();
            yTerms = 48 + 14;
          }
          doc.text(splitLines, mx, yTerms);
          yTerms += splitLines.length * 3.5 + 1;
        });
      } else {
        const defaultTerms = [
          "Cotización válida por los días indicados en la vigencia.",
          "Precios y condiciones comerciales sujetos a confirmación por parte del vendedor.",
          "Forma de pago y plazos según acuerdo establecido.",
        ];
        defaultTerms.forEach((line, idx) => {
          const cleanLine = `${idx + 1}. ${line}`;
          const splitLines = doc.splitTextToSize(cleanLine, W - mx * 2);
          doc.text(splitLines, mx, yTerms);
          yTerms += splitLines.length * 3.5 + 1;
        });
      }

      // =========================
      // Page numbering & redrawing headers/footers
      // =========================
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        drawHeader();
        drawFooter(p, pageCount);
      }

      const fileName = `Cotizacion_${numDoc}_${safeName(
        cot?.cliente?.nombre || cot?.proyecto?.nombre || "cotizacion",
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
