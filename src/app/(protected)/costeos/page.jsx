"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import VentasHeader from "@/components/ventas/VentasHeader";
import VentasSummary from "@/components/ventas/VentasSummary";
import VentasTable from "@/components/ventas/VentasTable";
import CosteosDashboard from "@/components/ventas/CosteosDashboard";

import NuevaVentaDialog from "@/components/ventas/NuevaVentaDialog";
import ReporteCosteoModal from "@/components/ventas/ReporteCosteoModal";

// ✅ usa SOLO el nuevo modal (paso a paso)
import { CotizacionFromVentasDialog } from "@/components/ventas/cotizacion";

// import DisableVentaModal from "@/components/ventas/DisableVentaModal";
import { VentaDeleteDialog } from "@/components/ventas/modalForm";

import { useVentas } from "@/components/ventas/hooks/useVentas";
import { exportGeneralPDF } from "@/components/ventas/utils/exportGeneralPDF";

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

export default function VentasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const empresaNombreFromToken = useMemo(
    () => session?.user?.empresa?.nombre || session?.user?.empresaNombre || "",
    [session],
  );

  const empresaIdFromToken = useMemo(
    () => session?.user?.empresa?.id || session?.user?.empresaId || null,
    [session],
  );

  const empresaLabel =
    empresaNombreFromToken && empresaIdFromToken
      ? `${empresaNombreFromToken} (${empresaIdFromToken})`
      : empresaNombreFromToken || empresaIdFromToken || "Sin empresa";

  const { ventas, loadingVentas, errorVentas, fetchVentas } = useVentas({
    session,
    status,
  });

  const [viewMode, setViewMode] = useState("list"); // "list" | "dashboard"
  const [openNew, setOpenNew] = useState(false);

  // Filtros unificados
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [periodo, setPeriodo] = useState("todo");
  const [refDate, setRefDate] = useState(new Date());
  const [filterMontoMin, setFilterMontoMin] = useState("");
  const [filterMontoMax, setFilterMontoMax] = useState("");

  const [exportingPdf, setExportingPdf] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    (ventas || []).forEach(v => {
      const d = v.fecha ? new Date(v.fecha) : null;
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [ventas]);

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

  const filteredVentas = useMemo(() => {
    return (ventas || []).filter((v) => {
      // 1. Filtro fecha
      if (periodo !== "todo") {
        const d = v.fecha ? new Date(v.fecha) : null;
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

      // 2. Filtro estado (vinculado a cotización o proyectado)
      if (filterEstado) {
        if (filterEstado === "PROYECTADO") {
          if (!v.esProyectado) return false;
        } else if (filterEstado === "SIN_COTIZACION") {
          if (v.ordenVenta || v.ordenVentaId) return false;
        } else {
          if (v.ordenVenta?.estado !== filterEstado) return false;
        }
      }

      // 3. Filtro texto (q)
      if (q.trim()) {
        const qq = q.trim().toLowerCase();
        const desc = String(v?.descripcion || "").toLowerCase();
        const num = String(v?.numero ?? "").toLowerCase();
        const id = String(v?.id || "").toLowerCase();
        const client = String(v?.Cliente?.nombre || v?.Cliente?.rut || "").toLowerCase();
        if (!desc.includes(qq) && !num.includes(qq) && !id.includes(qq) && !client.includes(qq)) return false;
      }

      // 4. Filtro montos (subtotal o total)
      const totalVenta = v.totalFinal != null ? Number(v.totalFinal) : (v.detalles || []).reduce((s, d) => s + (Number(d.total ?? d.ventaTotal) || 0), 0);
      const totalCosto = v.costoFinal != null ? Number(v.costoFinal) : (v.detalles || []).reduce((s, d) => s + (Number(d.costoTotal) || 0), 0);

      if (filterMontoMin.trim()) {
        const val = Number(filterMontoMin);
        if (totalVenta < val && totalCosto < val) return false;
      }
      if (filterMontoMax.trim()) {
        const val = Number(filterMontoMax);
        if (totalVenta > val && totalCosto > val) return false;
      }

      return true;
    });
  }, [ventas, periodo, refDate, filterEstado, q, filterMontoMin, filterMontoMax]);

  const hasFilters =
    periodo !== "todo" ||
    filterEstado !== "" ||
    q !== "" ||
    filterMontoMin !== "" ||
    filterMontoMax !== "";

  const clearFilters = () => {
    setQ("");
    setFilterEstado("");
    setPeriodo("todo");
    setRefDate(new Date());
    setFilterMontoMin("");
    setFilterMontoMax("");
  };

  const handleExportPdf = () => {
    exportGeneralPDF(filteredVentas, periodo === "todo" ? "todo" : "filtrado", q, session, setExportingPdf);
  };

  // ✅ EDIT
  const [openEdit, setOpenEdit] = useState(false);
  const [ventaIdEditing, setVentaIdEditing] = useState(null);

  // Reporte Costeo Modal
  const [openReport, setOpenReport] = useState(false);
  const [ventaReport, setVentaReport] = useState(null);

  const onOpenReport = useCallback((venta) => {
    if (!venta?.id) return;
    setVentaReport(venta);
    setOpenReport(true);
  }, []);

  // Cotización
  const [openCot, setOpenCot] = useState(false);
  const [preselectedVentaIds, setPreselectedVentaIds] = useState([]);

  const onCreateCotizacionFromVenta = useCallback((ventaId) => {
    if (!ventaId) return;
    setPreselectedVentaIds([ventaId]);
    setOpenCot(true);
  }, []);

  const openCotManual = useCallback(() => {
    setPreselectedVentaIds([]);
    setOpenCot(true);
  }, []);

  const onEditVenta = useCallback((ventaId) => {
    if (!ventaId) return;
    setVentaIdEditing(ventaId);
    setOpenEdit(true);
  }, []);

  // ✅ deshabilitar
  const [openDisable, setOpenDisable] = useState(false);
  const [ventaDisable, setVentaDisable] = useState(null);

  const onDisableVenta = useCallback((venta) => {
    if (!venta?.id) return;
    setVentaDisable(venta);
    setOpenDisable(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="w-full max-w-none px-6 md:px-8 py-6 md:py-8">
        <VentasHeader
          empresaLabel={empresaLabel}
          loadingVentas={loadingVentas}
          onRefresh={fetchVentas}
          onOpenNewVenta={() => {
            setVentaIdEditing(null);
            setOpenNew(true);
          }}
          onOpenCotizacion={openCotManual}
        />

        {/* View Selector Toggle (List vs Dashboard) */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-6 border border-slate-200/50">
          <button
            onClick={() => setViewMode("list")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 hover:cursor-pointer ${
              viewMode === "list"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>📋</span> Listado de Costeos
          </button>
          <button
            onClick={() => setViewMode("dashboard")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 hover:cursor-pointer ${
              viewMode === "dashboard"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>📊</span> Dashboard Ejecutivo
          </button>
        </div>

        {/* KPIs Summary Cards at the top of the content */}
        <VentasSummary ventas={filteredVentas} />

        {/* Unified Filters for Costeos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                placeholder="Buscar descripción, ID o cliente..."
                type="text"
              />
            </div>

            {/* Status Select */}
            <div className="relative">
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full h-[46px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer"
              >
                <option value="">Todos los estados</option>
                <option value="PROYECTADO">Proyectados</option>
                <option value="SIN_COTIZACION">Sin Cotización</option>
                <option value="COTIZACION">Cotización</option>
                <option value="ACEPTADA">Aceptada</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="ORDEN_VENTA">Orden de Venta</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="POR_FACTURAR">Por Facturar</option>
                <option value="FACTURADA">Facturada</option>
                <option value="PAGADA">Pagada</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
            </div>

            {/* Date Filters Trigger scale */}
            <nav className="flex bg-slate-100 p-1 rounded-xl w-full h-[46px] items-center">
              <button
                onClick={() => handleScaleSelect("todo")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  periodo === "todo" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => handleScaleSelect("semanal")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  periodo === "semanal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => handleScaleSelect("mensual")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  periodo === "mensual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => handleScaleSelect("anual")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  periodo === "anual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Año
              </button>
            </nav>

            {/* General Report Button */}
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || filteredVentas.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white h-[46px] rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 hover:scale-[1.01] active:scale-95 transition disabled:scale-100 disabled:opacity-60 hover:cursor-pointer w-full text-sm"
              title="Descargar Reporte General de Costeos (PDF)"
            >
              {exportingPdf ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <span>📊</span>
                  <span>Reporte General</span>
                </>
              )}
            </button>
          </div>

          {/* Conditional Dropdowns Row */}
          {periodo !== "todo" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {periodo === "semanal" && (
                <div className="relative w-full sm:w-44">
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
                <div className="relative w-full sm:w-40">
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
                <div className="relative w-full sm:w-32">
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
          )}

          {/* Amount range filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
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

          {/* Clean filters link */}
          {hasFilters && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                {filteredVentas.length} costeo{filteredVentas.length !== 1 ? "s" : ""} encontrado{filteredVentas.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
              >
                <span>✕</span> Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {viewMode === "list" ? (
          <VentasTable
            ventas={filteredVentas}
            error={errorVentas}
            loading={loadingVentas}
            onCreateCotizacionFromVenta={onCreateCotizacionFromVenta}
            onEditVenta={onEditVenta}
            onDisableVenta={onDisableVenta}
            onOpenReport={onOpenReport}
            session={session}
          />
        ) : (
          <CosteosDashboard
            ventas={filteredVentas}
            onOpenReport={onOpenReport}
            session={session}
          />
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={() => {
          setVentaIdEditing(null);
          setOpenNew(true);
        }}
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition"
        title="Nuevo costeo"
      >
        <span className="text-2xl leading-none">+</span>
      </button>

      {/* CREATE */}
      <NuevaVentaDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
      />

      {/* EDIT */}
      <NuevaVentaDialog
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setVentaIdEditing(null);
        }}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
        ventaId={ventaIdEditing}
      />

      {/* ✅ NUEVO MODAL COTIZACIÓN (Stepper) */}
      <CotizacionFromVentasDialog
        open={openCot}
        onClose={() => setOpenCot(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        ventas={ventas}
        preselectedVentaIds={preselectedVentaIds}
        ivaRate={0.19}
        onCreated={fetchVentas}
      />

      {/* Eliminar costeo */}
      <VentaDeleteDialog
        open={openDisable}
        onClose={() => {
          setOpenDisable(false);
          setVentaDisable(null);
        }}
        venta={ventaDisable}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onDisabled={fetchVentas}
      />

      {/* Reporte de costeo */}
      <ReporteCosteoModal
        open={openReport}
        onClose={() => {
          setOpenReport(false);
          setVentaReport(null);
        }}
        venta={ventaReport}
        session={session}
      />
    </main>
  );
}
