"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  Building2,
  Calendar,
  FileText,
  Search,
  ExternalLink,
  Tag,
  AlertCircle,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  Download,
  Clock,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  CreditCard,
  ShieldCheck,
  Folder,
  FolderOpen,
} from "lucide-react";
import { BarChart, LineChart, PieChart } from "@mui/x-charts";
import { makeHeaders } from "@/lib/api";
import { generarReporteFinancieroPDF } from "@/components/proyectos/ReporteFinancieroPdf";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function money(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getTipoDocLabel(tipo) {
  const t = Number(tipo);
  if (t === 33) return "Factura Electrónica (33)";
  if (t === 34) return "Factura Exenta (34)";
  if (t === 61) return "Nota de Crédito (61)";
  if (t === 56) return "Nota de Débito (56)";
  if (t === 52) return "Guía de Despacho (52)";
  return `Doc. Tipo ${tipo || "—"}`;
}

export default function ReporteFinancieroPage({ params }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedChartMonth, setSelectedChartMonth] = useState("ALL");

  // Filtros de facturas
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProv, setFilterProv] = useState("ALL");
  const [filterTipoDoc, setFilterTipoDoc] = useState("ALL");
  const [filterImputacion, setFilterImputacion] = useState("ALL");

  // Estado de acordeón por mes (cerrados por defecto)
  const [expandedMonths, setExpandedMonths] = useState({});

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;

    async function loadReporte() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API}/proyectos/${id}/reporte-financiero`, {
          headers: makeHeaders(session),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Error al cargar el reporte financiero");
        }

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error cargando reporte financiero:", err);
        setError(err.message || "Ocurrió un error inesperado al obtener los datos");
      } finally {
        setLoading(false);
      }
    }

    loadReporte();
  }, [id, session, status]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    try {
      setDownloadingPdf(true);
      await generarReporteFinancieroPDF({ data });
    } catch (err) {
      console.error("Error al generar PDF:", err);
      alert("Ocurrió un error al generar el PDF del reporte financiero.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const proyecto = data?.proyecto || {};
  const kpis = data?.kpis || {};
  const costeo = data?.costeo || {};
  const timeline = data?.timeline || {};
  const facturas = data?.facturas || [];
  const comprasPorProveedor = data?.comprasPorProveedor || [];

  // Agrupación semanal de compras para el gráfico de barras
  const comprasPorSemana = useMemo(() => {
    const map = new Map();

    function getMonday(date) {
      const d = new Date(date);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    }

    facturas.forEach((f) => {
      if (!f.fecha) return;
      const d = new Date(f.fecha);
      if (isNaN(d.getTime())) return;

      const monday = getMonday(d);
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

      const y = monday.getUTCFullYear();
      const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
      const day = String(monday.getUTCDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      const monthKey = `${y}-${m}`;

      const label = `${day}/${m}`;
      const rango = `${day}/${m} - ${String(sunday.getUTCDate()).padStart(2, "0")}/${String(sunday.getUTCMonth() + 1).padStart(2, "0")}`;

      const isNC = Number(f.tipo_doc) === 61;
      const monto = isNC ? -Number(f.total || 0) : Number(f.total || 0);

      const current = map.get(key) || {
        semanaKey: key,
        monthKey,
        semanaLabel: label,
        rango,
        total: 0,
        cantidad: 0,
      };

      current.total += monto;
      current.cantidad += 1;
      map.set(key, current);
    });

    let runningAccum = 0;
    return Array.from(map.values())
      .sort((a, b) => a.semanaKey.localeCompare(b.semanaKey))
      .map((s) => {
        runningAccum += s.total;
        return {
          ...s,
          acumulado: runningAccum,
        };
      });
  }, [facturas]);

  // Lista de meses disponibles para filtrar el gráfico de semanas
  const mesesDisponiblesSemanas = useMemo(() => {
    const map = new Map();
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    comprasPorSemana.forEach((s) => {
      if (s.monthKey && !map.has(s.monthKey)) {
        const [y, m] = s.monthKey.split("-");
        const monthIdx = parseInt(m, 10) - 1;
        map.set(s.monthKey, `${mesesNombres[monthIdx]} ${y}`);
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, label]) => ({ key, label }));
  }, [comprasPorSemana]);

  // Semanas filtradas por mes
  const comprasPorSemanaFiltradas = useMemo(() => {
    if (selectedChartMonth === "ALL") return comprasPorSemana;
    return comprasPorSemana.filter((s) => s.monthKey === selectedChartMonth);
  }, [comprasPorSemana, selectedChartMonth]);

  // Procesamiento seguro de compras mes a mes para el gráfico superior
  const comprasPorMes = useMemo(() => {
    const raw = data?.comprasPorMes || [];
    let acc = 0;
    return raw.map((m) => {
      const tot = Number(m.total || 0);
      acc += tot;
      return {
        ...m,
        total: tot,
        acumulado: (m.acumulado !== undefined && m.acumulado !== null) ? Number(m.acumulado) : acc,
        presupuesto: Number(costeo.compras?.plan || 0),
      };
    });
  }, [data?.comprasPorMes, costeo.compras?.plan]);

  // Filtrado de facturas
  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      const matchSearch =
        !searchTerm ||
        f.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.rut?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchProv = filterProv === "ALL" || f.proveedor === filterProv;

      const matchTipo =
        filterTipoDoc === "ALL" ||
        (filterTipoDoc === "33" && Number(f.tipo_doc) === 33) ||
        (filterTipoDoc === "34" && Number(f.tipo_doc) === 34) ||
        (filterTipoDoc === "61" && Number(f.tipo_doc) === 61);

      const matchImp =
        filterImputacion === "ALL" ||
        (filterImputacion === "DIRECTO" && f.origen?.includes("Directo")) ||
        (filterImputacion === "COSTEO" && f.origen?.includes("Costeo"));

      return matchSearch && matchProv && matchTipo && matchImp;
    });
  }, [facturas, searchTerm, filterProv, filterTipoDoc, filterImputacion]);

  // Agrupación mensual con subfilas de facturas para la tabla acordeón
  const mesesAgrupados = useMemo(() => {
    const map = new Map();
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    facturasFiltradas.forEach((f) => {
      const d = f.fecha ? new Date(f.fecha) : null;
      const key = d && !isNaN(d.getTime())
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
        : "SIN_FECHA";
      const label = d && !isNaN(d.getTime())
        ? `${mesesNombres[d.getUTCMonth()]} ${d.getUTCFullYear()}`
        : "Sin Fecha Asignada";

      const isNC = Number(f.tipo_doc) === 61;
      const monto = isNC ? -Number(f.total || 0) : Number(f.total || 0);
      const neto = isNC ? -Number(f.subtotal || 0) : Number(f.subtotal || 0);
      const iva = isNC ? -Number(f.iva || 0) : Number(f.iva || 0);

      const current = map.get(key) || {
        mesKey: key,
        mesLabel: label,
        total: 0,
        subtotal: 0,
        iva: 0,
        facturas: [],
      };

      current.total += monto;
      current.subtotal += neto;
      current.iva += iva;
      current.facturas.push(f);
      map.set(key, current);
    });

    let runningAccum = 0;
    return Array.from(map.values())
      .sort((a, b) => a.mesKey.localeCompare(b.mesKey))
      .map((m) => {
        runningAccum += m.total;
        return {
          ...m,
          acumulado: runningAccum,
          facturas: m.facturas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
        };
      });
  }, [facturasFiltradas]);

  // Manejo de acordeón
  const toggleMonth = (mesKey) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [mesKey]: !prev[mesKey],
    }));
  };

  const expandAllMonths = () => {
    const next = {};
    mesesAgrupados.forEach((m) => {
      next[m.mesKey] = true;
    });
    setExpandedMonths(next);
  };

  const collapseAllMonths = () => {
    setExpandedMonths({});
  };

  // Lista única de proveedores para el select
  const proveedoresList = useMemo(() => {
    const set = new Set();
    facturas.forEach((f) => {
      if (f.proveedor) set.add(f.proveedor);
    });
    return Array.from(set).sort();
  }, [facturas]);

  const gastoPromedioPorFactura = useMemo(() => {
    if (facturas.length === 0) return 0;
    return Math.round(Number(kpis.montoTotalCompras || 0) / facturas.length);
  }, [facturas, kpis.montoTotalCompras]);

  const pctComprasSobreVenta = useMemo(() => {
    const v = Number(kpis.montoTotalVentaNeto || 0);
    const c = Number(kpis.montoTotalCompras || 0);
    if (v <= 0) return 0;
    return Number(((c / v) * 100).toFixed(1));
  }, [kpis.montoTotalVentaNeto, kpis.montoTotalCompras]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 animate-bounce">
          <DollarSign size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Cargando Reporte Financiero...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Sincronizando cobranzas, compras RCV y costeos planificados del proyecto...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full p-6 bg-red-50/60 rounded-2xl border border-red-200 text-center">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={22} />
          </div>
          <h3 className="text-base font-bold text-red-900">Error al Cargar Reporte</h3>
          <p className="text-xs text-red-700 mt-1 mb-4">{error || "No se encontraron datos"}</p>
          <div className="flex gap-2 justify-center">
            <Link
              href={`/proyectos/${id}`}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Volver al Proyecto
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 font-sans text-slate-800 animate-in fade-in duration-300">
      {/* Header Superior */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs backdrop-blur-md bg-white/90">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/proyectos/${id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
                >
                  <ArrowLeft size={14} /> Volver
                </Link>
                {proyecto.nroCotizacion && (
                  <span className="text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                    COT-{proyecto.nroCotizacion}
                  </span>
                )}
                <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  {proyecto.estado || "ACTIVO"}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                Reporte Financiero
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Building2 size={14} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">{proyecto.nombre}</span>
                {proyecto.cliente?.nombre && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="w-full sm:w-auto">
                      Cliente: <strong className="text-slate-700">{proyecto.cliente.nombre}</strong>
                      {proyecto.cliente.rut && (
                        <span className="text-slate-400 font-mono text-[11px] ml-1">({proyecto.cliente.rut})</span>
                      )}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 disabled:opacity-60 cursor-pointer"
                title="Generar y descargar informe ejecutivo en PDF"
              >
                {downloadingPdf ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    <span className="truncate">PDF…</span>
                  </>
                ) : (
                  <>
                    <Download size={14} className="shrink-0" />
                    <span className="truncate">Descargar PDF</span>
                  </>
                )}
              </button>

              <Link
                href={`/proyectos/${id}/devengado`}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs border border-slate-200"
              >
                <TrendingUp size={14} className="shrink-0" />
                <span className="truncate">Devengado</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 w-full">
        {/* =========================================================================
            1) 4 RECUADROS GRANDES (KPIS EJECUTIVOS - 2x2 EN MÓVIL)
        ========================================================================= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {/* 1. Venta Total Neta */}
          <div className="bg-gradient-to-br from-white to-blue-50/40 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                  1. Venta Total (100%)
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <DollarSign size={15} />
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 block">Total Cotizado (Neto)</span>
              <div className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-0.5 sm:mt-1 truncate">
                {money(kpis.montoTotalVentaNeto)}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[10px] sm:text-[11px] text-slate-500 font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
              <span>Bruto:</span>
              <strong className="text-slate-900 font-bold">{money(kpis.montoTotalVentaBruto)}</strong>
            </div>
          </div>

          {/* 2. Cobranza (Percibido y Saldo por Cobrar) */}
          <div className="bg-gradient-to-br from-white to-amber-50/20 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-200/70 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                  2. Cobranza
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <CreditCard size={15} />
                </div>
              </div>

              {/* Percibido */}
              <div className="pb-2 border-b border-amber-100/70">
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 block">
                  Percibido ({kpis.porcentajeCobrado || 0}%)
                </span>
                <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
                  {money(kpis.montoCobradoNeto)}
                </div>
              </div>

              {/* Por Cobrar */}
              <div className="pt-2">
                <span className="text-[10px] sm:text-[11px] font-medium text-amber-800 block">
                  Por Cobrar ({kpis.porcentajePendiente || 0}%)
                </span>
                <div className="text-base sm:text-xl font-black text-amber-900 tracking-tight mt-0.5 truncate">
                  {money(kpis.saldoPorCobrarNeto)}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] sm:text-[11px] text-slate-500 font-medium flex items-center justify-between">
              <span>Bruto Saldo:</span>
              <strong className="text-amber-900 font-bold">{money(kpis.saldoPorCobrarBruto)}</strong>
            </div>
          </div>

          {/* 3. Compras Realizadas */}
          <div className="bg-gradient-to-br from-white to-indigo-50/30 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 bg-indigo-100/80 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                  3. Compras RCV ({pctComprasSobreVenta}%)
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <TrendingUp size={15} />
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 block">Gasto Facturas Compras</span>
              <div className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-0.5 sm:mt-1 truncate">
                {money(kpis.montoTotalCompras)}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[10px] sm:text-[11px] text-slate-500 font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
              <span>Presupuesto:</span>
              <strong className="text-slate-900 font-bold">{money(costeo.compras?.plan)}</strong>
            </div>
          </div>

          {/* 4. Utilidad Real */}
          <div className="bg-gradient-to-br from-white to-emerald-50/40 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                  4. Utilidad Real (Compras)
                </span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <BarChart3 size={15} />
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 block">Venta Neta − Total Compras</span>
              <div className={`text-lg sm:text-2xl lg:text-3xl font-black tracking-tight mt-0.5 sm:mt-1 truncate ${
                kpis.utilidadReal >= 0 ? "text-emerald-700" : "text-red-600"
              }`}>
                {money(kpis.utilidadReal)}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[10px] sm:text-[11px] font-medium flex items-center justify-between">
              <span>Margen Real: <strong className={kpis.margenRealPct >= 0 ? "text-emerald-700" : "text-red-600"}>{kpis.margenRealPct || 0}%</strong></span>
              <span className="text-slate-400 text-[9px] sm:text-[10px]">Plan: {kpis.margenPlanPct || 0}%</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            DESGLOSE DE COSTEOS Y PRESUPUESTO (COMPRAS Y HH DE COTIZACIÓN)
        ========================================================================= */}
        <section className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Briefcase size={16} />
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Desglose de Costeos y Presupuesto Cotizado
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Comparativa de costos presupuestados en la venta frente a compras reales.
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <span>Presupuesto Costeos:</span>
              <span className="font-bold text-slate-900">
                {money(costeo.total?.costoPlan)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Tarjeta 1: Compras y Materiales */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    🛒 Compras y Materiales
                  </span>
                  <span className={`text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                    Number(costeo.compras?.porcentajeConsumido || 0) > 100
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {costeo.compras?.porcentajeConsumido || 0}% consumido
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Costeo Planificado:</span>
                    <strong className="text-slate-900">{money(costeo.compras?.plan)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Gasto Real Facturas:</span>
                    <strong className="text-slate-900">{money(costeo.compras?.real)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-semibold">
                    <span>Saldo a Favor:</span>
                    <span className="text-emerald-700 font-bold">
                      +{money(costeo.compras?.diferencia)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, costeo.compras?.porcentajeConsumido || 0)}%` }}
                ></div>
              </div>
            </div>

            {/* Tarjeta 2: Horas Hombre (HH Cotizadas) */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    ⏱️ Mano de Obra (HH)
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {costeo.hh?.horasPlan || 0} hrs plan
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Presupuesto HH:</span>
                    <strong className="text-slate-900">{money(costeo.hh?.plan)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Horas Vendidas:</span>
                    <strong className="text-slate-900">{costeo.hh?.horasPlan || 0} horas</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-semibold">
                    <span>Tarifa Estimada:</span>
                    <span className="text-purple-700 font-bold">
                      {costeo.hh?.horasPlan > 0 ? money(Math.round(costeo.hh.plan / costeo.hh.horasPlan)) + "/hr" : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="h-full transition-all duration-500 rounded-full bg-purple-600" style={{ width: "100%" }}></div>
              </div>
            </div>

            {/* Tarjeta 3: Totales de Costo & Utilidad Planificada */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    📊 Costeo Total & Margen
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Margen Plan: {costeo.total?.margenPlanPct || 0}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Presupuesto Costos:</span>
                    <strong className="text-slate-900">{money(costeo.total?.costoPlan)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Venta Neta Cotizada:</span>
                    <strong className="text-slate-900">{money(kpis.montoTotalVentaNeto)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-semibold">
                    <span>Utilidad Proyectada:</span>
                    <strong className="text-emerald-700 font-bold">{money(costeo.total?.utilidadPlan)}</strong>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="h-full transition-all duration-500 rounded-full bg-emerald-600" style={{ width: "100%" }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2) EVOLUCIÓN DEL GASTO EN EL TIEMPO (SEMANA A SEMANA CON FILTRO DE MES)
        ========================================================================= */}
        <section className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-700">
                  <BarChart3 size={16} />
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Evolución y Ritmo Semanal del Gasto (Compras)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribución del gasto en compras agrupado por semanas de ejecución.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filtro por mes para semanas */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                <Filter size={12} className="text-slate-400" />
                <select
                  value={selectedChartMonth}
                  onChange={(e) => setSelectedChartMonth(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-transparent border-0 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Todas las semanas</option>
                  {mesesDisponiblesSemanas.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {timeline.fechaPrimeraFactura && timeline.fechaUltimaFactura && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px]">
                  <Calendar size={12} className="text-slate-400" />
                  {fmtDate(timeline.fechaPrimeraFactura)} → {fmtDate(timeline.fechaUltimaFactura)}
                </span>
              )}
            </div>
          </div>

          {/* Tarjetas de Métricas de Apoyo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-1">
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 block">Total Compras</span>
              <span className="text-sm sm:text-base lg:text-lg font-black text-slate-900 truncate block">{money(kpis.montoTotalCompras)}</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 block">Presupuesto</span>
              <span className="text-sm sm:text-base lg:text-lg font-black text-blue-700 truncate block">{money(costeo.compras?.plan)}</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 block">Semanas Visibles</span>
              <span className="text-sm sm:text-base lg:text-lg font-black text-slate-900 truncate block">{comprasPorSemanaFiltradas.length} semanas</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 block">Total Documentos</span>
              <span className="text-sm sm:text-base lg:text-lg font-black text-slate-900">{facturas.length} docs</span>
            </div>
          </div>

          {/* Gráfico BarChart agrupado por Semana */}
          {comprasPorSemanaFiltradas && comprasPorSemanaFiltradas.length > 0 ? (
            <div className="h-64 sm:h-80 w-full pt-2">
              <BarChart
                dataset={comprasPorSemanaFiltradas}
                xAxis={[
                  {
                    dataKey: "semanaLabel",
                    scaleType: "band",
                    tickLabelStyle: { fontSize: 10, fontWeight: "bold" },
                  },
                ]}
                yAxis={[
                  {
                    valueFormatter: (v) => {
                      const abs = Math.abs(v);
                      if (abs >= 1000000) return `$${(v / 1000000).toFixed(1).replace(".0", "")}M`;
                      if (abs >= 1000) return `$${Math.round(v / 1000)}k`;
                      return `$${v}`;
                    },
                    tickLabelStyle: { fontSize: 10 },
                  },
                ]}
                series={[
                  {
                    dataKey: "total",
                    label: "Gasto de la Semana",
                    color: "#2563eb",
                    valueFormatter: (v) => money(v),
                  },
                ]}
                slotProps={{
                  legend: {
                    direction: "row",
                    position: { vertical: "top", horizontal: "right" },
                    padding: 0,
                  },
                }}
                margin={{ left: 55, right: 15, top: 25, bottom: 35 }}
              />
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No hay compras registradas en el mes seleccionado.
            </div>
          )}
        </section>

        {/* =========================================================================
            3) COMPRAS POR PROVEEDOR
        ========================================================================= */}
        <section className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="p-1.5 sm:p-2 rounded-xl bg-purple-50 text-purple-700">
                  <PieIcon size={16} />
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Concentración de Compras por Proveedor
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Desglose de montos y concentración por cada proveedor asignado al proyecto.
              </p>
            </div>

            <span className="self-start sm:self-auto px-2.5 py-1 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-xl border border-purple-100">
              {comprasPorProveedor.length} Proveedores
            </span>
          </div>

          {comprasPorProveedor && comprasPorProveedor.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Donut Chart */}
              <div className="lg:col-span-5 h-56 sm:h-72 w-full flex items-center justify-center">
                <PieChart
                  series={[
                    {
                      data: comprasPorProveedor.slice(0, 7).map((p, idx) => ({
                        id: idx,
                        value: p.total,
                        label: p.proveedor.length > 18 ? p.proveedor.slice(0, 18) + "…" : p.proveedor,
                      })),
                      innerRadius: 40,
                      outerRadius: 85,
                      paddingAngle: 3,
                      cornerRadius: 6,
                      highlightScope: { fade: "global", highlight: "item" },
                      faded: { innerRadius: 30, additionalRadius: -10, color: "gray" },
                    },
                  ]}
                  margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              </div>

              {/* Lista de Proveedores */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
                {comprasPorProveedor.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[160px] sm:max-w-[180px]">
                      <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
                      <span className="font-bold text-xs text-slate-800 truncate" title={p.proveedor}>
                        {p.proveedor}
                      </span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-black text-xs text-slate-900">{money(p.total)}</span>
                      <span className="text-[10px] text-slate-400 ml-1 font-bold">
                        {p.porcentaje}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No hay compras asignadas para calcular distribución por proveedor.
            </div>
          )}
        </section>

        {/* =========================================================================
            4) LISTA DETALLADA DE FACTURAS AGRUPADAS POR MES (DROPDOWN / ACORDEÓN)
        ========================================================================= */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 flex flex-col gap-3.5 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-700">
                    <FileText size={16} />
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Detalle de Compras y Facturas por Mes
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Facturas agrupadas por período mensual con desglose desplegable, subtotales y acumulados.
                </p>
              </div>

              {/* Botones Expandir / Colapsar Todos */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={expandAllMonths}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Expandir Todos
                </button>
                <button
                  type="button"
                  onClick={collapseAllMonths}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Colapsar Todos
                </button>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
              {/* Buscador */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar folio, proveedor, RUT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Filtro Proveedor */}
              <div>
                <select
                  value={filterProv}
                  onChange={(e) => setFilterProv(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="ALL">Todos los proveedores</option>
                  {proveedoresList.map((p, idx) => (
                    <option key={idx} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Tipo Doc */}
              <div>
                <select
                  value={filterTipoDoc}
                  onChange={(e) => setFilterTipoDoc(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="ALL">Todos los tipos de doc.</option>
                  <option value="33">Factura Electrónica (33)</option>
                  <option value="34">Factura Exenta (34)</option>
                  <option value="61">Nota de Crédito (61)</option>
                </select>
              </div>

              {/* Filtro Imputación */}
              <div>
                <select
                  value={filterImputacion}
                  onChange={(e) => setFilterImputacion(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="ALL">Todas las imputaciones</option>
                  <option value="DIRECTO">Directo al Proyecto</option>
                  <option value="COSTEO">Vía Costeo de Venta</option>
                </select>
              </div>
            </div>
          </div>

          {/* Acordeón Mensual con Facturas */}
          <div className="divide-y divide-slate-200/80">
            {mesesAgrupados && mesesAgrupados.length > 0 ? (
              mesesAgrupados.map((mes) => {
                const isExpanded = Boolean(expandedMonths[mes.mesKey]);
                return (
                  <div key={mes.mesKey} className="bg-white">
                    {/* Fila Cabecera del Mes (Clickable Dropdown Header) */}
                    <button
                      type="button"
                      onClick={() => toggleMonth(mes.mesKey)}
                      className={`w-full p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-left transition-all duration-200 cursor-pointer ${
                        isExpanded ? "bg-blue-50/50 border-l-4 border-l-primary shadow-xs" : "hover:bg-slate-50/90"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                          isExpanded ? "bg-blue-100/80 text-primary scale-105" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}>
                          <ChevronRight
                            size={16}
                            className={`transition-transform duration-300 ease-out ${
                              isExpanded ? "rotate-90 text-primary" : "rotate-0 text-slate-600"
                            }`}
                          />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                              {mes.mesLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              {mes.facturas.length} {mes.facturas.length === 1 ? "factura" : "facturas"}
                            </span>
                          </div>
                          <span className="text-[10px] sm:text-[11px] text-slate-400 block">
                            {isExpanded ? "Toca para colapsar" : "Toca para ver facturas"}
                          </span>
                        </div>
                      </div>

                      {/* Resumen Financiero del Mes (2x2 en móvil, flex en desktop) */}
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-6 text-xs text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium">Neto del Mes</span>
                          <strong className="text-slate-700 font-bold text-xs">{money(mes.subtotal)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium">IVA del Mes</span>
                          <span className="text-slate-500 font-medium text-xs">{money(mes.iva)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-indigo-600 block font-bold">Total del Mes</span>
                          <strong className="text-xs sm:text-sm font-black text-indigo-600">{money(mes.total)}</strong>
                        </div>
                        <div className="sm:pl-4 sm:border-l sm:border-slate-200">
                          <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium">Gasto Acumulado</span>
                          <strong className="text-slate-900 font-black text-xs">{money(mes.acumulado)}</strong>
                        </div>
                      </div>
                    </button>

                    {/* Subtabla con Facturas Desplegadas */}
                    {isExpanded && (
                      <div className="bg-slate-50/60 p-2.5 sm:p-5 border-t border-slate-100 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                          <table className="w-full text-left text-xs text-slate-600 min-w-[620px]">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-2.5">Folio / Doc</th>
                                <th className="px-4 py-2.5">Proveedor / RUT</th>
                                <th className="px-4 py-2.5">Fecha</th>
                                <th className="px-4 py-2.5">Imputación</th>
                                <th className="px-4 py-2.5 text-right">Neto</th>
                                <th className="px-4 py-2.5 text-right">IVA</th>
                                <th className="px-4 py-2.5 text-right">Total</th>
                                <th className="px-4 py-2.5 text-center">PDF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {mes.facturas.map((f, idx) => {
                                const isNC = Number(f.tipo_doc) === 61;
                                return (
                                  <tr
                                    key={f.id || idx}
                                    className={`hover:bg-slate-50/80 transition-colors ${
                                      isNC ? "bg-red-50/30" : ""
                                    }`}
                                  >
                                    <td className="px-4 py-2.5">
                                      <div className="font-extrabold text-slate-900">
                                        #{f.folio || f.numero}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {getTipoDocLabel(f.tipo_doc)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="font-bold text-slate-800 truncate max-w-[180px]" title={f.proveedor}>
                                        {f.proveedor}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {f.rut || "—"}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                                      {fmtDate(f.fecha)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        <Tag size={10} /> {f.origen || "Directo"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-600">
                                      {money(f.subtotal)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-500">
                                      {money(f.iva)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                                      <span className={isNC ? "text-red-600" : "text-slate-900"}>
                                        {isNC ? `-${money(f.total)}` : money(f.total)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      {f.factura_url ? (
                                        <a
                                          href={f.factura_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition-colors"
                                          title="Ver Factura PDF"
                                        >
                                          <ExternalLink size={12} /> Ver
                                        </a>
                                      ) : (
                                        <span className="text-slate-300 text-[10px]">Sin PDF</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 sm:p-12 text-center text-slate-400">
                <p className="text-xs sm:text-sm font-semibold">No se encontraron facturas con los filtros actuales</p>
              </div>
            )}
          </div>

          {/* Footer Resumen Total */}
          <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-700">
            <div>
              Total Documentos: <strong>{facturasFiltradas.length}</strong> facturas
            </div>
            <div>
              Total Compras Imputadas: <strong className="text-slate-900 text-xs sm:text-sm font-black ml-1">{money(kpis.montoTotalCompras)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

