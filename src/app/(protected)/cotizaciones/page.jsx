"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { makeHeaders } from "@/lib/api";

// ✅ Mantén tus dialogs actuales
import EditCotizacionDialog from "@/components/cotizaciones/EditCotizacionDialog";
import ImportCotizacionPdfDialog from "@/components/cotizaciones/ImportCotizacionPdfDialog";
import CotizacionesSnack from "@/components/cotizaciones/CotizacionesSnack";
import CotizacionesState from "@/components/cotizaciones/CotizacionesState";
import CotizacionesSummary from "@/components/cotizaciones/CotizacionesSummary";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// ✅ Nuevos componentes (los creas abajo)
import CotizacionesTableLight from "@/components/cotizaciones/CotizacionesTableLight";
import CotizacionDrawerLight from "@/components/cotizaciones/CotizacionDrawerLight";
import ImportRcvPanel from "@/components/compras/ImportRcvPanel";
import ReporteCotizacionesModal from "@/components/cotizaciones/ReporteCotizacionesModal";
import * as XLSX from "xlsx";

const MESES = [
  { val: 1, label: "Enero" },
  { val: 2, label: "Febrero" },
  { val: 3, label: "Marzo" },
  { val: 4, label: "Abril" },
  { val: 5, label: "Mayo" },
  { val: 6, label: "Junio" },
  { val: 7, label: "Julio" },
  { val: 8, label: "Agosto" },
  { val: 9, label: "Septiembre" },
  { val: 10, label: "Octubre" },
  { val: 11, label: "Noviembre" },
  { val: 12, label: "Diciembre" },
];

const currentY = dayjs().year();
const YEARS = [currentY - 1, currentY, currentY + 1];

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function pickEmpresaId(session) {
  const u = session?.user || session || {};
  return u.empresaId ?? u.empresa_id ?? u.empresa?.id ?? u.empresa ?? null;
}

function pickToken(session) {
  const u = session?.user || session || {};
  return u.accessToken || session?.accessToken || "";
}

