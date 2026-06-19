"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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

export default function CompraPDFButton({ compra }) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("puerto_montt");
  const [fetchedCompra, setFetchedCompra] = useState(null);

  if (!compra) return null;

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

  const fetchCompraCompleta = async (id) => {
    if (!id) return null;

    const { headers, token, empresaId } = buildAuthHeaders(session);
    if (!token) throw new Error("Falta accessToken para generar PDF.");
    if (!empresaId)
      throw new Error("Falta empresaId (x-empresa-id) para generar PDF.");

    const res = await fetch(`${API_URL}/compras/${id}`, {
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
        "No se pudo cargar la compra",
      );
    }
    return data;
  };

  const generarPDF = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy) return;

    try {
      setBusy(true);

      let cmp = compra;
      const tieneItems = Array.isArray(cmp?.items) && cmp.items.length > 0;
      const tieneProveedor = !!cmp?.proveedor;
      const tieneEmpresa = !!cmp?.empresa;

      if ((!tieneItems || !tieneProveedor || !tieneEmpresa) && cmp?.id) {
        const full = await fetchCompraCompleta(cmp.id);
        if (full) cmp = full;
      }

      const empNombre = cmp?.empresa?.nombre || "";
      const isBlue = String(empNombre).toLowerCase().includes("blue");

      if (isBlue) {
        setFetchedCompra(cmp);
        setShowBranchModal(true);
        setBusy(false);
      } else {
        await executeGenerarPDF(cmp, null);
      }
    } catch (err) {
      console.error("❌ Error al obtener compra:", err);
      alert(err?.message || "Error al obtener compra");
      setBusy(false);
    }
  };

  const executeGenerarPDF = async (cmp, branch) => {
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

      const numero = cmp?.numero != null ? String(cmp.numero) : safe(cmp?.id);
      const numDoc = numero ? `P${numero.padStart(5, "0")}` : "P00000";
      const docTitle = `Orden de compra #${numDoc}`;

      let logo = null;
      const MAX_LOGO_W = 43;
      const MAX_LOGO_H = 18;

      let logoW = MAX_LOGO_W;
      let logoH = MAX_LOGO_H;
      let logoY = 14.0;

      try {
        const empId = cmp?.empresa?.id || cmp?.empresa_id || null;
        const empNombre = cmp?.empresa?.nombre || "";
        const isBlue = String(empNombre).toLowerCase().includes("blue");

        if (empId) {
          const backendBase = API_URL ? API_URL.replace(/\/api$/, "") : "";
          let dbLogoUrl = null;
          if (cmp?.empresa?.logo_url) {
            const rawUrl = cmp.empresa.logo_url;
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
        // Draw header wave band
        doc.setFillColor(...C.blueSoft);
        doc.moveTo(0, 0);
        doc.lineTo(210, 0);
        doc.lineTo(210, 35);
        doc.curveTo(175, 33, 140, 36, 105, 38);
        doc.curveTo(70, 40, 35, 34, 0, 36);
        doc.close();
        doc.fill();

        const emp = cmp?.empresa || {};
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

        // Tagline
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.blue);

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

        const emp = cmp?.empresa || {};
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

      const proveedorNombre = safe(cmp?.proveedor?.nombre || cmp?.razon_social);
      const proveedorRut = safe(cmp?.proveedor?.rut || cmp?.rut_proveedor);
      const proveedorCorreo = safe(cmp?.proveedor?.correo);
      const proveedorTelefono = safe(cmp?.proveedor?.telefono);
      const proveedorDireccion = safe(cmp?.proveedor?.direccion);

      // Left Column: Dirección de envío
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 51); // #1f2933
      doc.text("Dirección de envío:", mx, yContent);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      let yLeft = yContent + 4.5;
      doc.text("Blue ingeniería", mx, yLeft);
      yLeft += 4;
      if (branch === "punta_arenas") {
        doc.text("Capitán Juan Guillermo 02233", mx, yLeft);
        yLeft += 4;
        doc.text("Punta Arenas", mx, yLeft);
      } else {
        doc.text("Av. San Agustín s/n La Paloma PC#38", mx, yLeft);
        yLeft += 4;
        doc.text("Puerto Montt 10 5480000", mx, yLeft);
      }
      yLeft += 4;
      doc.text("Chile", mx, yLeft);

      // Right Column: Proveedor / Supplier
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 51);
      let yRight = yContent;
      const nameLines = doc.splitTextToSize((proveedorNombre || "PROVEEDOR").toUpperCase(), 90);
      doc.text(nameLines, W / 2 + 5, yRight);
      yRight += nameLines.length * 3.8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      if (proveedorRut) {
        doc.text(`RUT: ${proveedorRut}`, W / 2 + 5, yRight);
        yRight += 3.8;
      }
      if (proveedorDireccion) {
        const dirLines = doc.splitTextToSize(proveedorDireccion, 90);
        doc.text(dirLines, W / 2 + 5, yRight);
        yRight += dirLines.length * 3.8;
      }
      if (proveedorTelefono) {
        doc.text(`Teléfono: ${proveedorTelefono}`, W / 2 + 5, yRight);
        yRight += 3.8;
      }
      if (proveedorCorreo) {
        doc.text(`Email: ${proveedorCorreo}`, W / 2 + 5, yRight);
        yRight += 3.8;
      }

      yContent = Math.max(yLeft, yRight) + 12;

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

      // Col 1: Comprador
      const compradorNombre = safe(cmp?.comprador?.nombre || cmp?.usuario?.nombre || "Víctor Morales");
      let colX = mx + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164); // #0b6fa4
      doc.text("Comprador", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(compradorNombre, colX, yContent + 9.5);

      // Col 2: La referencia de su orden
      const cotNum = cmp?.cotizacion?.numero;
      const referenciaDoc = safe(cmp?.referencia || (cotNum ? `Ref: S${String(cotNum).padStart(5, "0")}` : "024613"));
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("La referencia de su orden", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(referenciaDoc, colX, yContent + 9.5);

      // Col 3: Fecha de la orden
      const fechaDoc = fmtDate(cmp?.fecha_docto || cmp?.creada_en || Date.now());
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("Fecha de la orden:", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(fechaDoc, colX, yContent + 9.5);

      // Col 4: Llegada esperada
      let llegadaRaw = cmp?.fecha_entrega_esperada;
      if (!llegadaRaw && (cmp?.fecha_docto || cmp?.creada_en)) {
        llegadaRaw = new Date(new Date(cmp.fecha_docto || cmp.creada_en).getTime() + 14 * 24 * 60 * 60 * 1000);
      }
      const venceLlegadaDoc = fmtDate(llegadaRaw || Date.now());
      colX += colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(11, 111, 164);
      doc.text("Llegada esperada:", colX, yContent + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.text);
      doc.text(venceLlegadaDoc, colX, yContent + 9.5);

      yContent += barH + 6;

      // =========================
      // Items Table
      // =========================
      const items = Array.isArray(cmp?.items) ? cmp.items : [];
      const hasDiscount = items.some((it) => Number(it.descuento || 0) > 0);

      const glosasBody = items.length
        ? items.map((it) => {
          const desc = safe(it.item || (it.producto?.nombre ? `${it.producto.nombre} (${it.producto.sku || ""})` : "—"));
          const cant = Number(it.cantidad ?? 1);
          const unit = Number(it.precio_unit ?? it.precio_unitario ?? 0);
          const descVal = it.descuento ? clp(it.descuento) : "0,00";
          const taxVal = it.impuesto ? `${it.impuesto}%` : "No aplica";
          const lineTotal = Number(it.total ?? (cant * unit - (it.descuento || 0)));

          const unitLabel = String(it.unidad || "").trim();
          const unitLower = unitLabel.toLowerCase();
          const qtyText = (!unitLabel || ["unidad", "unidades", "uni", "un", "u"].includes(unitLower))
            ? String(cant)
            : `${cant}\n${unitLabel}`;

          if (hasDiscount) {
            return [
              desc,
              { content: qtyText, styles: { halign: "right" } },
              clp(unit),
              descVal,
              taxVal,
              clp(lineTotal),
            ];
          } else {
            return [
              desc,
              { content: qtyText, styles: { halign: "right" } },
              clp(unit),
              taxVal,
              clp(lineTotal),
            ];
          }
        })
        : [
          hasDiscount
            ? ["Esta orden de compra no tiene items.", "", "", "", "", ""]
            : ["Esta orden de compra no tiene items.", "", "", "", ""]
        ];

      const tableW = W - mx * 2;
      const tableHeaders = hasDiscount
        ? ["Descripción", "Cant.", "Precio unitario", "Desc.", "Impuestos", "Importe"]
        : ["Descripción", "Cant.", "Precio unitario", "Impuestos", "Importe"];

      const columnStyles = hasDiscount
        ? {
          0: { cellWidth: 90 }, // Descripción
          1: { cellWidth: 20, halign: "right" }, // Cant.
          2: { cellWidth: 26, halign: "right" }, // Precio unitario
          3: { cellWidth: 16, halign: "right" }, // Desc.
          4: { cellWidth: 20, halign: "center" }, // Impuestos
          5: { cellWidth: 20, halign: "right", fontStyle: "bold" }, // Importe
        }
        : {
          0: { cellWidth: 106 }, // Descripción (90 + 16 de la col Descuento)
          1: { cellWidth: 20, halign: "right" }, // Cant.
          2: { cellWidth: 26, halign: "right" }, // Precio unitario
          3: { cellWidth: 20, halign: "center" }, // Impuestos
          4: { cellWidth: 20, halign: "right", fontStyle: "bold" }, // Importe
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
      });

      // =========================
      // Totales Box
      // =========================
      let yTotals = (doc.lastAutoTable?.finalY ?? yContent + 40) + 4;

      const totalVal = Math.round(Number(cmp?.total || 0));
      const isExento = Number(cmp?.tipo_doc) === 34;
      const netoVal = isExento ? totalVal : Math.round(totalVal / 1.19);
      const ivaVal = isExento ? 0 : totalVal - netoVal;

      const totalsBody = [
        [isExento ? "Monto Exento" : "Subtotal", clp(netoVal)],
        ["Impuestos", clp(ivaVal)],
        ["Total", clp(totalVal)],
      ];

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

      const rawTerms = [cmp?.observaciones, cmp?.terminos_condiciones].filter(Boolean).join("\n");
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
          "Según Proforma Invoice o cotización comercial acordada previamente.",
          "Por favor, al facturar esta orden de compra, indique claramente el número de Orden de Compra (OC) en el documento de facturación.",
          "Cualquier diferencia o modificación en cantidades o precios debe ser notificada antes del despacho de los productos.",
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

      const fileName = `Compra_${numDoc}_${safeName(
        cmp?.proveedor?.nombre || cmp?.razon_social || "compra",
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
    <>
      <button
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-60 flex items-center justify-center"
        title="Descargar Orden de Compra PDF"
        type="button"
        onClick={generarPDF}
        disabled={busy}
      >
        {busy ? (
          <span className="animate-spin text-xs">⏳</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-[18px] h-[18px]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        )}
      </button>

      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Seleccionar Dirección de Envío</h3>
            <p className="text-slate-500 text-xs mb-4">
              Por favor, seleccione a cuál de las sucursales de Blue Ingeniería debe enviarse esta Orden de Compra:
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
                <input
                  type="radio"
                  name="sucursal"
                  value="puerto_montt"
                  checked={selectedBranch === "puerto_montt"}
                  onChange={() => setSelectedBranch("puerto_montt")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-sm text-slate-800">Puerto Montt</span>
                  <p className="text-xs text-slate-500 mt-0.5">Av. San Agustín s/n La Paloma PC#38</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
                <input
                  type="radio"
                  name="sucursal"
                  value="punta_arenas"
                  checked={selectedBranch === "punta_arenas"}
                  onChange={() => setSelectedBranch("punta_arenas")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-sm text-slate-800">Punta Arenas</span>
                  <p className="text-xs text-slate-500 mt-0.5">Capitán Juan Guillermo 02233</p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBranchModal(false);
                  setBusy(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowBranchModal(false);
                  await executeGenerarPDF(fetchedCompra, selectedBranch);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-lg shadow-indigo-600/10"
              >
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
