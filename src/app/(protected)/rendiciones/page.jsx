"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

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
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [q, setQ] = useState("");

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

      if (estadoFilter !== "ALL") params.append("estado", estadoFilter);
      if (q) params.append("q", q);

      const res = await fetch(`${API}/rendiciones?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Error al cargar rendiciones");

      setData(payload.data || []);
      setTotal(payload.total || 0);

      // ✅ Mantener el drawer sincronizado si está abierto
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
  }, [session, status, page, estadoFilter, q]);

  const kpis = useMemo(() => {
    const list = data || [];
    const totalGeneral = list.reduce((acc, r) => acc + (r.monto_total || 0), 0);
    const totalMontoPagado = list.reduce((acc, r) => acc + (r.monto_pagado || 0), 0);
    const totalSaldoPendiente = list.reduce((acc, r) => {
      const saldo = (r.monto_total || 0) - (r.monto_pagado || 0);
      return acc + (saldo > 0 ? saldo : 0);
    }, 0);

    return { totalGeneral, totalMontoPagado, totalSaldoPendiente };
  }, [data]);

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

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <header className="mb-10 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Rendiciones</h1>
          <p className="text-slate-500 font-medium mt-1">
            Visualiza y gestiona las devoluciones de gastos de tus empleados.
          </p>
        </div>

        <button 
          onClick={() => setOpenCreate(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95"
        >
          <span className="text-lg">＋</span>
          Nueva Rendición
        </button>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <input
              type="text"
              placeholder="Buscar por RUT o descripción..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          >
            <option value="ALL">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="pagada">Pagadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {err && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3">
            <span>⚠️</span> {err}
          </div>
        )}

        <RendicionKpis kpis={kpis} loading={loading} />

        <RendicionTable
          rows={data}
          loading={loading}
          onVerRendicion={handleVerRendicion}
          onPagar={handlePagar}
        />

        {data.length > 0 && (
          <div className="mt-8 flex justify-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Mostrando {data.length} de {total} resultados
            </p>
          </div>
        )}
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
