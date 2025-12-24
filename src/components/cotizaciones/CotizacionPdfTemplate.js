// src/components/cotizacion/cotizacionPdfTemplate.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generarCotizacionPDF(cotizacion) {
  const doc = new jsPDF();

  // ===== Header =====
  doc.setFontSize(16);
  doc.text("COTIZACIÓN", 14, 20);

  doc.setFontSize(10);
  doc.text(`N° ${cotizacion.numero}`, 14, 26);
  doc.text(`Fecha: ${new Date(cotizacion.creada_en).toLocaleDateString("es-CL")}`, 14, 32);

  doc.text(`Proyecto: ${cotizacion.proyecto?.nombre || "-"}`, 120, 26);
  doc.text(`Cliente: ${cotizacion.cliente?.nombre || "Sin cliente"}`, 120, 32);

  // ===== Descripción =====
  if (cotizacion.descripcion) {
    doc.text("Descripción:", 14, 42);
    doc.text(cotizacion.descripcion, 14, 48);
  }

  // ===== Tabla de ítems =====
  const tableData = (cotizacion.items || []).map((it, i) => [
    i + 1,
    it.tipo === "PRODUCTO"
      ? it.producto?.nombre || "Producto"
      : it.Item || "Servicio",
    it.cantidad,
    formatoCLP(it.precioUnitario),
    formatoCLP(it.total),
  ]);

  autoTable(doc, {
    startY: 60,
    head: [["#", "Ítem", "Cantidad", "Precio Unit.", "Total"]],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [25, 118, 210] },
  });

  // ===== Totales =====
  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Subtotal: ${formatoCLP(cotizacion.subtotal)}`, 140, finalY);
  doc.text(`IVA: ${formatoCLP(cotizacion.iva)}`, 140, finalY + 6);
  doc.setFontSize(11);
  doc.text(`TOTAL: ${formatoCLP(cotizacion.total)}`, 140, finalY + 14);

  // ===== Términos =====
  doc.setFontSize(9);
  if (cotizacion.terminos_condiciones) {
    doc.text("Términos y condiciones:", 14, finalY + 30);
    doc.text(cotizacion.terminos_condiciones, 14, finalY + 36);
  }

  if (cotizacion.acuerdo_pago) {
    doc.text("Acuerdo de pago:", 14, finalY + 52);
    doc.text(cotizacion.acuerdo_pago, 14, finalY + 58);
  }

  // Descargar
  doc.save(`Cotizacion-${cotizacion.numero}.pdf`);
}

function formatoCLP(valor) {
  return Number(valor || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
