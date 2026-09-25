"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  Users,
  Palmtree,
  Building,
  CheckCircle2,
  Clock,
  Printer,
  Search,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { makeHeaders } from "@/lib/api";
import ExcelJS from "exceljs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MESES = [
  { val: "1", label: "Enero" },
  { val: "2", label: "Febrero" },
  { val: "3", label: "Marzo" },
  { val: "4", label: "Abril" },
  { val: "5", label: "Mayo" },
  { val: "6", label: "Junio" },
  { val: "7", label: "Julio" },
  { val: "8", label: "Agosto" },
  { val: "9", label: "Septiembre" },
  { val: "10", label: "Octubre" },
  { val: "11", label: "Noviembre" },
  { val: "12", label: "Diciembre" },
];

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getMonthName(mNum) {
  const found = MESES.find((m) => m.val === String(mNum));
  return found ? found.label : `Mes ${mNum}`;
}

export default function CartolaVacacionesModal({
  open,
  onClose,
  session,
  empleados = [],
}) {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1);

  // Fechas iniciales para rango: 1er día y último día del mes actual
  const firstDayStr = `${currentYear}-${currentMonth.padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lastDayStr = `${currentYear}-${currentMonth.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState("mes"); // "mes" | "rango" | "ano"
  const [filtroAno, setFiltroAno] = useState(currentYear);
  const [filtroMes, setFiltroMes] = useState(currentMonth);
  const [desde, setDesde] = useState(firstDayStr);
  const [hasta, setHasta] = useState(lastDayStr);
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEmpleadoId, setFiltroEmpleadoId] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Datos y Estados de Carga
  const [loading, setLoading] = useState(false);
  const [vacaciones, setVacaciones] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Escuchar ESC para cerrar
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Cargar vacaciones con los filtros seleccionados
  const fetchCartolaData = async () => {
    if (!session || !open) return;
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (tipoFiltro === "mes") {
        if (filtroAno) params.append("ano", filtroAno);
        if (filtroMes) params.append("mes", filtroMes);
      } else if (tipoFiltro === "rango") {
        if (desde) params.append("desde", desde);
        if (hasta) params.append("hasta", hasta);
      } else if (tipoFiltro === "ano") {
        if (filtroAno) params.append("ano", filtroAno);
      }

      if (filtroSede) params.append("sede", filtroSede);
      if (filtroEmpleadoId) params.append("empleado_id", filtroEmpleadoId);
      if (filtroEstado) params.append("estado", filtroEstado);

      const res = await fetch(`${API_URL}/empleados/vacaciones/general?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      if (!res.ok) {
        throw new Error("No se pudo obtener el registro de vacaciones para la cartola");
      }

      const json = await res.json();
      setVacaciones(Array.isArray(json.vacaciones) ? json.vacaciones : []);
      setSaldos(Array.isArray(json.saldos) ? json.saldos : []);
    } catch (err) {
      setError(err.message || "Error al cargar datos");
      setVacaciones([]);
      setSaldos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCartolaData();
    }
  }, [open, tipoFiltro, filtroAno, filtroMes, desde, hasta, filtroSede, filtroEmpleadoId, filtroEstado]);

  // Filtrado local adicional por texto de búsqueda en vivo
  const vacacionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return vacaciones;
    const q = busqueda.toLowerCase().trim();
    return vacaciones.filter(
      (v) =>
        v.nombre?.toLowerCase().includes(q) ||
        v.rut?.toLowerCase().includes(q) ||
        v.cargo?.toLowerCase().includes(q) ||
        v.detalle?.toLowerCase().includes(q)
    );
  }, [vacaciones, busqueda]);

  // Título del período consultado
  const periodoTexto = useMemo(() => {
    if (tipoFiltro === "mes") {
      return `${getMonthName(filtroMes)} de ${filtroAno}`;
    }
    if (tipoFiltro === "rango") {
      return `Desde ${fmtDate(desde)} hasta ${fmtDate(hasta)}`;
    }
    if (tipoFiltro === "ano") {
      return `Año ${filtroAno} Completo`;
    }
    return "Periodo General";
  }, [tipoFiltro, filtroMes, filtroAno, desde, hasta]);

  // Métricas del reporte actual
  const metricas = useMemo(() => {
    const totalRegistros = vacacionesFiltradas.length;
    const totalDias = vacacionesFiltradas.reduce((acc, v) => acc + (Number(v.dias) || 0), 0);
    const personasSet = new Set(vacacionesFiltradas.map((v) => v.empleado_id));
    const totalPersonas = personasSet.size;

    return {
      totalRegistros,
      totalDias: Math.round(totalDias * 100) / 100,
      totalPersonas,
    };
  }, [vacacionesFiltradas]);

  // ==========================================
  // EXPORTAR A EXCEL (.XLSX)
  // ==========================================
  const handleExportExcel = async () => {
    if (vacacionesFiltradas.length === 0) {
      alert("No hay datos de vacaciones para exportar en este período.");
      return;
    }

    try {
      setExporting(true);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Blue Ingeniería ERP";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Cartola Vacaciones", {
        views: [{ showGridLines: true }],
      });

      // 1. Título y Membrete
      worksheet.mergeCells("A1:I1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "BLUE INGENIERÍA SPA - CARTOLA DE VACACIONES";
      titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B5F89" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 28;

      worksheet.mergeCells("A2:I2");
      const subCell = worksheet.getCell("A2");
      subCell.value = `Período: ${periodoTexto.toUpperCase()} | Sede: ${filtroSede ? (filtroSede === "PUQ" ? "Punta Arenas" : "Puerto Montt") : "Todas"} | Fecha de Emisión: ${new Date().toLocaleDateString("es-CL")}`;
      subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF334155" } };
      subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      subCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(2).height = 20;

      // Fila vacía
      worksheet.addRow([]);

      // 2. Encabezados de Columna
      const headers = [
        "N°",
        "TRABAJADOR",
        "RUT",
        "CARGO",
        "SEDE",
        "FECHA DESDE",
        "FECHA HASTA",
        "DÍAS TOMADOS",
        "SALDO DISPONIBLE",
        "ESTADO",
        "DETALLE / OBSERVACIÓN",
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      });

      // 3. Filas de Datos
      vacacionesFiltradas.forEach((v, index) => {
        const row = worksheet.addRow([
          index + 1,
          v.nombre?.toUpperCase() || "-",
          v.rut || "-",
          v.cargo || "-",
          v.sede || "PMC",
          fmtDate(v.desde),
          fmtDate(v.hasta),
          v.dias,
          v.saldo_disponible != null ? Number(v.saldo_disponible).toFixed(2) : "-",
          v.estado || "CONFIRMADO",
          v.detalle || "Sin observaciones",
        ]);

        row.height = 20;
        const isEven = index % 2 === 0;
        const bgColor = isEven ? "FFFFFFFF" : "FFF8FAFC";

        row.eachCell((cell, colNum) => {
          cell.font = { name: "Calibri", size: 9.5, color: { argb: "FF0F172A" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          // Alineaciones
          if ([1, 5, 6, 7, 8, 9, 10].includes(colNum)) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }

          if (colNum === 8) {
            cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0B5F89" } };
          }
        });
      });

      // 4. Fila de Totales
      const totalRow = worksheet.addRow([
        "",
        "TOTAL PERIODO",
        "",
        "",
        "",
        "",
        "",
        metricas.totalDias,
        "",
        "",
        `${metricas.totalPersonas} personas / ${metricas.totalRegistros} solicitudes`,
      ]);

      totalRow.height = 22;
      totalRow.eachCell((cell, colNum) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        cell.border = {
          top: { style: "medium", color: { argb: "FF64748B" } },
          bottom: { style: "medium", color: { argb: "FF64748B" } },
        };
        if (colNum === 8) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0369A1" } };
        }
      });

      // 5. Ajustar anchos de columnas
      worksheet.columns.forEach((column) => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const str = cell.value ? String(cell.value) : "";
          if (str.length > maxLen) maxLen = str.length;
        });
        column.width = Math.min(Math.max(maxLen + 4, 12), 45);
      });

      // Descargar archivo
      const cleanPeriodo = periodoTexto.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Cartola_Vacaciones_${cleanPeriodo}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Error al generar el archivo Excel: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ==========================================
  // EXPORTAR A PDF (CARTOLA OFICIAL)
  // ==========================================
  const handleExportPDF = async () => {
    if (vacacionesFiltradas.length === 0) {
      alert("No hay datos de vacaciones para exportar en este período.");
      return;
    }

    try {
      setExporting(true);
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod?.default || autoTableMod;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const W = 297;
      const H = 210;
      const mx = 14;

      const colors = {
        primary: [11, 95, 137], // #0b5f89
        dark: [23, 71, 102],
        slateText: [30, 41, 59],
        muted: [100, 116, 139],
        line: [226, 232, 240],
        accentBg: [241, 245, 249],
      };

      // Header Wave Decorativo
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, W, 5, "F");

      // Encabezado Membrete
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...colors.primary);
      doc.text("BLUE INGENIERÍA SPA", mx, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...colors.muted);
      doc.text("Sistemas y Gestión de Remuneraciones / RRHH", mx, y + 4.5);
      doc.text("Puerto Montt & Punta Arenas, Chile", mx, y + 8.5);

      // Fecha y Folio en el lado derecho
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...colors.slateText);
      doc.text(`Fecha Emisión: ${new Date().toLocaleDateString("es-CL")}`, W - mx, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...colors.muted);
      doc.text(`Generado por: ${session?.user?.nombre || "Administrador"}`, W - mx, y + 4.5, { align: "right" });

      y += 15;

      // Barra de Título del Documento
      doc.setFillColor(...colors.accentBg);
      doc.roundedRect(mx, y, W - mx * 2, 14, 2, 2, "F");
      doc.setDrawColor(...colors.line);
      doc.roundedRect(mx, y, W - mx * 2, 14, 2, 2, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...colors.dark);
      doc.text("CARTOLA OFICIAL DE VACACIONES", mx + 5, y + 6.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.primary);
      doc.text(`PERÍODO: ${periodoTexto.toUpperCase()}`, mx + 5, y + 11);

      // Indicadores en el extremo derecho de la barra
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...colors.slateText);
      const kpiStr = `Trabajadores: ${metricas.totalPersonas}   |   Registros: ${metricas.totalRegistros}   |   Total Días Tomados: ${metricas.totalDias} días`;
      doc.text(kpiStr, W - mx - 5, y + 8.5, { align: "right" });

      y += 19;

      // Tabla de Vacaciones con jspdf-autotable
      const tableHead = [
        [
          "N°",
          "Trabajador",
          "RUT",
          "Cargo",
          "Sede",
          "Desde",
          "Hasta",
          "Días",
          "Saldo Disp.",
          "Estado",
          "Detalle / Observación",
        ],
      ];

      const tableBody = vacacionesFiltradas.map((v, i) => [
        i + 1,
        v.nombre || "—",
        v.rut || "—",
        v.cargo || "—",
        v.sede || "PMC",
        fmtDate(v.desde),
        fmtDate(v.hasta),
        v.dias,
        v.saldo_disponible != null ? `${Number(v.saldo_disponible).toFixed(2)} d` : "—",
        v.estado || "CONFIRMADO",
        v.detalle || "—",
      ]);

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y,
        margin: { left: mx, right: mx, bottom: 20 },
        styles: {
          fontSize: 7.5,
          textColor: [15, 23, 42],
          cellPadding: 2,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [11, 95, 137],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { fontStyle: "bold", cellWidth: 46 },
          2: { fontStyle: "normal", cellWidth: 22, halign: "center" },
          3: { cellWidth: 32 },
          4: { halign: "center", cellWidth: 14 },
          5: { halign: "center", cellWidth: 20 },
          6: { halign: "center", cellWidth: 20 },
          7: { halign: "center", fontStyle: "bold", cellWidth: 14, textColor: [11, 95, 137] },
          8: { halign: "center", cellWidth: 20 },
          9: { halign: "center", cellWidth: 24 },
          10: { cellWidth: "auto" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          // Footer
          const pageStr = `Página ${data.pageNumber}`;
          doc.setFontSize(7.5);
          doc.setTextColor(140, 153, 163);
          doc.text(pageStr, W - mx, H - 7, { align: "right" });
          doc.text(
            "Documento Oficial de Nómina y Control de Vacaciones - Blue Ingeniería SpA",
            mx,
            H - 7
          );
        },
      });

      // Descargar PDF
      const cleanPeriodo = periodoTexto.replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`Cartola_Vacaciones_${cleanPeriodo}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Error al generar el archivo PDF: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 md:p-6 animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-4 md:px-6 md:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Cartola de Vacaciones</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white tracking-wide uppercase">
                  RRHH
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Previsualiza y descarga la nómina de vacaciones tomadas por mes, rango de fechas o sede
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* PANEL DE FILTROS */}
          <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              {/* Selector de Modo de Filtro */}
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTipoFiltro("mes")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tipoFiltro === "mes"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📅 Por Mes
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltro("rango")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tipoFiltro === "rango"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🗓️ Por Rango de Fechas
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltro("ano")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tipoFiltro === "ano"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🏢 Todo el Año
                </button>
              </div>

              {/* Botón Refrescar */}
              <button
                type="button"
                onClick={fetchCartolaData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            {/* Inputs de Fechas según el Modo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {tipoFiltro === "mes" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Año
                    </label>
                    <select
                      value={filtroAno}
                      onChange={(e) => setFiltroAno(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Mes
                    </label>
                    <select
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {MESES.map((m) => (
                        <option key={m.val} value={m.val}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : tipoFiltro === "rango" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Fecha Desde
                    </label>
                    <input
                      type="date"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Fecha Hasta
                    </label>
                    <input
                      type="date"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Año Completo
                  </label>
                  <select
                    value={filtroAno}
                    onChange={(e) => setFiltroAno(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              )}

              {/* Sede */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Sede
                </label>
                <select
                  value={filtroSede}
                  onChange={(e) => setFiltroSede(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">🏢 Todas las Sedes</option>
                  <option value="PMC">Puerto Montt (PMC)</option>
                  <option value="PUQ">Punta Arenas (PUQ)</option>
                </select>
              </div>

              {/* Empleado Específico */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Trabajador
                </label>
                <select
                  value={filtroEmpleadoId}
                  onChange={(e) => setFiltroEmpleadoId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">👥 Todos los Trabajadores</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.usuario?.nombre || emp.cargo || emp.rut}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barra secundaria: Buscador y Estado */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en la previsualización por trabajador, RUT o detalle..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Estado:</span>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Todos los Estados</option>
                  <option value="CONFIRMADO">Confirmadas</option>
                  <option value="AJUSTE">Ajustes</option>
                  <option value="PENDIENTE">Pendientes</option>
                </select>
              </div>
            </div>
          </div>

          {/* TARJETAS DE RESUMEN / METRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  Personas con Vacaciones
                </p>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  {metricas.totalPersonas}{" "}
                  <span className="text-xs font-semibold text-slate-500">trabajadores</span>
                </p>
              </div>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Palmtree className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Total Días en Período
                </p>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  {metricas.totalDias}{" "}
                  <span className="text-xs font-semibold text-slate-500">días tomados</span>
                </p>
              </div>
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                  Período Consultado
                </p>
                <p className="text-sm font-black text-slate-900 mt-1 truncate" title={periodoTexto}>
                  {periodoTexto}
                </p>
              </div>
            </div>
          </div>

          {/* TABLA DE PREVISUALIZACIÓN */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Previsualización de la Cartola ({vacacionesFiltradas.length} registros)
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {periodoTexto}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-blue-600 border-t-transparent mb-2"></div>
                <p>Cargando previsualización de la cartola...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-xs text-red-600 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ) : vacacionesFiltradas.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Palmtree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 text-sm">
                  No se registraron vacaciones en este período
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Prueba cambiando el mes, ampliando el rango de fechas o seleccionando otra sede.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/90 text-[10px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">N°</th>
                      <th className="px-3.5 py-2.5">Trabajador / Cargo</th>
                      <th className="px-3.5 py-2.5">RUT</th>
                      <th className="px-3.5 py-2.5 text-center">Sede</th>
                      <th className="px-3.5 py-2.5">Desde</th>
                      <th className="px-3.5 py-2.5">Hasta</th>
                      <th className="px-3.5 py-2.5 text-center">Días Tomados</th>
                      <th className="px-3.5 py-2.5 text-center">Saldo Actual</th>
                      <th className="px-3.5 py-2.5">Estado</th>
                      <th className="px-3.5 py-2.5">Observación / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vacacionesFiltradas.map((v, idx) => (
                      <tr key={v.id || idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3.5 py-2 font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="font-bold text-slate-900">{v.nombre}</div>
                          <div className="text-[10px] text-slate-400">{v.cargo || "—"}</div>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {v.rut || "—"}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.sede === "PUQ"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {v.sede || "PMC"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 font-medium text-slate-700 whitespace-nowrap">
                          {fmtDate(v.desde)}
                        </td>
                        <td className="px-3.5 py-2 font-medium text-slate-700 whitespace-nowrap">
                          {fmtDate(v.hasta)}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                            {v.dias} {v.dias === 1 ? "día" : "días"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                              v.saldo_disponible < 0
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {v.saldo_disponible != null ? `${Number(v.saldo_disponible).toFixed(2)} d` : "—"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.estado === "CONFIRMADO"
                                ? "bg-emerald-100 text-emerald-800"
                                : v.estado === "AJUSTE"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {v.estado}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 max-w-[200px] truncate" title={v.detalle || ""}>
                          <span className="text-slate-600 text-[11px]">
                            {v.detalle || <span className="text-slate-400 italic">confirmado</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER CON ACCIONES DE DESCARGA */}
        <div className="p-4 md:px-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Listo para exportar: <strong className="text-slate-700 font-bold">{vacacionesFiltradas.length}</strong> vacaciones ({metricas.totalDias} días)
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            {/* Descargar Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || vacacionesFiltradas.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              title="Descargar planilla Excel estructurada"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Excel
            </button>

            {/* Descargar PDF */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting || vacacionesFiltradas.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              title="Descargar Cartola oficial en PDF con formato membretado"
            >
              <FileText className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
