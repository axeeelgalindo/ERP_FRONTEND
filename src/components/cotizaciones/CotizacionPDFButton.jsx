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

      const numero = cot?.numero != null ? String(cot.numero) : safe(cot?.id);
      const numDoc = numero ? `S${numero.padStart(5, "0")}` : "S00000";
      const docTitle = `Cotización ${numDoc}`;

      const vigenciaDiasRaw = cot?.vigencia_dias ?? null;
      const vigenciaDias =
        vigenciaDiasRaw == null || vigenciaDiasRaw === ""
          ? null
          : Math.trunc(Number(vigenciaDiasRaw));

      const vigenciaLabel =
        Number.isFinite(vigenciaDias) && vigenciaDias > 0
          ? `${vigenciaDias} días vigencia`
          : "";

      let logo = null;
      // Puedes ajustar el tamaño máximo del logo cambiando estos valores (en milímetros):
      const MAX_LOGO_W = 60; // Ancho máximo del logo
      const MAX_LOGO_H = 23; // Alto máximo del logo

      let logoW = MAX_LOGO_W;
      let logoH = MAX_LOGO_H;
      let logoY = 4.0;

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
              // Limita por el ancho
              logoW = MAX_LOGO_W;
              logoH = MAX_LOGO_W / ratio;
            } else {
              // Limita por el alto
              logoH = MAX_LOGO_H;
              logoW = MAX_LOGO_H * ratio;
            }
            logoY = 4.0 + (MAX_LOGO_H - logoH) / 2;
          }
        }
      } catch {
        logo = null;
      }

      const HEADER_H = 36;
      const FOOTER_H = 23;

      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [W, H],
      });

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
            "F",
          );
        } else {
          doc.path(
            [
              ["M", 0, yTop + 6],
              ["C", W * 0.25, yTop - 8, W * 0.75, yTop + 18, W, yTop + 6],
              ["L", W, yTop + height],
              ["L", 0, yTop + height],
              ["Z"],
            ],
            "F",
          );
        }
      };

      const drawHeader = () => {
        drawWaveBand(0, HEADER_H, "down");

        const emp = cot?.empresa || {};
        const empNombre = emp.nombre || "Empresa";
        const empRut = emp.rut ? `RUT ${emp.rut}` : "";
        const empCorreo = emp.correo || "";
        const empTelefono = emp.telefono || "";

        if (logo) {
          doc.addImage(logo, "PNG", mx, logoY, logoW, logoH);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(...C.blue);
          doc.text(empNombre, mx, 14);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.muted);
        if (String(empNombre).toLowerCase().includes("blue")) {
          doc.text(
            "Tecnología que impulsa, soluciones que transforman",
            mx,
            22.0,
          );
        } else {
          doc.text(
            "",
            mx,
            22.0,
          );
        }

        const boxW = 72;
        const boxX = W - mx - boxW;

        let direccionLines = [];
        if (String(empNombre).toLowerCase().includes("blue")) {
          direccionLines = [
            "Punta Arenas",
            "Capitán Juan Guillermo 02233",
            "Puerto Montt",
            "Av. San Agustín S/N, La Paloma PC #38",
            empRut || "RUT 78115957-3",
          ];
        } else {
          direccionLines = [
            empNombre,
            emp.direccion ? `${emp.direccion}` : "",
            empTelefono ? `Tel: ${empTelefono}` : "",
            empCorreo ? `Email: ${empCorreo}` : "",
            empRut || "",
          ].filter(Boolean);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.1);

        doc.setDrawColor(180, 210, 230);
        doc.setFillColor(...C.lightBlue);
        const boxH = HEADER_H - 8;
        doc.roundedRect(boxX, 4, boxW, boxH, 2.5, 2.5, "FD");

        doc.setTextColor(...C.text);
        const N = direccionLines.length;
        const lineSpacing = N > 4 ? 3.4 : 4.0;
        const totalTextHeight = (N - 1) * lineSpacing;
        const boxCenterY = 4 + boxH / 2;
        let y = boxCenterY - totalTextHeight / 2 + 0.8;

        direccionLines.forEach((t) => {
          doc.text(String(t), boxX + boxW / 2, y, { align: "center" });
          y += lineSpacing;
        });
      };

      const drawFooter = (page, pages) => {
        drawWaveBand(H - FOOTER_H, FOOTER_H, "up");

        const emp = cot?.empresa || {};
        const empCorreo = emp.correo || "contacto@empresa.com";
        let empWeb = "";
        if (empCorreo.includes("@")) {
          const domain = empCorreo.split("@")[1];
          if (!["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(domain.toLowerCase())) {
            empWeb = `www.${domain}`;
          }
        }
        if (!empWeb && String(emp.nombre || "").toLowerCase().includes("blue")) {
          empWeb = "blue-ingenieria.com";
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...C.text);
        doc.text(empCorreo, W / 2, H - 9.3, {
          align: "center",
        });

        if (empWeb) {
          doc.setTextColor(...C.blue);
          doc.text(empWeb, W / 2, H - 5.8, {
            align: "center",
          });
        }

        doc.setTextColor(...C.muted);
        doc.setFontSize(7.2);
        doc.text(`Página ${page} / ${pages}`, W / 2, H - 2.4, {
          align: "center",
        });
      };

      drawHeader();
      drawFooter(1, 1);

      // =========================
      // Cliente / Responsable
      // =========================
      const yCliente = HEADER_H + 12;

      const clienteNombre = safe(cot?.cliente?.nombre);
      const clienteRut = safe(cot?.cliente?.rut);
      const clienteCorreo = safe(cot?.cliente?.correo);

      const resp = cot?.cliente_responsable || cot?.clienteResponsable || null;
      const respNombre = safe(resp?.nombre);
      const respCargo = safe(resp?.cargo);
      const respCorreo = safe(resp?.correo);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      doc.setFontSize(9.4);
      doc.text(clienteNombre || "Cliente", mx, yCliente);

      doc.setFontSize(8.6);
      doc.setTextColor(...C.muted);

      let yyInfo = yCliente + 4.6;
      const printLine = (text) => {
        const t = safe(text);
        if (!t) return;
        const lines = doc.splitTextToSize(t, W - mx * 2);
        doc.text(lines, mx, yyInfo);
        yyInfo += lines.length * 3.8;
      };

      printLine(clienteRut);
      printLine(clienteCorreo);
      yyInfo += 1.2;
      printLine(respNombre ? respNombre : "");
      printLine(respCargo ? respCargo : "");
      printLine(respCorreo ? respCorreo : "");

      // =========================
      // Título
      // =========================
      const yTitle = Math.max(yyInfo + 8, HEADER_H + 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(17.5);
      doc.setTextColor(...C.blue);
      doc.text(docTitle, mx, yTitle);

      if (vigenciaLabel) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.2);
        doc.setTextColor(...C.muted);
        doc.text(vigenciaLabel, W - mx, yTitle, { align: "right" });
      }

      const asuntoText = safe(cot?.asunto || cot?.descripcion);
      const asuntoUpper = asuntoText ? String(asuntoText).toUpperCase() : "";

      if (asuntoUpper) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.4);
        doc.setTextColor(...C.muted);
        doc.text("ASUNTO", mx, yTitle + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.2);
        doc.setTextColor(...C.text);

        const asuntoLines = doc.splitTextToSize(asuntoUpper, W - mx * 2);
        doc.text(asuntoLines, mx, yTitle + 10);
      }

      const barY = asuntoText ? yTitle + 14.5 : yTitle + 8.5;

      doc.setFillColor(...C.bar);
      doc.roundedRect(mx, barY, W - mx * 2, 12, 2.5, 2.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...C.blue);
      doc.text("Fecha", mx + 4, barY + 5);
      doc.text("Vencimiento", mx + 58, barY + 5);
      doc.text("Vendedor", mx + 128, barY + 5);

      let vendedorNombre =
        safe(cot?.vendedor?.nombre) || safe(cot?.vendedor?.correo) || "-";

      if (vendedorNombre.includes(",")) {
        const parts = vendedorNombre.split(",");
        const lastNames = parts[0].trim().split(" ");
        const firstNames = parts[1].trim().split(" ");
        vendedorNombre = `${firstNames[0]} ${lastNames[0]}`;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(...C.text);
      doc.text(fmtDate(cot?.fecha_documento), mx + 4, barY + 10);
      doc.text(fmtDate(cot?.vencimiento_documento), mx + 58, barY + 10);
      doc.text(vendedorNombre, mx + 128, barY + 10);

      // =========================
      // TABLA: Descripción / Cantidad / Precio Unitario / % Desc / Impuestos / Importe
      // =========================
      const glosas = Array.isArray(cot?.glosas) ? cot.glosas : [];

      const ivaRate = Number(cot?.ivaRate ?? 0.19); // si no existe en cot, usamos 19%
      const ivaRateNum = Number.isFinite(ivaRate) ? ivaRate : 0.19;

      const glosasBody = glosas.length
        ? glosas
          .slice()
          .sort((a, b) => Number(a?.orden ?? 0) - Number(b?.orden ?? 0))
          .map((g) => {
            const descripcion = safe(g.descripcion) || "—";

            const cantidad = Number(g.cantidad ?? 1);
            const precioUnitario = Number(g.precio_unitario ?? g.monto ?? 0);
            const brutoLinea = Number(g.monto ?? (cantidad * precioUnitario));

            const pct = clampPct(g.descuento_pct || 0);

            const descMonto = round0(brutoLinea * (pct / 100));
            const netoLinea = Math.max(0, brutoLinea - descMonto);

            const impuestos = round0(netoLinea * ivaRateNum);
            const importe = round0(netoLinea + impuestos);

            return [
              descripcion,
              String(cantidad),
              clp(precioUnitario),
              pct ? `${pct}%` : "0%",
              clp(netoLinea),
              clp(importe),
            ];
          })
        : [["Esta cotización no tiene glosas.", "", "", "", "", ""]];

      const tableW = W - mx * 2;
      const tableStartY = barY + 18;

      // ✅ 6 columnas, 6 estilos
      autoTable(doc, {
        startY: tableStartY,
        margin: { left: mx, right: mx, top: HEADER_H, bottom: FOOTER_H + 2 },
        tableWidth: tableW,
        head: [
          [
            "Descripción",
            "Cant.",
            "Precio Unit.",
            "Desc.",
            "Subtotal",
            //"IVA",
            "Total",
          ],
        ],
        body: glosasBody,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.0,
          textColor: C.text,
          cellPadding: { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 },
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 58 }, // descripción
          1: { cellWidth: 15, halign: "right" }, // cantidad
          2: { cellWidth: 26, halign: "right" }, // unitario
          3: { cellWidth: 15, halign: "right" }, // % desc
          4: { cellWidth: 26, halign: "right" }, // subtotal
          //5: { cellWidth: 26, halign: "right" }, // iva
          5: { cellWidth: tableW - (58 + 15 + 26 + 15 + 26), halign: "right" }, // total
        },
        didParseCell: (data) => {
          data.cell.styles.lineWidth = data.section === "head" ? 0.25 : 0.18;
          data.cell.styles.lineColor = C.line;
          if (data.section === "head") {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = C.blue;
          }
        },
      });

      // =========================
      // TOTALES con descuento general
      // =========================
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

      let y = (doc.lastAutoTable?.finalY ?? tableStartY + 40) + 5;

      autoTable(doc, {
        startY: y,
        margin: { left: W - mx - 92, right: mx },
        tableWidth: 92,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9.4,
          cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
          textColor: C.text,
        },
        body: [
          //  ["Precio", clp(brutoTotal)],
          //  ["Descuento", clp(descTotal)],
          ["Subtotal", clp(neto)],
          ["IVA 19%", clp(iva)],
          ["Total", clp(total)],
        ],
        columnStyles: {
          0: { cellWidth: 45, halign: "left", textColor: C.muted },
          1: { cellWidth: 35, halign: "right" },
        },
        didParseCell: (data) => {
          data.cell.styles.lineWidth = 0.18;
          data.cell.styles.lineColor = C.line;
          if (data.row.index === 4) {
            data.cell.styles.fontStyle = "bold";
            if (data.column.index === 0) data.cell.styles.textColor = C.blue;
          }
        },
      });

      // bloques inferiores
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

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(title, mx, yy);
        yy += 5;

        doc.setFont("helvetica", "normal");
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

      addBlock("Términos y condiciones", cot?.terminos_condiciones);
      addBlock("Acuerdo de pago", cot?.acuerdo_pago);

      // header/footer todas las páginas
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
