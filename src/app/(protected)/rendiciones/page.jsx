"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import 'dayjs/locale/es';

import RendicionKpis from "@/components/rendiciones/RendicionKpis";
import RendicionTable from "@/components/rendiciones/RendicionTable";
import RendicionDetailDrawer from "@/components/rendiciones/RendicionDetailDrawer";
import IndependentRendicionModal from "@/components/rendiciones/IndependentRendicionModal";

const API = process.env.NEXT_PUBLIC_API_URL;

function pickEmpresaId(session) {
  return session?.user?.empresaId ?? session?.user?.empresa?.id ?? null;
}

function makeHeaders(session) {
  const token = session?.accessToken || session?.user?.accessToken || "";
  const empresaId = pickEmpresaId(session);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
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

export default function RendicionesPage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Filters – individual fields
  const [fEmpleado, setFEmpleado] = useState("");
  const [fProyecto, setFProyecto] = useState("");
  const [fEstado, setFEstado] = useState("ALL");
  const [fFecha, setFFecha] = useState(null);

  const [selectedRendicion, setSelectedRendicion] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function loadData() {
    if (status === "loading") return;
    if (!session) return;

    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`${API}/rendiciones?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Error al cargar rendiciones");

      setData(payload.data || []);
      setTotal(payload.total || 0);

      if (openDrawer && selectedRendicion) {
        const updated = payload.data?.find(r => r.id === selectedRendicion.id);
        if (updated) setSelectedRendicion(updated);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, page]);

  // ── Client-side filtering ──────────────────────────────────────
  const filtered = useMemo(() => {
    return (data || []).filter((r) => {
      if (fEstado !== "ALL" && r.estado !== fEstado) return false;
      if (fFecha && fFecha.isValid()) {
        const d = r.creado_en ? new Date(r.creado_en) : null;
        if (!d) return false;
        if (fFecha.month() + 1 !== d.getMonth() + 1) return false;
        if (fFecha.year() !== d.getFullYear()) return false;
      }
      if (fEmpleado.trim()) {
        const nombre = String(r.empleado?.usuario?.nombre || r.solicitante?.nombre || "").toLowerCase();
        const rut = String(r.empleado?.usuario?.rut || r.solicitante?.rut || "").toLowerCase();
        const t = fEmpleado.trim().toLowerCase();
        if (!nombre.includes(t) && !rut.includes(t)) return false;
      }
      if (fProyecto.trim()) {
        const proy = String(r.proyecto?.nombre || r.centro_costo || "").toLowerCase();
        if (!proy.includes(fProyecto.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [data, fEstado, fFecha, fEmpleado, fProyecto]);

  const hasFilters = fEstado !== "ALL" || fFecha || fEmpleado || fProyecto;
  const clearFilters = () => { setFEstado("ALL"); setFFecha(null); setFEmpleado(""); setFProyecto(""); };

  const kpis = useMemo(() => {
    const list = filtered;
    const totalGeneral = list.reduce((acc, r) => acc + (r.monto_total || 0), 0);
    const totalMontoPagado = list.reduce((acc, r) => acc + (r.monto_pagado || 0), 0);
    const totalSaldoPendiente = list.reduce((acc, r) => {
      const saldo = (r.monto_total || 0) - (r.monto_pagado || 0);
      return acc + (saldo > 0 ? saldo : 0);
    }, 0);
    return { totalGeneral, totalMontoPagado, totalSaldoPendiente };
  }, [filtered]);

  async function handleUpdateStatus(id, newStatus) {
    if (!session) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API}/rendiciones/${id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
        body: JSON.stringify({ estado: newStatus }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || "Error al actualizar estado");
      }
      await loadData();
      setOpenDrawer(false);
      setSelectedRendicion(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdatePaidAmount(id, amount) {
    if (!session) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API}/rendiciones/${id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
        body: JSON.stringify({ monto_pagado: amount }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || "Error al actualizar monto pagado");
      }
      await loadData();
      setOpenDrawer(false);
      setSelectedRendicion(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  }

  function handleVerRendicion(r) {
    setSelectedRendicion(r);
    setOpenDrawer(true);
  }

  function handlePagar(r) {
    const balance = Math.abs((r.monto_total || 0) - (r.monto_entregado || 0));
    if (confirm(`¿Marcar la rendición RD-${String(r.id).slice(-6).toUpperCase()} como PAGADA por un total de ${toCLP(balance)}?`)) {
      handleUpdatePaidAmount(r.id, balance);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 px-6 md:px-10 pt-8 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Rendiciones</h1>
            <p className="text-slate-400 text-sm mt-1">Gestión inteligente de gastos y reembolsos.</p>
          </div>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-100 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Nueva Rendición
          </button>
        </div>
      </div>

      <div className="px-6 md:px-10 -mt-6">
        {/* KPI Cards superpuestos al header */}
        <RendicionKpis kpis={kpis} loading={loading} />

        {/* Bloque de filtros */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Empleado */}
            <input
              value={fEmpleado}
              onChange={(e) => setFEmpleado(e.target.value)}
              className="w-full px-4 h-[42px] border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Empleado (nombre o RUT)"
              type="text"
            />

            {/* Proyecto */}
            <input
              value={fProyecto}
              onChange={(e) => setFProyecto(e.target.value)}
              className="w-full px-4 h-[42px] border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Proyecto / centro de costo"
              type="text"
            />

            {/* Estado */}
            <div className="relative">
              <select
                value={fEstado}
                onChange={(e) => { setFEstado(e.target.value); setPage(1); }}
                className="w-full h-[42px] px-3 pr-9 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="pagada">Pagada</option>
                <option value="en_revision">En revisión</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
            </div>

            {/* Mes/Año */}
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                views={['year', 'month']}
                label="Mes y Año"
                format="MM/YYYY"
                value={fFecha}
                onChange={(v) => setFFecha(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.75rem',
                        backgroundColor: '#f8fafc',
                        height: '42px',
                      }
                    }
                  },
                  field: { clearable: true, onClear: () => setFFecha(null) }
                }}
              />
            </LocalizationProvider>
          </div>

          {/* Resultado + limpiar */}
          <div className="flex items-center justify-between mt-3">
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
        </div>

        <div className="space-y-4 pb-10">
          {err && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium flex items-center gap-3">
              <span className="material-symbols-outlined">error</span> {err}
            </div>
          )}

          <RendicionTable
            rows={filtered}
            loading={loading}
            onVerRendicion={handleVerRendicion}
            onPagar={handlePagar}
          />

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2 items-center">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  if (totalPages > 7) {
                    if (p > 1 && p < totalPages && (p < page - 1 || p > page + 1)) {
                      if (p === page - 2 || p === page + 2) return <span key={p} className="px-1 text-slate-300">...</span>;
                      return null;
                    }
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[36px] h-9 px-2 rounded-lg text-xs font-bold transition-all ${page === p
                        ? "bg-slate-900 text-white shadow-lg"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}

          {total > 0 && (
            <div className="mt-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Mostrando {filtered.length} de {total} rendiciones
              </p>
            </div>
          )}
        </div>
      </div>

      <RendicionDetailDrawer
        open={openDrawer}
        rendicion={selectedRendicion}
        onClose={() => setOpenDrawer(false)}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePaidAmount={handleUpdatePaidAmount}
        onRefresh={loadData}
        loading={updating}
        session={session}
      />

      <IndependentRendicionModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        session={session}
        apiBase={API}
        onSaved={loadData}
      />
    </div>
  );
}
