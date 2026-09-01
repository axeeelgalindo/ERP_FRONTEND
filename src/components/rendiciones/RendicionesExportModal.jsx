"use client";

import React, { useState, useMemo } from "react";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

function fmtDateDMY(v) {
  if (!v) return "-";
  const d = dayjs(v);
  if (!d.isValid()) return "-";
  return d.format("DD-MM-YYYY");
}

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function formatNombreTrabajador(nombreRaw) {
  if (!nombreRaw) return "TRABAJADOR";
  const str = String(nombreRaw).trim();
  if (str.includes(",")) {
    const parts = str.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      // Invierte 'APELLIDOS, NOMBRES' a 'NOMBRES APELLIDOS'
      return `${parts[1]} ${parts[0]}`.toUpperCase();
    }
  }
  return str.toUpperCase();
}

export default function RendicionesExportModal({
  open,
  onClose,
  rendiciones = [],
}) {
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("ALL"); // 'ALL' or '1'..'12'
  const [selectedEmpleado, setSelectedEmpleado] = useState("ALL");
  const [selectedCentroCosto, setSelectedCentroCosto] = useState("ALL");
  const [selectedEstado, setSelectedEstado] = useState("ALL");
  const [isExporting, setIsExporting] = useState(false);

  // Lista de años disponibles (a partir de los datos o los últimos 5 años)
  const availableYears = useMemo(() => {
    const set = new Set();
    set.add(String(currentYear));
    set.add(String(currentYear - 1));
    rendiciones.forEach((r) => {
      if (r.creado_en) {
        const y = dayjs(r.creado_en).year();
        if (y) set.add(String(y));
      }
      (r.items || []).forEach((it) => {
        if (it.fecha) {
          const y = dayjs(it.fecha).year();
          if (y) set.add(String(y));
        }
      });
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [rendiciones, currentYear]);

  // Lista de empleados únicos disponibles
  const availableEmpleados = useMemo(() => {
    const map = new Map();
    rendiciones.forEach((r) => {
      const id = r.empleado?.id || r.empleado_id;
      const rawNombre =
        r.empleado?.usuario?.nombre ||
        r.solicitante?.nombre ||
        r.empleado?.cargo ||
        r.usuario?.nombre ||
        "Sin Asignar";
      const nombre = formatNombreTrabajador(rawNombre);
      const rut = r.empleado?.rut || r.empleado?.usuario?.rut || "";
      if (id && !map.has(id)) {
        map.set(id, { id, label: rut ? `${nombre} (${rut})` : nombre });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [rendiciones]);

  // Lista de centros de costo / proyectos únicos disponibles
  const availableCentros = useMemo(() => {
    const set = new Set();
    rendiciones.forEach((r) => {
      if (r.destino === "PROYECTO") {
        if (r.proyecto?.nombre) set.add(`PROYECTO: ${r.proyecto.nombre}`);
        else set.add("PROYECTO");
      } else if (r.destino) {
        const cc = `${r.destino} ${r.centro_costo || ""}`.trim();
        if (cc) set.add(cc);
      }
    });
    return Array.from(set).sort();
  }, [rendiciones]);

  // Calcular correlativo por empleado (1, 2, 3... ordenado cronológicamente)
  const employeeCorrelatives = useMemo(() => {
    const map = new Map(); // rendicionId -> correlativo (1, 2, 3...)
    const byEmp = new Map();

    rendiciones.forEach((r) => {
      const empId = r.empleado_id || r.empleado?.id || "unknown";
      if (!byEmp.has(empId)) byEmp.set(empId, []);
      byEmp.get(empId).push(r);
    });

    byEmp.forEach((list) => {
      const sorted = [...list].sort(
        (a, b) => new Date(a.creado_en || 0) - new Date(b.creado_en || 0)
      );
      sorted.forEach((r, idx) => {
        map.set(r.id, idx + 1);
      });
    });

    return map;
  }, [rendiciones]);

  // Filtrar rendiciones y generar sábana de filas de gasto
  const { filteredRows, totalMonto, totalRendicionesCount } = useMemo(() => {
    const rows = [];
    const rendicionesMatched = new Set();

    rendiciones.forEach((r) => {
      // Filtro Estado
      if (selectedEstado !== "ALL" && r.estado !== selectedEstado) return;

      // Filtro Empleado
      const empId = r.empleado?.id || r.empleado_id;
      if (selectedEmpleado !== "ALL" && empId !== selectedEmpleado) return;

      // Centro de costo de la rendición
      let centroCostoRendicion = "";
      if (r.destino === "PROYECTO") {
        centroCostoRendicion = r.proyecto?.nombre
          ? `PROYECTO: ${r.proyecto.nombre}`
          : "PROYECTO";
      } else {
        centroCostoRendicion = `${r.destino || "ADMIN"} ${r.centro_costo || ""}`.trim().toUpperCase();
      }

      // Filtro Centro de Costo
      if (
        selectedCentroCosto !== "ALL" &&
        centroCostoRendicion !== selectedCentroCosto
      ) {
        return;
      }

      const rawNombreTrabajador =
        r.empleado?.usuario?.nombre ||
        r.solicitante?.nombre ||
        r.usuario?.nombre ||
        r.empleado?.cargo ||
        "TRABAJADOR";
      const trabajadorNombre = formatNombreTrabajador(rawNombreTrabajador);

      // N° de rendición = Correlativo del trabajador (ej. 1, 2, 3...)
      const numRendicion = employeeCorrelatives.get(r.id) || 1;

      let rendicionHasMatchingItem = false;

      // 1. Ítems manuales de rendición
      (r.items || []).forEach((it) => {
        const itemDate = it.fecha ? dayjs(it.fecha) : dayjs(r.creado_en);
        if (selectedYear !== "ALL" && itemDate.isValid()) {
          if (String(itemDate.year()) !== selectedYear) return;
        }
        if (selectedMonth !== "ALL" && itemDate.isValid()) {
          if (String(itemDate.month() + 1) !== selectedMonth) return;
        }

        const rutProv = (it.rut_proveedor || it.rut || "").trim();
        const provName = (it.proveedor || "").trim();
        
        // Detalle: categoría del gasto y/o descripción
        let detalleStr = "";
        const cat = (it.categoria || "").trim();
        const desc = (it.descripcion || "").trim();
        if (cat && desc && cat.toUpperCase() !== desc.toUpperCase()) {
          detalleStr = `${cat} - ${desc}`.toUpperCase();
        } else if (cat) {
          detalleStr = cat.toUpperCase();
        } else if (desc) {
          detalleStr = desc.toUpperCase();
        } else {
          detalleStr = "SIN DETALLE";
        }

        rendicionHasMatchingItem = true;
        rows.push({
          numRendicion,
          trabajador: trabajadorNombre,
          rut: rutProv || "SIN INFORMACION",
          proveedor: provName ? provName.toUpperCase() : "SIN INFORMACION",
          tipoDoc: (it.tipo_doc ? String(it.tipo_doc).trim() : "BOLETA").toUpperCase(),
          folio: it.folio && String(it.folio).trim() ? String(it.folio).trim() : "-",
          fecha: fmtDateDMY(it.fecha || r.creado_en),
          rawFecha: itemDate.isValid() ? itemDate.toDate() : new Date(),
          monto: Number(it.monto || 0),
          centroCosto: centroCostoRendicion,
          detalle: detalleStr,
        });
      });

      // 2. Facturas ERP vinculadas
      (r.compras || []).forEach((c) => {
        const docDate = c.fecha_docto
          ? dayjs(c.fecha_docto)
          : c.creada_en
          ? dayjs(c.creada_en)
          : dayjs(r.creado_en);

        if (selectedYear !== "ALL" && docDate.isValid()) {
          if (String(docDate.year()) !== selectedYear) return;
        }
        if (selectedMonth !== "ALL" && docDate.isValid()) {
          if (String(docDate.month() + 1) !== selectedMonth) return;
        }

        let tipoDocStr = "FACTURA";
        if (c.tipo_doc === 33) tipoDocStr = "FACTURA";
        else if (c.tipo_doc === 34) tipoDocStr = "FACTURA EXENTA";
        else if (c.tipo_doc === 39 || c.tipo_doc === 41) tipoDocStr = "BOLETA";
        else if (c.tipo_doc === 61) tipoDocStr = "NOTA DE CREDITO";
        else if (c.tipo_doc === 56) tipoDocStr = "NOTA DE DEBITO";
        else if (c.tipo_doc) tipoDocStr = String(c.tipo_doc).toUpperCase();

        let centroCostoCompra = centroCostoRendicion;
        if (c.destino && c.destino !== "PROYECTO") {
          centroCostoCompra = `${c.destino} ${c.centro_costo || ""}`.trim().toUpperCase();
        }

        const rutComp = (c.rut_proveedor || c.proveedor?.rut || "").trim();
        const provComp = (c.razon_social || c.proveedor?.nombre || "").trim();

        // Detalle de la compra
        let detalleCompraStr = "";
        const itemNames = (c.items || [])
          .map((it) => (it.item || it.tipoItem?.nombre || "").trim())
          .filter(Boolean);
        const itemsJoined = itemNames.join(", ").trim();

        const catC = (c.categoria || "").trim();
        const descC = (c.descripcion || c.comentario_destino || c.sub_destino || c.observaciones || "").trim();

        if (itemsJoined) {
          detalleCompraStr = itemsJoined.toUpperCase();
        } else if (catC && descC && catC.toUpperCase() !== descC.toUpperCase()) {
          detalleCompraStr = `${catC} - ${descC}`.toUpperCase();
        } else if (descC) {
          detalleCompraStr = descC.toUpperCase();
        } else if (catC) {
          detalleCompraStr = catC.toUpperCase();
        } else {
          detalleCompraStr = (c.razon_social || c.proveedor?.nombre)
            ? `COMPRA ${c.razon_social || c.proveedor?.nombre}`.toUpperCase()
            : "COMPRA FACTURA";
        }

        rendicionHasMatchingItem = true;
        rows.push({
          numRendicion,
          trabajador: trabajadorNombre,
          rut: rutComp || "SIN INFORMACION",
          proveedor: provComp ? provComp.toUpperCase() : "SIN INFORMACION",
          tipoDoc: tipoDocStr,
          folio: String(c.folio || c.numero || "-"),
          fecha: fmtDateDMY(c.fecha_docto || c.creada_en || r.creado_en),
          rawFecha: docDate.isValid() ? docDate.toDate() : new Date(),
          monto: Number(c.total || 0),
          centroCosto: centroCostoCompra,
          detalle: detalleCompraStr,
        });
      });

      if (rendicionHasMatchingItem) {
        rendicionesMatched.add(r.id);
      }
    });

    // Ordenar las filas por número correlativo de rendición (todos los 1 juntos, luego los 2, etc.)
    rows.sort((a, b) => {
      // 1. Agrupar por número de correlativo de rendición
      if (a.numRendicion !== b.numRendicion) {
        return a.numRendicion - b.numRendicion;
      }
      // 2. Ordenar por trabajador alfabéticamente dentro del mismo correlativo
      const cmpTrabajador = a.trabajador.localeCompare(b.trabajador);
      if (cmpTrabajador !== 0) return cmpTrabajador;
      // 3. Ordenar por fecha cronológicamente
      const timeA = a.rawFecha ? new Date(a.rawFecha).getTime() : 0;
      const timeB = b.rawFecha ? new Date(b.rawFecha).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      // 4. Folio
      return (a.folio || "").localeCompare(b.folio || "");
    });

    const sumMonto = rows.reduce((acc, curr) => acc + curr.monto, 0);

    return {
      filteredRows: rows,
      totalMonto: sumMonto,
      totalRendicionesCount: rendicionesMatched.size,
    };
  }, [
    rendiciones,
    selectedYear,
    selectedMonth,
    selectedEmpleado,
    selectedCentroCosto,
    selectedEstado,
  ]);

  if (!open) return null;

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      alert("No hay registros que coincidan con los filtros seleccionados.");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ERP";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Rendiciones", {
        views: [{ showGridLines: true }],
      });

      // 1. Cabeceras
      const headers = [
        "N° RENDICION",
        "TRABAJADOR",
        "RUT",
        "PROVEEDOR",
        "TIPO DOCU",
        "FOLIO",
        "FECHA",
        "MONTO",
        "CENTRO COSTO",
        "DETALLE",
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 24;

      // 2. Filas de datos
      filteredRows.forEach((r) => {
        worksheet.addRow([
          r.numRendicion,
          r.trabajador,
          r.rut,
          r.proveedor,
          r.tipoDoc,
          r.folio,
          r.fecha,
          r.monto,
          r.centroCosto,
          r.detalle,
        ]);
      });

      // 3. Fila de Total general
      const totalRow = worksheet.addRow([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        totalMonto,
        "",
        `${filteredRows.length} ÍTEMS EXPORTADOS`,
      ]);
      totalRow.height = 22;

      // 4. Activar Tabla con Filtros Automáticos (AutoFilter)
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: filteredRows.length + 1, column: headers.length },
      };

      // 5. Estilos de cabecera (Azul suave, negrita, centrado y bordes definidos)
      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "FF1E293B" }, // Slate 800
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E1F2" }, // Color azul acero suave
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFB4C6E7" } },
          left: { style: "thin", color: { argb: "FFB4C6E7" } },
          bottom: { style: "medium", color: { argb: "FF8EA9DB" } },
          right: { style: "thin", color: { argb: "FFB4C6E7" } },
        };
      });

      // 6. Estilos de filas de datos (Zebra striping alternando filas, bordes y alineaciones)
      filteredRows.forEach((r, idx) => {
        const rowNumber = idx + 2;
        const row = worksheet.getRow(rowNumber);
        row.height = 20;

        // Bandas alternas de color (Zebra)
        const isEven = idx % 2 === 1;
        const rowBgColor = isEven ? "FFF2F5F9" : "FFFFFFFF"; // Alternancia blanco / celeste muy suave

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: "Calibri",
            size: 9.5,
            color: { argb: "FF0F172A" },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBgColor },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          // Alineaciones según columna
          if (colNumber === 1 || colNumber === 5 || colNumber === 7) {
            // N° RENDICION, TIPO DOCU, FECHA -> Centrado
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colNumber === 6) {
            // FOLIO -> Centrado
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colNumber === 8) {
            // MONTO -> Derecha con formato moneda ($ #,##0)
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"$"#,##0';
          } else {
            // TRABAJADOR, RUT, PROVEEDOR, CENTRO COSTO, DETALLE -> Izquierda
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        });
      });

      // 7. Estilos de la fila Total general
      totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "FF0F172A" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE9EEF4" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF8EA9DB" } },
          bottom: { style: "double", color: { argb: "FF8EA9DB" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 8) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"$"#,##0';
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });

      // 8. Ajuste dinámico de los anchos de columna según el contenido exacto
      worksheet.columns.forEach((column, colIdx) => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          let val = cell.value;
          if (val !== null && val !== undefined) {
            if (typeof val === "number" && colIdx === 7) {
              const formatted = toCLP(val);
              if (formatted.length > maxLen) maxLen = formatted.length;
            } else {
              const str = String(val);
              if (str.length > maxLen) maxLen = str.length;
            }
          }
        });
        // Margen de holgura para legibilidad y botones del filtro
        column.width = Math.max(maxLen + 4, 12);
      });

      // Nombre del archivo
      let monthLabel = "TOTAL";
      if (selectedMonth !== "ALL") {
        const mesNombre = dayjs(`2026-${selectedMonth.padStart(2, "0")}-01`).format("MMMM");
        monthLabel = mesNombre.toUpperCase();
      }
      const filename = `Reporte_Rendiciones_${selectedYear}_${monthLabel}_${dayjs().format(
        "YYYYMMDD"
      )}.xlsx`;

      // 9. Descarga en navegador
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al generar el archivo Excel: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const meses = [
    { val: "ALL", label: "Todos los meses" },
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">
                table_chart
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                Exportar Reporte de Rendiciones
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Genera la sábana de gastos en formato Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Modal Body - Filters */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Período (Año y Mes) */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              1. Período
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Año */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Año
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
                >
                  <option value="ALL">Todos los años</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mes */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Mes
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
                >
                  {meses.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Filtros Secundarios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            {/* Trabajador */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                2. Trabajador
              </label>
              <select
                value={selectedEmpleado}
                onChange={(e) => setSelectedEmpleado(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Todos los trabajadores</option>
                {availableEmpleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Centro de Costo / Imputación */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                3. Centro de Costo / Proyecto
              </label>
              <select
                value={selectedCentroCosto}
                onChange={(e) => setSelectedCentroCosto(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Todos los centros / proyectos</option>
                {availableCentros.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              4. Estado de Rendición
            </label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">Todos los estados</option>
              <option value="aprobada">Solo Aprobadas</option>
              <option value="pagada">Solo Pagadas</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="en_revision">Solo En Revisión</option>
              <option value="rechazada">Solo Rechazadas</option>
            </select>
          </div>

          {/* Previsualización del Resumen a exportar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base border border-blue-100">
                {filteredRows.length}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Líneas de gasto a exportar
                </p>
                <p className="text-[11px] text-slate-500">
                  En {totalRendicionesCount} rendición(es) seleccionada(s)
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Monto Total Consolidado
              </p>
              <p className="text-base font-black text-slate-900">
                {toCLP(totalMonto)}
              </p>
            </div>
          </div>

          {/* Muestra de Columnas */}
          <div className="rounded-xl border border-dashed border-slate-200 p-3 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Columnas incluidas en el Excel:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "N° RENDICION",
                "TRABAJADOR",
                "RUT",
                "PROVEEDOR",
                "TIPO DOCU",
                "FOLIO",
                "FECHA",
                "MONTO",
                "CENTRO COSTO",
                "DETALLE",
              ].map((col) => (
                <span
                  key={col}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-2xs"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isExporting || filteredRows.length === 0}
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/10 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">
                file_download
              </span>
            )}
            Descargar Excel (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
}
