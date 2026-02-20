"use client";

import jsPDF from "jspdf";

export default function CotizacionPDFButtonLight({ cotizacion, iconOnly = false }) {
  if (!cotizacion) return null;

  const clp = (v) =>
    Number(v || 0).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });

  const generarPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;

    doc.setFontSize(16);
    doc.text("COTIZACIÓN", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.text(`N°: ${cotizacion.numero ?? "-"}`, 15, y);
    doc.text(`Fecha: ${cotizacion.creada_en ?? "-"}`, 150, y);
    y += 7;

    doc.text(`Cliente: ${cotizacion.cliente?.nombre ?? "-"}`, 15, y);
    y += 7;

    doc.text(`Subtotal: ${clp(cotizacion.subtotal)}`, 15, y);
    y += 6;
    doc.text(`IVA: ${clp(cotizacion.iva)}`, 15, y);
    y += 6;
    doc.text(`Total: ${clp(cotizacion.total)}`, 15, y);

    doc.save(`cotizacion-${cotizacion.numero ?? cotizacion.id}.pdf`);
  };

  if (iconOnly) {
    return (
      <button
        onClick={generarPDF}
        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
        title="Exportar PDF"
      >
        <span className="text-red-500">PDF</span>
      </button>
    );
  }

  return (
    <button
      onClick={generarPDF}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-md hover:bg-slate-100"
      title="Exportar PDF"
    >
      <span className="text-red-500">PDF</span>
    </button>
  );
}
