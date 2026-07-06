"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { makeHeaders } from "@/lib/api";

import EditServicioArriendoDialog from "@/components/servicios-arriendos/EditServicioArriendoDialog";
import ServiciosArriendosTable from "@/components/servicios-arriendos/ServiciosArriendosTable";
import ServicioArriendoDrawer from "@/components/servicios-arriendos/ServicioArriendoDrawer";
import CotizacionesSnack from "@/components/cotizaciones/CotizacionesSnack";
import CotizacionesState from "@/components/cotizaciones/CotizacionesState";

function clp(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99.99, n));
}

function ServiciosArriendosSummary({ cotizaciones }) {
  const curMonth = dayjs().month() + 1;
  const curYear = dayjs().year();
  const monthLabel = MESES.find(m => m.val === curMonth)?.label || "";

  const stats = useMemo(() => {
    const activeContracts = (cotizaciones || []).filter(
      c => c.es_suscripcion && c.estado === "ACEPTADA" && !c.eliminado
    );

    const allBillingQuotes = (cotizaciones || []).filter(
      c => !c.es_suscripcion && !c.eliminado
    );

    let totalMensualActivo = 0;
    let facturadoEsteMes = 0;
    let cobradoEsteMes = 0;
    let noCobradoEsteMesCount = 0;
    let noCobradoEsteMesMonto = 0;
    const noCobradoContractsList = [];

    const isThisMonth = (quote) => {
      const asuntoLower = String(quote.asunto || "").toLowerCase();
      const hasAnyMonthInAsunto = MESES.some(m => asuntoLower.includes(m.label.toLowerCase()));
      if (hasAnyMonthInAsunto) {
        const label = monthLabel.toLowerCase();
        return label && asuntoLower.includes(label) && asuntoLower.includes(String(curYear));
      }
      const d = quote.fecha_documento ? new Date(quote.fecha_documento) : new Date(quote.creada_en);
      return d.getFullYear() === curYear && (d.getMonth() + 1) === curMonth;
    };

    activeContracts.forEach(contract => {
      const glosasList = contract.glosas || [];
      const subtotalBruto = glosasList.reduce((acc, g) => acc + Number(g.monto || 0), 0);
      const descGlosasMonto = glosasList.reduce((acc, g) => {
        const bruto = Number(g.monto || 0);
        const pct = clampPct(g.descuento_pct || 0);
        return acc + (bruto * (pct / 100));
      }, 0);
      const subtotalTrasGlosas = subtotalBruto - descGlosasMonto;
      const descGeneralPct = clampPct(contract.descuento_pct || 0);
      const descGeneralMonto = subtotalTrasGlosas * (descGeneralPct / 100);
      const subtotalNeto = contract.subtotal ?? (subtotalTrasGlosas - descGeneralMonto);
      const iva = contract.iva ?? 0;
      const totalMensual = subtotalNeto + iva;

      totalMensualActivo += totalMensual;

      const relatedForThisMonth = allBillingQuotes.filter(
        q => (q.parent_id === contract.id || (contract.proyecto_id && q.proyecto_id === contract.proyecto_id)) && isThisMonth(q)
      );

      const isPaid = relatedForThisMonth.some(q => q.estado === "PAGADA");
      const isBilled = relatedForThisMonth.length > 0;

      if (isBilled) {
        relatedForThisMonth.forEach(q => {
          facturadoEsteMes += Number(q.total || 0);
          if (q.estado === "PAGADA") {
            cobradoEsteMes += Number(q.total || 0);
          }
        });
      }

      if (!isPaid) {
        noCobradoEsteMesCount++;
        noCobradoEsteMesMonto += totalMensual;
        noCobradoContractsList.push(contract);
      }
    });

    return {
      countActive: activeContracts.length,
      totalMensualActivo,
      facturadoEsteMes,
      cobradoEsteMes,
      noCobradoEsteMesCount,
      noCobradoEsteMesMonto,
      noCobradoContractsList
    };
  }, [cotizaciones, curMonth, curYear, monthLabel]);

  const cards = [
    {
      title: "Contratos Activos",
      subtitle: "Mensualidad total activa",
      value: String(stats.countActive),
      extra: clp(stats.totalMensualActivo),
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      icon: "📋",
    },
    {
      title: "Facturado Este Mes",
      subtitle: `Cobros emitidos en ${monthLabel}`,
      value: clp(stats.facturadoEsteMes),
      iconBg: "bg-indigo-50",
      iconText: "text-indigo-600",
      icon: "💵",
    },
    {
      title: "Cobrado Este Mes",
      subtitle: `Abonos recibidos en ${monthLabel}`,
      value: clp(stats.cobradoEsteMes),
      valueClass: "text-emerald-600",
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      icon: "✅",
    },
    {
      title: "No Cobrado Este Mes",
      subtitle: `Pendiente en ${monthLabel}`,
      value: String(stats.noCobradoEsteMesCount),
      extra: clp(stats.noCobradoEsteMesMonto),
      valueClass: "text-rose-600",
      iconBg: "bg-rose-50",
      iconText: "text-rose-600",
      icon: "⚠️",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg} ${c.iconText}`}>
                <span className="text-[20px]">{c.icon}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
                  {c.title}
                </p>
                <span className="text-[9px] font-medium block text-slate-500 mt-0.5 normal-case tracking-normal">
                  {c.subtitle}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-col">
              <h3 className={`text-2xl font-black tracking-tight ${c.valueClass || "text-slate-800"}`}>
                {c.value}
              </h3>
              {c.extra && (
                <span className="text-xs text-slate-500 font-semibold mt-1">
                  Monto: {c.extra}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {stats.noCobradoContractsList.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <span>⚠️</span>
            <span>Contratos activos pendientes de pago este mes ({monthLabel} {curYear}):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.noCobradoContractsList.map(c => (
              <span key={c.id} className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-slate-700">
                Contrato #{c.numero ? (c.numero >= 1000000 ? c.numero - 1000000 : c.numero) : ""} — {c.cliente?.nombre} ({clp(c.total)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

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

export default function ServiciosArriendosPage() {
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

  // Snackbar
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
          data?.error || data?.detalle || "Error al listar servicios/arriendos",
        );
      }

      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Error al cargar servicios/arriendos");
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
  }, [status]);

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
        showSnack("success", "Servicio/Arriendo aceptado. Contrato activo.");
      else if (estado === "RECHAZADA")
        showSnack("success", "Servicio/Arriendo rechazado/cancelado.");
      else showSnack("success", `Estado actualizado a ${estado}`);

      setCotizaciones((prev) =>
        prev.map((c) => {
          if (c.id !== cotizacionId) return c;
          return { ...c, ...data, glosas: data.glosas ?? c.glosas ?? [] };
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

      showSnack("success", "Servicio/Arriendo eliminado");
      setCotizaciones((prev) => prev.filter((c) => c.id !== id));
      setOpenDrawer(false);
    } catch (e) {
      showSnack("error", e?.message || "Error al eliminar");
    }
  };

  // Selección actual para el drawer
  const selected = useMemo(
    () => cotizaciones.find((c) => c.id === selectedId) || null,
    [cotizaciones, selectedId],
  );

  const filtered = useMemo(() => {
    return (cotizaciones || []).filter((c) => {
      // Filtrar SOLO suscripciones/arriendos
      if (!c.es_suscripcion) return false;

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
      return true;
    });
  }, [cotizaciones, periodo, refDate, filterEstado, fNumero, fAsunto, fCliente]);

  const hasFilters = periodo !== "todo" || filterEstado || fNumero || fAsunto || fCliente;
  const clearFilters = () => {
    setFAsunto("");
    setFCliente("");
    setFNumero("");
    setFilterEstado("");
    setPeriodo("todo");
    setRefDate(new Date());
  };

  const stateUI = (
    <CotizacionesState status={status} loading={loading} err={err} />
  );
  if (status !== "authenticated") return stateUI;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Servicios</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCotizaciones}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <span className="text-lg">⟳</span> Actualizar
          </button>

          <button
            onClick={() => {
              setEditingId(null);
              setOpenEdit(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <span className="text-lg">＋</span> Nuevo Servicio/Arriendo
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6 md:p-8">
        <p className="text-slate-500 mb-6">
          Modulo especializado de contratos, servicios mensuales y arriendos recurrentes.
        </p>

        <ServiciosArriendosSummary cotizaciones={cotizaciones} />

        {/* Filtros */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Nº DOC */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">#</span>
            <input
              value={fNumero}
              onChange={(e) => setFNumero(e.target.value)}
              className="w-full pl-7 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Nº Contrato"
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
              <option value="COTIZACION">Borrador de Servicio</option>
              <option value="ACEPTADA">Proyecto Andando</option>
              <option value="RECHAZADA">Servicio Cancelado</option>
              <option value="FACTURADA">Facturada</option>
              <option value="PAGADA">Pagada</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
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
            {filtered.length} contrato{filtered.length !== 1 ? "s" : ""}
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

        {/* Estado general (loading/error/empty) */}
        <CotizacionesState
          status={status}
          loading={loading}
          err={err}
          empty={!loading && !filtered.length && !err}
          emptyMessage="No hay servicios registrados aún."
        />

        {/* Tabla */}
        {!loading && filtered.length > 0 && (
          <ServiciosArriendosTable
            servicios={filtered}
            onRowClick={(serv) => {
              setSelectedId(serv.id);
              setOpenDrawer(true);
            }}
          />
        )}
      </div>

      {/* Drawer */}
      <ServicioArriendoDrawer
        open={openDrawer}
        servicio={selected}
        allCotizaciones={cotizaciones}
        onClose={() => setOpenDrawer(false)}
        onEdit={(id) => openEditCot(id)}
        onUpdateEstado={updateEstado}
        onDelete={deleteCotizacion}
        showSnack={showSnack}
        onRefresh={() => fetchCotizaciones()}
      />

      {/* Dialogo Edición/Creación */}
      <EditServicioArriendoDialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        session={session}
        cotizacionId={editingId}
        clientes={clientes}
        onUpdated={() => {
          showSnack("success", "Servicio/Arriendo guardado correctamente");
          fetchCotizaciones();
        }}
      />

      <CotizacionesSnack snack={snack} onClose={closeSnack} />
    </div>
  );
}
