"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function makeHeaders(session, empresaIdOverride) {
  const token = session?.user?.accessToken || "";
  const empresaId = empresaIdOverride ?? session?.user?.empresaId ?? null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bundle, setBundle] = useState(null);
  const [err, setErr] = useState("");
  const [periodo, setPeriodo] = useState("mensual");
  const [refDate, setRefDate] = useState(new Date());

  // Redirección si NO hay sesión
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!session?.user?.accessToken) return;

        const meRes = await fetch(`${API_URL}/me`, {
          cache: "no-store",
          headers: makeHeaders(session),
        });
        if (!meRes.ok) {
          const j = await jsonOrNull(meRes);
          throw new Error(
            j?.msg || j?.message || `Error ${meRes.status} en /me`
          );
        }
        const me = await meRes.json();

        const empresaIdFromMe =
          me?.user?.empresa?.id ??
          me?.scope?.empresaId ??
          session?.user?.empresaId ??
          null;

        const headers = makeHeaders(session, empresaIdFromMe);

        const candidates = [
          { key: "me", path: "/me" },
          { key: "dashboard", path: `/dashboard?periodo=${periodo}&refDate=${refDate.toISOString()}` }
        ];

        const results = await Promise.allSettled(
          candidates.map(async (c) => {
            const r = await fetch(`${API_URL}${c.path}`, {
              cache: "no-store",
              headers,
            });
            if (!r.ok) {
              const j = await jsonOrNull(r);
              throw new Error(
                j?.msg || j?.message || `Error ${r.status} en ${c.path}`
              );
            }
            const data = await r.json();
            return { key: c.key, data };
          })
        );

        const b = { me, _errors: {} };
        for (const r of results) {
          if (r.status === "fulfilled") b[r.value.key] = r.value.data;
          else {
            const i = results.indexOf(r);
            const key = candidates[i]?.key || `unk_${i}`;
            b._errors[key] = String(
              r.reason?.message || r.reason || "unknown"
            );
          }
        }

        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setErr(String(e.message || e));
      }
    }

    if (status === "authenticated") {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [session, status, periodo, refDate]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#004ac6]">
            sync
          </span>
          <p className="text-sm font-semibold text-[#64748B]">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (err) {
    return (
      <div className="mx-auto  p-8 mt-12 bg-white rounded-2xl border border-red-100 shadow-sm text-center">
        <span className="material-symbols-outlined text-[48px] text-red-500 mb-3">
          error
        </span>
        <h3 className="text-lg font-bold text-[#0F172A] mb-1">Error al cargar datos</h3>
        <p className="text-sm text-[#64748B] mb-4">{err}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-[#004ac6] text-white rounded-lg text-sm font-semibold hover:bg-[#003ea8] transition-all"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#004ac6]">
            sync
          </span>
          <p className="text-sm font-semibold text-[#64748B]">Cargando información...</p>
        </div>
      </div>
    );
  }

  const me = bundle.me?.user ?? {};
  const empresa = me?.empresa ?? null;
  const rolNombre = me?.rol?.nombre ?? "";
  const rolCodigo = me?.rol?.codigo ?? "";
  const userName = me?.nombre ?? session?.user?.name ?? "Usuario";

  // Formateadores
  const money = (n) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(Number(n || 0));

  const moneyShorthand = (n) => {
    const val = Number(n || 0);
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(0)}k`;
    }
    return `$${val}`;
  };

  // --- DATOS DEL BACKEND ---
  const dbData = bundle.dashboard || {};
  const availableYears = dbData.availableYears || [new Date().getFullYear()];

  // KPIs
  const {
    ventasMes = 0,
    facturadoMes = 0,
    cotizadoMes = 0,
    comprasSemana = 0,
    devengadoSemana = 0,
    ingresosMes = 0,
    flujoCajaMes = 0,
    averageProgress = 0
  } = dbData.kpis || {};

  // Charts
  const pieTrabajos = dbData.charts?.trabajosMes || [];
  const pieCotizaciones = dbData.charts?.cotizacionesMes || [];
  const barChartDataset = dbData.charts?.evolucion6Meses || [];

  // Helpers de navegación
  const handleScaleSelect = (scale) => {
    setPeriodo(scale);
    setRefDate(new Date()); // Reseteamos al presente al cambiar de escala
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
    const nd = new Date(); // base actual
    nd.setDate(nd.getDate() + (offset * 7));
    setRefDate(nd);
  };

  // Variables calculadas
  const egresosMes = ingresosMes - flujoCajaMes;
  const facturacionPct = ventasMes > 0 ? ((facturadoMes / ventasMes) * 100).toFixed(0) : 0;
  const flowText = flujoCajaMes >= 0 ? "positivo" : "negativo";
  const flowBalance = moneyShorthand(Math.abs(flujoCajaMes));

  // Destructuración de Trabajos
  const proyectosEnCurso = pieTrabajos.find(x => x.label === "En Ejecución")?.value || 0;
  const proyectosFinalizados = pieTrabajos.find(x => x.label === "Finalizados")?.value || 0;
  const proyectosEspera = pieTrabajos.find(x => x.label.includes("Espera"))?.value || 0;
  const totalProyectos = proyectosEnCurso + proyectosFinalizados + proyectosEspera;
  const ejecucionPct = totalProyectos > 0 ? Math.round((proyectosEnCurso / totalProyectos) * 100) : 0;
  const finalizadosPct = totalProyectos > 0 ? Math.round((proyectosFinalizados / totalProyectos) * 100) : 0;
  const esperaPct = totalProyectos > 0 ? Math.round((proyectosEspera / totalProyectos) * 100) : 0;

  // Destructuración de Cotizaciones
  const cotAprobadas = pieCotizaciones.find(x => x.label.includes("Acept"))?.value || 0;
  const cotRechazadas = pieCotizaciones.find(x => x.label.includes("Rechaz"))?.value || 0;
  const cotEnviadas = pieCotizaciones.find(x => x.label.includes("Enviad"))?.value || 0;
  const totalCotizaciones = cotAprobadas + cotRechazadas + cotEnviadas;
  const aceptadasPct = totalCotizaciones > 0 ? Math.round((cotAprobadas / totalCotizaciones) * 100) : 0;
  const rechazadasPct = totalCotizaciones > 0 ? Math.round((cotRechazadas / totalCotizaciones) * 100) : 0;
  const enviadasPct = totalCotizaciones > 0 ? Math.round((cotEnviadas / totalCotizaciones) * 100) : 0;

  // Escalamiento del gráfico
  const maxVal = Math.max(...barChartDataset.map(d => Math.max(d.ventas, Math.abs(d.flujoNeto), 1)));

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] text-[#191c1e] font-sans antialiased overflow-x-hidden">
      {/* Carga del Font Inter y Material Symbols */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />

      <div className="w-full pt-8 px-6 md:px-8 lg:px-12 flex-1">
        {/* Report Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-widest text-[#002477] mb-1 uppercase">
              Dashboard
            </h1>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
            <nav className="flex bg-[#f1f5f9] rounded-xl p-1 w-full md:w-auto">
              <button
                onClick={() => handleScaleSelect("semanal")}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${periodo === "semanal" ? "bg-white shadow-sm text-[#004ac6] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
              >
                Semana
              </button>
              <button
                onClick={() => handleScaleSelect("mensual")}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${periodo === "mensual" ? "bg-white shadow-sm text-[#004ac6] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
              >
                Mes
              </button>
              <button
                onClick={() => handleScaleSelect("anual")}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${periodo === "anual" ? "bg-white shadow-sm text-[#004ac6] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
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
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl text-sm py-2.5 pl-4 pr-10 appearance-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] outline-none text-[#0F172A] font-medium"
                  >
                    <option value={0}>Esta semana</option>
                    <option value={-1}>Semana pasada</option>
                    <option value={-2}>Hace 2 semanas</option>
                    <option value={-3}>Hace 3 semanas</option>
                    <option value={-4}>Hace 4 semanas</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94A3B8]">
                    expand_more
                  </span>
                </div>
              )}

              {periodo === "mensual" && (
                <div className="relative w-full md:w-40">
                  <select
                    value={refDate.getMonth()}
                    onChange={handleMonthSelect}
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl text-sm py-2.5 pl-4 pr-10 appearance-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] outline-none text-[#0F172A] font-medium"
                  >
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94A3B8]">
                    expand_more
                  </span>
                </div>
              )}

              {(periodo === "mensual" || periodo === "anual") && (
                <div className="relative w-full md:w-32">
                  <select
                    value={refDate.getFullYear()}
                    onChange={handleYearSelect}
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl text-sm py-2.5 pl-4 pr-10 appearance-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] outline-none text-[#0F172A] font-medium"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94A3B8]">
                    expand_more
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Summary Section */}
        <section className="mb-6">
          <div className="bg-[#004ac6]/5 border border-[#004ac6]/10 rounded-2xl p-4">
            <h2 className="text-[10px] font-bold text-[#004ac6] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span> Resumen Ejecutivo
            </h2>
            <p className="text-sm text-slate-700 leading-normal">
              En el periodo actual, se han registrado ventas por{" "}
              <span className="font-bold text-[#0F172A]">{moneyShorthand(ventasMes)}</span> con una facturación del{" "}
              <span className="font-bold text-[#004ac6]">{facturacionPct}%</span>. El flujo de caja es{" "}
              <span className="font-bold text-[#0F172A]">{flowText}</span> con un balance de{" "}
              <span className={`font-bold ${flujoCajaMes >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {flowBalance}
              </span>
              . Contamos con <span className="font-bold text-[#0F172A]">{proyectosEnCurso}</span> trabajos activos y{" "}
              <span className="font-bold text-[#004ac6]">{totalCotizaciones}</span> cotizaciones enviadas en este periodo.
            </p>
          </div>
        </section>

        {/* KPI Section: 5 columns on desktop */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* VENTAS */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 relative overflow-hidden border-t-4 border-t-[#004ac6] hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Ventas</span>
              <span className="material-symbols-outlined text-[#004ac6]/40 text-[20px]">shopping_cart</span>
            </div>
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-none">
              {moneyShorthand(ventasMes)}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1.5 truncate" title={money(cotizadoMes)}>
              Total Cotizado: {moneyShorthand(cotizadoMes)}
            </p>
          </div>

          {/* FACTURADO */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 relative overflow-hidden border-t-4 border-t-[#943700] hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Facturado</span>
              <span className="material-symbols-outlined text-[#943700]/40 text-[20px]">receipt_long</span>
            </div>
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-none">
              {moneyShorthand(facturadoMes)}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1.5">{facturacionPct}% de Ventas</p>
          </div>

          {/* GENERADO */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 relative overflow-hidden border-t-4 border-t-[#475569] hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Generado (EV)</span>
              <span className="material-symbols-outlined text-[#475569]/40 text-[20px]">engineering</span>
            </div>
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-none">
              {moneyShorthand(devengadoSemana)}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1.5">Avance: {averageProgress}%</p>
          </div>

          {/* COMPRAS */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 relative overflow-hidden border-t-4 border-t-[#EF4444] hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Compras</span>
              <span className="material-symbols-outlined text-[#EF4444]/40 text-[20px]">payments</span>
            </div>
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-none">
              {moneyShorthand(comprasSemana)}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              {ventasMes > 0 ? ((comprasSemana / ventasMes) * 100).toFixed(0) : 0}% de Ventas
            </p>
          </div>

          {/* INGRESOS */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 relative overflow-hidden border-t-4 border-t-[#2563eb] hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Ingresos</span>
              <span className="material-symbols-outlined text-[#2563eb]/40 text-[20px]">
                account_balance_wallet
              </span>
            </div>
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-none">
              {moneyShorthand(ingresosMes)}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1.5">Cobros realizados</p>
          </div>
        </section>

        {/* Main Row: Evolution (70%) and Net Flow (30%) */}
        <section className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 mb-6">
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 hover:shadow-md transition-all">
            <div className="mb-8">
              <h3 className="text-[20px] font-bold text-[#0F172A] leading-7 mb-1">Evolución Ventas y Caja</h3>
              <p className="text-sm text-[#94A3B8] font-medium">
                {periodo === "anual" ? `Año ${refDate.getFullYear()}` : "Últimos 6 meses"}
              </p>
            </div>

            <div className="flex h-64 gap-3 items-end border-b border-[#E2E8F0] pb-2 relative ml-12">
              {/* Y-Axis */}
              <div className="absolute -left-12 h-full flex flex-col justify-between text-[10px] text-[#94A3B8] font-bold text-right pr-2 w-10">
                <span>{moneyShorthand(maxVal)}</span>
                <span>{moneyShorthand(maxVal / 2)}</span>
                <span>$0</span>
              </div>

              {/* Dynamic Bars */}
              {barChartDataset.map((d, i) => {
                const hVentas = maxVal > 0 ? (d.ventas / maxVal) * 100 : 0;
                const hFlujo = maxVal > 0 ? (Math.abs(d.flujoNeto) / maxVal) * 100 : 0;
                const flowIsNegative = d.flujoNeto < 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="flex items-end gap-1.5 w-full justify-center relative group h-full">
                      {/* Caja bar (light blue / red if loss) */}
                      <div
                        className={`w-3 rounded-t-sm transition-all cursor-pointer ${flowIsNegative
                          ? "bg-[#EF4444]/20 hover:bg-[#EF4444]/35"
                          : "bg-[#004ac6]/20 hover:bg-[#004ac6]/30"
                          }`}
                        style={{ height: `${Math.max(2, hFlujo)}%` }}
                      ></div>
                      {/* Ventas bar (dark blue) */}
                      <div
                        className="w-3 bg-[#004ac6] rounded-t-sm hover:bg-[#004ac6]/90 transition-all cursor-pointer"
                        style={{ height: `${Math.max(2, hVentas)}%` }}
                      ></div>

                      {/* Tooltip Hover */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg pointer-events-none">
                        <p className="font-bold border-b border-slate-700 pb-0.5 mb-1">{d.mes}</p>
                        <p>Ventas: {money(d.ventas)}</p>
                        <p className={flowIsNegative ? "text-red-400" : "text-emerald-400"}>
                          Flujo: {money(d.flujoNeto)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#94A3B8] uppercase mt-2">{d.mes}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-6 justify-center text-xs font-semibold text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004ac6]"></span>
                <span>Ventas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004ac6]/20"></span>
                <span>Caja</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444]/20"></span>
                <span>Caja (Pérdida)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 hover:shadow-md transition-all flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[20px] font-bold text-[#0F172A] leading-7">Flujo Neto</h3>
              {flujoCajaMes >= 0 ? (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Flujo Positivo
                </span>
              ) : (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Flujo Negativo
                </span>
              )}
            </div>

            <div className="space-y-6 flex-grow">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-slate-600">Entradas</span>
                  <span className="font-bold text-[#004ac6] text-lg">{moneyShorthand(ingresosMes)}</span>
                </div>
                <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#004ac6] h-full rounded-full" style={{ width: "100%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-slate-600">Salidas</span>
                  <div className="text-right">
                    <span className="font-bold text-[#EF4444] text-lg">{moneyShorthand(egresosMes)}</span>
                    <span className="text-[10px] text-[#94A3B8] block font-bold uppercase mt-0.5">
                      {ingresosMes > 0 ? ((egresosMes / ingresosMes) * 100).toFixed(0) : 0}% de entradas
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#EF4444] h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, ingresosMes > 0 ? (egresosMes / ingresosMes) * 100 : 0))}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#E2E8F0]">
              <div className="bg-[#004ac6]/5 p-4 rounded-xl flex items-center justify-between border border-[#004ac6]/10">
                <div>
                  <p className="text-[10px] font-bold text-[#004ac6] uppercase mb-0.5 tracking-wider">
                    Balance Neto
                  </p>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {money(flujoCajaMes)}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${flujoCajaMes >= 0 ? "bg-[#004ac6]" : "bg-[#EF4444]"
                    }`}
                >
                  <span className="material-symbols-outlined">
                    {flujoCajaMes >= 0 ? "trending_up" : "trending_down"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Row: Works (50%) and Quotes (50%) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Estado de Trabajos */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 hover:shadow-md transition-all">
            <h3 className="text-[20px] font-bold text-[#0F172A] leading-7 mb-6">Estado de Trabajos</h3>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="15.915" stroke="#f1f5f9" strokeWidth="3"></circle>
                  <circle
                    cx="18"
                    cy="18"
                    fill="none"
                    r="15.915"
                    stroke="#004ac6"
                    strokeDasharray={`${ejecucionPct} ${100 - ejecucionPct}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    className="transition-all duration-500"
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-[#0F172A]">{totalProyectos}</p>
                  <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Total</p>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#004ac6]"></span>
                    <span className="text-sm font-semibold text-[#0f172a]">En Ejecución</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {proyectosEnCurso} <span className="text-[#94A3B8] font-normal text-xs ml-1">({ejecucionPct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                    <span className="text-sm font-semibold text-[#475569]">Finalizados</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {proyectosFinalizados} <span className="text-[#94A3B8] font-normal text-xs ml-1">({finalizadosPct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <span className="text-sm font-semibold text-[#475569]">En Espera</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {proyectosEspera} <span className="text-[#94A3B8] font-normal text-xs ml-1">({esperaPct}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ratio de Cotizaciones */}
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 hover:shadow-md transition-all">
            <h3 className="text-[20px] font-bold text-[#0F172A] leading-7 mb-6">Ratio de Cotizaciones</h3>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="15.915" stroke="#f1f5f9" strokeWidth="3"></circle>
                  <circle
                    cx="18"
                    cy="18"
                    fill="none"
                    r="15.915"
                    stroke="#2563eb"
                    strokeDasharray={`${aceptadasPct} ${100 - aceptadasPct}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    className="transition-all duration-500"
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-[#0F172A]">{totalCotizaciones}</p>
                  <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Enviadas</p>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span>
                    <span className="text-sm font-semibold text-[#0f172a]">Aceptadas</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {cotAprobadas} <span className="text-[#94A3B8] font-normal text-xs ml-1">({aceptadasPct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                    <span className="text-sm font-semibold text-[#475569]">Rechazadas</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {cotRechazadas} <span className="text-[#94A3B8] font-normal text-xs ml-1">({rechazadasPct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                    <span className="text-sm font-semibold text-[#475569]">En Proceso</span>
                  </div>
                  <span className="font-bold text-sm text-[#0f172a]">
                    {cotEnviadas} <span className="text-[#94A3B8] font-normal text-xs ml-1">({enviadasPct}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ====== COMPONENTES INTERNOS ====== */

function ListPreview({ title, rows = [], cols = [], href = "#", moneyFormatter }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("es-CL");
  };

  return (
    <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-sm text-[#0F172A]">{title}</h3>
        <Link className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-0.5" href={href}>
          Ver todo <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </Link>
      </div>
      <div>
        {rows.length === 0 ? (
          <div className="text-sm text-[#94A3B8] px-1 py-8 text-center font-medium">
            Sin registros recientes
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <li
                key={r.id || i}
                className="py-3.5 px-5 text-sm hover:bg-slate-50/50 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-[#0F172A]">
                    {r.nombre || r.razonSocial || r.titulo || r.numero || r.codigo || `#${r.id ?? i + 1}`}
                  </div>
                  <div className="text-[#64748B] text-[11px] font-semibold mt-0.5 flex items-center gap-1.5">
                    {cols
                      .filter((c) => r[c] && c !== "nombre" && c !== "numero")
                      .slice(0, 3)
                      .map((c, j, arr) => {
                        let text = String(r[c]);
                        if (c === "createdAt") text = formatDate(text);
                        if (c === "total" || c === "totalOtorgar") {
                          text = moneyFormatter ? moneyFormatter(r[c]) : `$${Number(r[c]).toLocaleString("es-CL")}`;
                        }
                        return (
                          <React.Fragment key={c}>
                            <span>{text}</span>
                            {j < arr.length - 1 && <span className="text-[#94A3B8]">•</span>}
                          </React.Fragment>
                        );
                      })}
                  </div>
                </div>
                <ChevronRightIcon
                  fontSize="small"
                  className="text-slate-300 group-hover:text-[#004ac6] group-hover:translate-x-0.5 transition-all"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