function makeHeadersMultipart(session) {
  const token = pickToken(session);
  const empresaId = pickEmpresaId(session);
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

function formatCurrency(val) {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return "$" + Number(digits).toLocaleString("es-CL");
}

function parseCurrency(val) {
  if (!val) return "";
  return String(val).replace(/\D/g, "");
}

export default function CotizacionesPage() {
  const { data: session, status } = useSession();

  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI: drawer + seleccion
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // UI: filters
  const [fAsunto, setFAsunto] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fNumero, setFNumero] = useState("");
  const [periodo, setPeriodo] = useState("todo");
  const [refDate, setRefDate] = useState(new Date());
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMontoMin, setFilterMontoMin] = useState("");
  const [filterMontoMax, setFilterMontoMax] = useState("");

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    cotizaciones.forEach(c => {
      const d = c.creada_en ? new Date(c.creada_en) : null;
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [cotizaciones]);

  const handleScaleSelect = (scale) => {
    setPeriodo(scale);
    setRefDate(new Date());
  };

  const handleYearSelect = (e) => {
    const nd = new Date(refDate);
    nd.setFullYear(Number(e.target.value));
    setRefDate(nd);
  };

  const handleMonthSelect = (e) => {
    const nd = new Date(refDate);
    nd.setMonth(Number(e.target.value));
    setRefDate(nd);
  };

  const handleWeekSelect = (e) => {
    const offset = Number(e.target.value);
    const nd = new Date();
    nd.setDate(nd.getDate() + (offset * 7));
    setRefDate(nd);
  };

  // Dialogs
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openImport, setOpenImport] = useState(false);
  const [openReport, setOpenReport] = useState(false);

  // RCV Import
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState(null);

  // Snackbar (mantienes tu snack MUI)
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showSnack = (severity, message) =>
    setSnack({ open: true, severity, message });

  const closeSnack = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((s) => ({ ...s, open: false }));
  };

  const openEditCot = (id) => {
    setEditingId(id);
    setOpenEdit(true);
  };

  const fetchCotizaciones = async () => {
    if (!session) return;
    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API_URL}/cotizaciones`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al listar cotizaciones",
        );
      }

      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (!res.ok)
        throw new Error(
          data?.error || data?.detalle || "Error al listar clientes",
        );
      setClientes(Array.isArray(data) ? data : data?.data || []);
    } catch {
      setClientes([]);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchCotizaciones();
      fetchClientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ✅ IMPORTANTE: tu updateEstado (igual)
  const updateEstado = async (cotizacionId, estado, extra = {}) => {
    try {
      const res = await fetch(
        `${API_URL}/cotizaciones/${cotizacionId}/estado`,
        {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify({ estado, ...extra }),
        },
      );

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al actualizar estado",
        );
      }

      if (estado === "ACEPTADA")
        showSnack("success", "Cotización aceptada. Proyecto creado/iniciado.");
      else if (estado === "RECHAZADA")
        showSnack("success", "Cotización rechazada.");
      else showSnack("success", `Estado actualizado a ${estado}`);

      setCotizaciones((prev) =>
        prev.map((c) => {
          if (c.id !== cotizacionId) return c;
          return { ...c, ...data, items: data.items ?? c.items ?? [] };
        }),
      );
    } catch (e) {
      showSnack("error", e?.message || "Error actualizando estado");
    }
  };

  const deleteCotizacion = async (id) => {
    try {
      const res = await fetch(`${API_URL}/cotizaciones/${id}`, {
        method: "DELETE",
        headers: makeHeaders(session),
        body: JSON.stringify({}),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data?.error || data?.detalle || "Error al eliminar");
      }

      showSnack("success", "Cotización eliminada");
      // Actualizar lista local
      setCotizaciones((prev) => prev.filter((c) => c.id !== id));
      setOpenDrawer(false);
    } catch (e) {
      showSnack("error", e?.message || "Error al eliminar");
    }
  };

  const handleImportRCV = async (file) => {
    try {
      setImporting(true);
      setImportErr("");
      setImportResult(null);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_URL}/cotizaciones/import/rcv`, {
        method: "POST",
        headers: makeHeadersMultipart(session),
        body: fd,
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data?.error || data?.detalle || "Error en importación");
      }

      setImportResult(data);
      showSnack("success", `Importación exitosa: ${data.linked} vinculados, ${data.created} creados.`);
      fetchCotizaciones();
    } catch (e) {
      setImportErr(e.message);
      showSnack("error", e.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadReporteFinanciero = () => {
    try {
      if (!cotizaciones.length) {
        showSnack("warning", "No hay datos para exportar");
        return;
      }

      // Helper para calcular la fecha de pago de cotización variable
      const getPaymentDate = (c) => {
        const p = c.proyecto;
        let date = null;
        if (p) {
          const rawDate = p.fecha_fin_real || p.fecha_fin_plan;
          if (rawDate) {
            date = new Date(rawDate);
          }
        }
        if (!date) {
          // Si no tiene fecha fin de proyecto, usamos fecha del documento o de creación
          const baseDate = c.fecha_documento || c.creada_en;
          date = new Date(baseDate);
        }
        const paymentDate = new Date(date);
        const pct = c.avance_pago_pct || 0;
        
        let daysToAdd = 14; // Por defecto: 2 semanas para aceptadas u otros estados diferentes
        
        if (pct > 0 && pct < 100) {
          // Facturadas parciales: mayor 0% y menor 100% -> 2 semanas después de la fecha de entrega
          daysToAdd = 14;
        } else if (c.estado === "FACTURADA") {
          // Cotización estado facturada -> 1 semana del fin del proyecto
          daysToAdd = 7;
        } else {
          // Aceptadas u otro estado diferente -> 2 semanas del fin de proyecto
          daysToAdd = 14;
        }
        
        paymentDate.setDate(paymentDate.getDate() + daysToAdd);
        return paymentDate;
      };

      // 1. Filtrar las cotizaciones activas y no eliminadas
      // Ingresos Variables: cotizaciones aceptadas/completadas (no en borrador y no rechazada) que tienen proyecto
      const variables = cotizaciones.filter(c => {
        if (c.es_suscripcion || c.eliminado) return false;
        const isAccepted = c.estado !== 'COTIZACION' && c.estado !== 'RECHAZADA';
        const hasProject = !!c.proyecto_id || !!c.proyecto;
        return isAccepted && hasProject;
      });

      // Ingresos Fijos: servicios/arriendos recurrentes (es_suscripcion === true) no rechazados/eliminados
      const fijos = cotizaciones.filter(c => c.es_suscripcion && !c.eliminado && c.estado !== 'RECHAZADA');

      // 2. Determinar los meses presentes en el sistema
      const yearMonthsSet = new Set();

      variables.forEach(c => {
        const payDate = getPaymentDate(c);
        const y = payDate.getFullYear();
        const m = String(payDate.getMonth() + 1).padStart(2, '0');
        yearMonthsSet.add(`${y}-${m}`);
      });

      fijos.forEach(c => {
        if (c.fecha_inicio_plan) {
          const start = new Date(c.fecha_inicio_plan);
          let end = c.fecha_fin_plan ? new Date(c.fecha_fin_plan) : null;
          if (!end && c.ciclos_mensuales) {
            end = new Date(start);
            end.setMonth(start.getMonth() + c.ciclos_mensuales - 1);
          }
          if (!end) {
            end = new Date(start);
            end.setMonth(start.getMonth() + 11);
          }
          
          let current = new Date(start.getFullYear(), start.getMonth(), 1);
          const limit = new Date(end.getFullYear(), end.getMonth(), 1);
          
          while (current <= limit) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            yearMonthsSet.add(`${y}-${m}`);
            current.setMonth(current.getMonth() + 1);
          }
        }
      });

      // Ordenar cronológicamente
      const sortedYearMonths = Array.from(yearMonthsSet).sort();

      // Si no hay meses, usar por defecto el año actual
      if (sortedYearMonths.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let m = 1; m <= 12; m++) {
          const mStr = String(m).padStart(2, '0');
          sortedYearMonths.push(`${currentYear}-${mStr}`);
        }
      }

      const monthNamesSpanish = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const getLabel = (ym) => {
        const [y, m] = ym.split("-");
        const monthName = monthNamesSpanish[parseInt(m, 10) - 1];
        return `${monthName} ${y}`;
      };

      const currCell = (val) => {
        if (val === 0) return { v: 0, t: "n", z: "$#,##0" };
        if (!val) return { v: "", t: "s" };
        return { v: Number(val), t: "n", z: "$#,##0" };
      };

      const mapEstado = (est) => {
        const map = {
          COTIZACION: "Cotización",
          ACEPTADA: "Aceptada",
          ORDEN_VENTA: "Orden de Venta",
          ENTREGADO: "Entregado",
          POR_FACTURAR: "Por Facturar",
          FACTURADA: "Facturada",
          PAGADA: "Pagada",
          RECHAZADA: "Rechazada"
        };
        return map[est] || est || "";
      };

      const isMonthActive = (contract, ymKey) => {
        if (!contract.fecha_inicio_plan) return false;
        const start = new Date(contract.fecha_inicio_plan);
        const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        
        let end = contract.fecha_fin_plan ? new Date(contract.fecha_fin_plan) : null;
        if (!end && contract.ciclos_mensuales) {
          end = new Date(start);
          end.setMonth(start.getMonth() + contract.ciclos_mensuales - 1);
        }
        if (!end) {
          end = new Date(start);
          end.setMonth(start.getMonth() + 11);
        }
        const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
        
        return ymKey >= startKey && ymKey <= endKey;
      };

      const rows = [];
      const merges = [];

      // Título Principal
      merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 5 } });
      rows.push([{ v: "REPORTE FINANCIERO - PLANIFICACIÓN DE INGRESOS", t: "s" }]);
      rows.push([]);

      // --- SECCIÓN 1: INGRESOS VARIABLES ---
      merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 5 } });
      rows.push([{ v: "INGRESOS VARIABLES (Proyectos aceptados, estimado 7 días post-término)", t: "s" }]);
      
      const headersVar = [
        "ESTADO",
        "COT",
        "CLIENTE",
        "DETALLE",
        "DETALLE INGRESOS VARIABLE $",
        "MONTO neto"
      ];
      sortedYearMonths.forEach(ym => {
        headersVar.push(getLabel(ym));
      });
      rows.push(headersVar.map(h => ({ v: h, t: "s" })));

      const varTotalsByMonth = {};
      sortedYearMonths.forEach(ym => {
        varTotalsByMonth[ym] = 0;
      });
      let varTotalMontoNeto = 0;

      variables.forEach(c => {
        const payDate = getPaymentDate(c);
        const ymKey = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;
        const subtotal = c.subtotal || 0;

        const row = [
          { v: mapEstado(c.estado), t: "s" },
          { v: c.numero || "", t: "n" },
          { v: c.cliente?.nombre || "", t: "s" },
          { v: c.asunto || "", t: "s" },
          { v: (c.glosas || []).map(g => g.descripcion).filter(Boolean).join(" / ") || c.asunto || "", t: "s" },
          currCell(subtotal)
        ];

        sortedYearMonths.forEach(ym => {
          if (ym === ymKey) {
            row.push(currCell(subtotal));
            varTotalsByMonth[ym] += subtotal;
            varTotalMontoNeto += subtotal;
          } else {
            row.push({ v: "", t: "s" });
          }
        });

        rows.push(row);
      });

      // Fila de Totales de Variables
      const totalRowVar = [
        { v: "", t: "s" },
        { v: "", t: "s" },
        { v: "TOTAL", t: "s" },
        { v: "", t: "s" },
        { v: "", t: "s" },
        currCell(varTotalMontoNeto)
      ];
      sortedYearMonths.forEach(ym => {
        totalRowVar.push(currCell(varTotalsByMonth[ym]));
      });
      rows.push(totalRowVar);

      rows.push([]);
      rows.push([]);

      // --- SECCIÓN 2: INGRESOS FIJOS ---
      merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 5 } });
      rows.push([{ v: "INGRESOS FIJOS (Servicios y arriendos recurrentes)", t: "s" }]);

      const headersFijos = [
        "ESTADO",
        "COT",
        "CLIENTE",
        "DETALLE",
        "DETALLE INGRESOS FIJOS $",
        "MONTO"
      ];
      sortedYearMonths.forEach(ym => {
        headersFijos.push(getLabel(ym));
      });
      rows.push(headersFijos.map(h => ({ v: h, t: "s" })));

      const fijosTotalsByMonth = {};
      sortedYearMonths.forEach(ym => {
        fijosTotalsByMonth[ym] = 0;
      });
      let fijosTotalMonto = 0;

      fijos.forEach(c => {
        const subtotal = c.subtotal || 0;

        const row = [
          { v: mapEstado(c.estado), t: "s" },
          { v: c.numero || "", t: "n" },
          { v: c.cliente?.nombre || "", t: "s" },
          { v: c.asunto || "", t: "s" },
          { v: (c.glosas || []).map(g => g.descripcion).filter(Boolean).join(" / ") || c.asunto || "", t: "s" },
          currCell(subtotal)
        ];

        sortedYearMonths.forEach(ym => {
          if (isMonthActive(c, ym)) {
            row.push(currCell(subtotal));
            fijosTotalsByMonth[ym] += subtotal;
            fijosTotalMonto += subtotal;
          } else {
            row.push({ v: "", t: "s" });
          }
        });

        rows.push(row);
      });

      // Fila de Totales de Fijos
      const totalRowFijos = [
        { v: "", t: "s" },
        { v: "", t: "s" },
        { v: "TOTAL", t: "s" },
        { v: "", t: "s" },
        { v: "", t: "s" },
        currCell(fijosTotalMonto)
      ];
      sortedYearMonths.forEach(ym => {
        totalRowFijos.push(currCell(fijosTotalsByMonth[ym]));
      });
      rows.push(totalRowFijos);

      rows.push([]);
      rows.push([]);

      // --- SECCIÓN 3: TOTAL GENERAL ---
      merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 5 } });
      rows.push([{ v: "TOTAL INGRESOS (VARIABLES + FIJOS)", t: "s" }]);

      const totalIngresosRow = [
        { v: "", t: "s" },
        { v: "", t: "s" },
        { v: "TOTAL GENERAL", t: "s" },
        { v: "", t: "s" },
        { v: "", t: "s" },
        currCell(varTotalMontoNeto + fijosTotalMonto)
      ];
      sortedYearMonths.forEach(ym => {
        totalIngresosRow.push(currCell(varTotalsByMonth[ym] + fijosTotalsByMonth[ym]));
      });
      rows.push(totalIngresosRow);

      // Crear workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Asignar merges
      ws['!merges'] = merges;

      // Anchura de columnas
      ws['!cols'] = [
        { wch: 18 }, // ESTADO
        { wch: 10 }, // COT
        { wch: 30 }, // CLIENTE
        { wch: 30 }, // DETALLE
        { wch: 40 }, // DETALLE INGRESOS
        { wch: 18 }, // MONTO neto
        ...sortedYearMonths.map(() => ({ wch: 16 })) // meses
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Reporte Financiero");
      XLSX.writeFile(wb, `Reporte_Financiero_${dayjs().format("YYYY-MM-DD")}.xlsx`);
      showSnack("success", "Reporte financiero descargado");
    } catch (e) {
      showSnack("error", "Error al exportar: " + e.message);
    }
  };

  // Selección actual para el drawer
  const selected = useMemo(
    () => cotizaciones.find((c) => c.id === selectedId) || null,
    [cotizaciones, selectedId],
  );

  const filtered = useMemo(() => {
    return (cotizaciones || []).filter((c) => {
      // Excluir suscripciones/arriendos del módulo estándar de cotizaciones
      if (c.es_suscripcion) return false;

      // Filtro fecha
      if (periodo !== "todo") {
        const d = c.creada_en ? new Date(c.creada_en) : null;
        if (!d) return false;
        if (periodo === "semanal") {
          const refD = new Date(refDate);
          const day = refD.getDay();
          const diff = refD.getDate() - day + (day === 0 ? -6 : 1);
          const start = new Date(refD.setDate(diff));
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          if (d < start || d > end) return false;
        } else if (periodo === "mensual") {
          if (d.getFullYear() !== refDate.getFullYear() || d.getMonth() !== refDate.getMonth()) return false;
        } else if (periodo === "anual") {
          if (d.getFullYear() !== refDate.getFullYear()) return false;
        }
      }
      // Estado
      if (filterEstado && c?.estado !== filterEstado) return false;
      // Nº COT
      if (fNumero.trim() && !String(c?.numero ?? "").toLowerCase().includes(fNumero.trim().toLowerCase())) return false;
      // Asunto
      if (fAsunto.trim()) {
        const asunto = String(c?.asunto || c?.descripcion || "").toLowerCase();
        if (!asunto.includes(fAsunto.trim().toLowerCase())) return false;
      }
      // Cliente (nombre o RUT)
      if (fCliente.trim()) {
        const nombre = String(c?.cliente?.nombre || "").toLowerCase();
        const rut = String(c?.cliente?.rut || "").toLowerCase();
        const t = fCliente.trim().toLowerCase();
        if (!nombre.includes(t) && !rut.includes(t)) return false;
      }
      // Monto
      if (filterMontoMin.trim()) {
        const val = Number(filterMontoMin);
        const sub = c.subtotal || 0;
        const tot = c.total || 0;
        if (sub < val && tot < val) return false;
      }
      if (filterMontoMax.trim()) {
        const val = Number(filterMontoMax);
        const sub = c.subtotal || 0;
        const tot = c.total || 0;
        if (sub > val && tot > val) return false;
      }

      return true;
    });
  }, [cotizaciones, periodo, refDate, filterEstado, fNumero, fAsunto, fCliente, filterMontoMin, filterMontoMax]);

  const hasFilters = periodo !== "todo" || filterEstado || fNumero || fAsunto || fCliente || filterMontoMin || filterMontoMax;
  const clearFilters = () => {
    setFAsunto("");
    setFCliente("");
    setFNumero("");
    setFilterEstado("");
    setPeriodo("todo");
    setRefDate(new Date());
    setFilterMontoMin("");
    setFilterMontoMax("");
  };

  const stateUI = (
    <CotizacionesState status={status} loading={loading} err={err} />
  );
  if (status !== "authenticated") return stateUI;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header como el ejemplo */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Cotizaciones</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCotizaciones}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <span className="text-lg">⟳</span> Actualizar
          </button>

          <button
            onClick={() => setOpenReport(true)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>📊</span> Reporte General
          </button>

          <button
            onClick={downloadReporteFinanciero}
            disabled={cotizaciones.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>💵</span> Reporte Financiero
          </button>

          <button
            onClick={() => setOpenImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <span className="text-lg">⬆</span> Importar PDF
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6 md:p-8">
        <p className="text-slate-500 mb-6">
          Gestiona estados, revisa detalle y exporta a PDF de manera centralizada.
        </p>

        <CotizacionesSummary cotizaciones={filtered} filterEstado={filterEstado} />

        {/* Filtros */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Nº COT */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">#</span>
            <input
              value={fNumero}
              onChange={(e) => setFNumero(e.target.value)}
              className="w-full pl-7 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Nº Cotización"
              type="text"
            />
          </div>

          {/* Asunto */}
          <input
            value={fAsunto}
            onChange={(e) => setFAsunto(e.target.value)}
            className="w-full px-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            placeholder="Asunto / descripción"
            type="text"
          />

          {/* Cliente */}
          <input
            value={fCliente}
            onChange={(e) => setFCliente(e.target.value)}
            className="w-full px-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            placeholder="Cliente (nombre o RUT)"
            type="text"
          />

          {/* Estado */}
          <div className="relative">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full h-[46px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer"
            >
              <option value="">Todos los estados</option>
              <option value="COTIZACION">Cotización</option>
              <option value="ACEPTADA">Aceptada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="ORDEN_VENTA">Orden de Venta</option>
              <option value="POR_FACTURAR">Por Facturar</option>
              <option value="FACTURADA">Facturada</option>
              <option value="PAGADA">Pagada</option>
              <option value="ENTREGADO">Entregado</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
          </div>
        </div>

        {/* Monto Min/Max row */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              value={formatCurrency(filterMontoMin)}
              onChange={(e) => setFilterMontoMin(parseCurrency(e.target.value))}
              className="w-full pl-7 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium"
              placeholder="Monto mínimo..."
              type="text"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              value={formatCurrency(filterMontoMax)}
              onChange={(e) => setFilterMontoMax(parseCurrency(e.target.value))}
              className="w-full pl-7 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium"
              placeholder="Monto máximo..."
              type="text"
            />
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="mb-5 flex flex-col md:flex-row gap-3 items-center">
          <nav className="flex bg-slate-200/60 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => handleScaleSelect("todo")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition ${
                periodo === "todo" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => handleScaleSelect("semanal")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition ${
                periodo === "semanal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => handleScaleSelect("mensual")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition ${
                periodo === "mensual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => handleScaleSelect("anual")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition ${
                periodo === "anual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Año
            </button>
          </nav>

          <div className="flex gap-2 w-full md:w-auto">
            {periodo === "semanal" && (
              <div className="relative w-full md:w-44">
                <select
                  onChange={handleWeekSelect}
                  defaultValue={0}
                  className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                >
                  <option value={0}>Esta semana</option>
                  <option value={-1}>Semana pasada</option>
                  <option value={-2}>Hace 2 semanas</option>
                  <option value={-3}>Hace 3 semanas</option>
                  <option value={-4}>Hace 4 semanas</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
              </div>
            )}

            {periodo === "mensual" && (
              <div className="relative w-full md:w-40">
                <select
                  value={refDate.getMonth()}
                  onChange={handleMonthSelect}
                  className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                >
                  {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
              </div>
            )}

            {(periodo === "mensual" || periodo === "anual") && (
              <div className="relative w-full md:w-32">
                <select
                  value={refDate.getFullYear()}
                  onChange={handleYearSelect}
                  className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
              </div>
            )}
          </div>
        </div>

        {/* Conteo + limpiar */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs text-slate-400">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <span>✕</span> Limpiar filtros
            </button>
          )}
        </div>

        {/* Import RCV Section */}
        <div className="mb-8">
          <ImportRcvPanel
            importing={importing}
            importErr={importErr}
            importResult={importResult}
            onImportFile={handleImportRCV}
            onClear={() => {
              setImportErr("");
              setImportResult(null);
            }}
          />
        </div>

        {/* Estado general (loading/error/empty) */}
        <CotizacionesState
          status={status}
          loading={loading}
          err={err}
          empty={!loading && !filtered.length && !err}
        />

        {/* Tabla */}
        {!loading && filtered.length > 0 && (
          <CotizacionesTableLight
            cotizaciones={filtered}
            onRowClick={(cot) => {
              setSelectedId(cot.id);
              setOpenDrawer(true);
            }}
            onEdit={(id) => openEditCot(id)}
          />
        )}
      </div>

      {/* Drawer + Overlay */}
      <CotizacionDrawerLight
        open={openDrawer}
        cotizacion={selected}
        onClose={() => setOpenDrawer(false)}
        onEdit={(id) => openEditCot(id)}
        onUpdateEstado={updateEstado}
        onDelete={deleteCotizacion}
        showSnack={showSnack}
        onRefresh={() => fetchCotizaciones()}
      />

      {/* Dialogs que ya tienes */}
      <ImportCotizacionPdfDialog
        open={openImport}
        onClose={() => setOpenImport(false)}
        session={session}
        clientes={clientes}
        showSnack={showSnack}
        onCreated={() => fetchCotizaciones()}
      />

      <EditCotizacionDialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        session={session}
        cotizacionId={editingId}
        clientes={clientes}
        onUpdated={() => {
          showSnack("success", "Cotización actualizada");
          fetchCotizaciones();
        }}
      />

      <ReporteCotizacionesModal
        open={openReport}
        onClose={() => setOpenReport(false)}
        cotizaciones={filtered}
        session={session}
      />

      <CotizacionesSnack snack={snack} onClose={closeSnack} />
    </div>
  );
}
