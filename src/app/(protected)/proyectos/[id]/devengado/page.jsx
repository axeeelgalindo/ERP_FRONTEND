"use client";

import React, { useMemo, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { BarChart, SparkLineChart, PieChart, Gauge } from '@mui/x-charts';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PendingIcon from '@mui/icons-material/Pending';
import SyncIcon from '@mui/icons-material/Sync';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// newly added icons
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import InventoryIcon from '@mui/icons-material/Inventory';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DescriptionIcon from '@mui/icons-material/Description';
import MemoryIcon from '@mui/icons-material/Memory';
import BoltIcon from '@mui/icons-material/Bolt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

import { useSession } from "next-auth/react";
import Link from "next/link";

const money = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(n || 0));
const pct1 = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

// Componente cliente principal
export default function ProyectoDevengadoRealPage({ params }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  const { data: session, status } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setError("No session available");
      setLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

    fetch(`${apiUrl}/proyectos/${id}/devengado?base=VENTA`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.user.accessToken}`,
        "x-empresa-id": String(session.user.empresaId),
      }
    })
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch (err) {
          throw new Error(`Parse error: ${text.slice(0, 100)}...`);
        }
      })
      .then((res) => {
        if (!res.ok) throw new Error(res.error || res.message || "Error al cargar");
        setData(res);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, session, status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <SyncIcon className="animate-spin text-4xl text-blue-500" />
          <p className="font-medium text-sm">Cargando devengado del proyecto...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
          <WarningAmberIcon className="text-5xl text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">No se pudo cargar</h2>
          <p className="text-slate-500 text-sm max-w-sm">{error || "Error desconocido"}</p>
        </div>
      </div>
    );
  }

  const { proyecto, rango = {}, financiero = {}, tareas = {}, compras = [], empleados = [], weekly = {} } = data;
  const { base = {}, costos = {}, devengado = {} } = financiero;

  const estadoTone = proyecto.estado === "activo" ? "ok" : proyecto.estado === "en_riesgo" ? "warn" : "neutral";

  const comprasSinFactura = compras.filter((c) => !c.factura_url && c.estado !== "FACTURADA").length;
  const comprasFact = compras.filter((c) => !!c.factura_url || c.estado === "FACTURADA").length;

  // El margen debe ser sobre lo devengado (el avance llevado a $) contra los costos reales
  const margenBruto = devengado.devengado > 0
    ? ((devengado.devengado - costos.costoAcumulado) / devengado.devengado) * 100
    : 0;

  // Approx weekly values
  const currentWeek = weekly?.semanaActual;
  const lastWeek = weekly?.semanaPasada;

  const ingresoSemana = currentWeek?.real?.devengadoSemana || (base.valor * 0.02); // Fallback visual
  const deltaWeekPct = currentWeek?.real?.avanceSemanaPct || 2.0;

  // Approx daily chart (just visual distribution for the week)
  const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const daily = days.map((day, i) => {
    // Generate slight variations
    const dIngreso = (ingresoSemana / 7) * (0.8 + Math.random() * 0.4);
    const dCosto = (costos.costoAcumulado * 0.02 / 7) * (0.8 + Math.random() * 0.4);
    return { day, ingreso: dIngreso, costo: dCosto };
  });

  const costoSemana = daily.reduce((acc, d) => acc + d.costo, 0);
  const gananciaSemanaPos = Math.max(0, ingresoSemana - costoSemana);

  return (
    <div className="bg-[#f6f7f8] text-slate-900 min-h-screen pb-10">
      <div className="layout-container flex h-full grow flex-col">
        <main className="p-4 lg:p-10 space-y-8">

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                <span>Proyectos</span>
                <ChevronRightIcon fontSize="small" className="text-sm" />
                <span className="text-slate-600 font-bold">{proyecto.nombre}</span>
              </nav>
              <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                Financial Health Dashboard
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${estadoTone === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {proyecto.estado?.toUpperCase()}
                </span>
              </h1>
              <p className="text-slate-500 text-sm">Strategic overview of accruals and project execution performance.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/proyectos/${id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                <ArrowBackIcon fontSize="small" className="text-sm" /> Volver
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2074e9] shadow-sm text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-shadow">
                <CalendarMonthIcon fontSize="small" className="text-[20px]" />
                Hoy: {fmtDate(new Date())}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BusinessCenterIcon className="text-4xl" style={{ fontSize: '2.5rem' }} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Venta Total</p>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{money(base.valor)}</h3>
                <span className="text-emerald-500 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 rounded">
                  {base.fuente}
                </span>
              </div>
              <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#2074e9] rounded-full w-full"></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <HealthAndSafetyIcon className="text-4xl" style={{ fontSize: '2.5rem' }} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avance Físico</p>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{pct1(devengado.avancePct)}</h3>
                <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
                  <TrendingUpIcon className="text-[14px]" style={{ fontSize: '14px' }} /> OK
                </span>
              </div>
              <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, devengado.avancePct)}%` }}></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <InventoryIcon className="text-4xl" style={{ fontSize: '2.5rem' }} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ppto Consumido</p>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{money(costos.pptoUtilizadoReal)}</h3>
                {costos.pptoUtilizadoReal > base.valor * 0.8 ? (
                  <span className="text-rose-500 text-[10px] font-bold bg-rose-50 px-1.5 py-0.5 rounded">Riesgo</span>
                ) : (
                  <span className="text-amber-500 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded">Normal</span>
                )}
              </div>
              <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${costos.pptoUtilizadoReal > base.valor * 0.8 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, (costos.pptoUtilizadoReal / (base.valor || 1)) * 100)}%` }}></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <AnalyticsIcon className="text-4xl" style={{ fontSize: '2.5rem' }} />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">% Asignado</p>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className={`text-2xl font-bold text-slate-800`}>{pct1((costos.costoAcumulado / (base.valor || 1)) * 100)}</h3>
                <span className={`text-slate-400 text-[10px] font-bold`}>
                  Costeo: {money(costos.costoAcumulado)}
                </span>
              </div>
              <div className="mt-4 h-1 w-full flex bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (costos.costoAcumulado / (base.valor || 1)) * 100)}%` }}></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-slate-800">Proyección vs Real</h4>
                  <p className="text-xs text-slate-500">Actividad financiera semanal</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2074e9]"></span> PROYECTADO</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> REAL</div>
                </div>
              </div>
              <div className="flex-1 w-full relative flex items-end justify-between gap-1 mt-4 overflow-x-auto pb-4 custom-scrollbar">
                {(() => {
                  const renderWeek = (weekly && weekly.history && weekly.history.length > 0) ? weekly.history : daily;
                  const rawMax = Math.max(...renderWeek.map(x => Math.max(x.plan?.amount || 0, x.real?.devengadoSemana || 0)));
                  const maxVal = rawMax > 0 ? (rawMax * 1.1) : 1;

                  if (rawMax === 0) return <div className="w-full text-center text-xs text-slate-400 h-full flex items-center justify-center pb-10">Sin actividad registrada</div>;

                  return renderWeek.map((p, i) => {
                    const hPlan = ((p.plan?.amount || 0) / maxVal) * 100;
                    const hReal = ((p.real?.devengadoSemana || 0) / maxVal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end pb-6 relative min-w-[40px]">
                        <div className="w-full h-full flex items-end justify-center gap-[2px] hover:bg-slate-50 rounded-t transition-colors px-1 border-b border-slate-100">
                          <div
                            className="w-full max-w-[10px] bg-[#2074e9] rounded-t-[2px] transition-all hover:brightness-110 relative group/bar"
                            style={{ height: `${Math.max(1, hPlan)}%`, opacity: hPlan > 0 ? 1 : 0.2 }}
                          >
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                              Plan: {money(p.plan?.amount)}
                            </div>
                          </div>
                          <div
                            className="w-full max-w-[10px] bg-emerald-500 rounded-t-[2px] transition-all hover:brightness-110 relative group/bar"
                            style={{ height: `${Math.max(1, hReal)}%`, opacity: hReal > 0 ? 1 : 0.2 }}
                          >
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                              Real: {money(p.real?.devengadoSemana)}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase absolute bottom-0">{p.label}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
              <div className="mb-6">
                <h4 className="font-bold text-slate-800">Cumplimiento de Épicas</h4>
                <p className="text-xs text-slate-500">Estado de completación por épica</p>
              </div>
              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {proyecto.epicas?.map((e, i) => {
                  const w = e.avance || 0;
                  const colors = ['bg-[#2074e9]', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500'];
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-700 truncate" title={e.nombre}>{e.nombre}</span>
                        <span className="text-slate-500 ml-2">{w}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[i % 4]}`} style={{ width: `${w}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {(!proyecto.epicas || proyecto.epicas.length === 0) && (
                  <p className="text-xs text-slate-400 mt-4 text-center">Sin épicas registradas</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px] items-center text-center">
              <div className="w-full text-left mb-6">
                <h4 className="font-bold text-slate-800">Margen de Contribución</h4>
                <p className="text-xs text-slate-500">Desempeño del margen sobre devengamiento</p>
              </div>
              <div className="flex-1 w-full flex flex-col justify-center relative">
                <div className="flex items-end justify-center gap-2 mb-8">
                  <span className={`text-5xl font-extrabold tracking-tight ${margenBruto < 0 ? 'text-rose-500' : (margenBruto >= (base.margenObjetivo || 65) ? 'text-emerald-500' : 'text-slate-800')}`}>
                    {margenBruto > 0 ? '+' : ''}{pct1(margenBruto)}
                  </span>
                </div>

                <div className="relative w-full h-6 bg-slate-50 rounded-full border border-slate-100 overflow-hidden flex mb-2">
                  <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-300 z-20"></div>
                  {(base.margenObjetivo > 0) && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-20 opacity-80" style={{ left: `${50 + (base.margenObjetivo / 2)}%` }}></div>
                  )}
                  <div className="w-1/2 h-full flex justify-end bg-slate-50">
                    <div className="h-full bg-rose-500 transition-all duration-1000 origin-right" style={{ width: `${margenBruto < 0 ? Math.min(100, Math.abs(margenBruto)) : 0}%` }}></div>
                  </div>
                  <div className="w-1/2 h-full flex justify-start bg-slate-50">
                    <div className={`h-full transition-all duration-1000 ${margenBruto >= (base.margenObjetivo || 65) ? 'bg-emerald-500' : 'bg-[#2074e9]'}`} style={{ width: `${margenBruto > 0 ? Math.min(100, margenBruto) : 0}%` }}></div>
                  </div>
                </div>

                <div className="flex justify-between w-full text-[10px] text-slate-400 font-bold uppercase relative mt-1">
                  <span className="w-10 text-left">-100%</span>
                  <span className="w-10 text-center absolute left-1/2 -translate-x-1/2 text-slate-500">0%</span>
                  <span className="w-10 text-right">+100%</span>
                  {(base.margenObjetivo > 0) && (
                    <span className="absolute text-emerald-500 -top-1.5" style={{ left: `${50 + (base.margenObjetivo / 2)}%`, transform: 'translateX(-50%)' }}>
                      ▼ Tar.
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 w-full gap-4 mt-8 text-[10px] font-bold">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-left">
                  <p className="text-slate-400 uppercase mb-0.5">Target</p>
                  <p className="text-lg text-slate-700">{Math.round(base.margenObjetivo || 65)}%</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-left">
                  <p className="text-slate-400 uppercase mb-0.5">Estado</p>
                  <p className={`text-lg flex items-center gap-1.5 ${margenBruto < 0 ? 'text-rose-600' : (margenBruto >= (base.margenObjetivo || 65) ? 'text-emerald-600' : 'text-amber-600')}`}>
                    {margenBruto < 0 ? <WarningAmberIcon fontSize="small" /> : (margenBruto >= (base.margenObjetivo || 65) ? <CheckCircleIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />)}
                    {margenBruto < 0 ? 'PÉRDIDA' : (margenBruto >= (base.margenObjetivo || 65) ? 'ÓPTIMO' : 'BAJO')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <h4 className="font-bold text-slate-800">Detalle de Tareas y Subtareas</h4>
                <div className="flex gap-2">
                  <button className="text-xs font-bold px-3 py-1.5 rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50">Filter</button>
                  <button className="text-xs font-bold px-3 py-1.5 rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50">Export CSV</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Task Identification</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Fechas</th>
                      <th className="px-6 py-4">Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const displayTasks = (tareas.enSemanaActual?.length > 0) ? tareas.enSemanaActual : (data.tareas_all || []);
                      return displayTasks.slice(0, 15).map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{t.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-medium">#{t.id.slice(-6).toUpperCase()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${t.estado === 'completa' ? 'bg-emerald-100 text-emerald-700' : t.estado?.includes('curso') ? 'bg-[#2074e9]/10 text-[#2074e9]' : 'bg-slate-100 text-slate-500'}`}>
                              {t.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-500 font-medium">{t.fecha_inicio_plan ? fmtDate(t.fecha_inicio_plan) : 'S/F'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold ${t.avance === 100 ? 'text-emerald-500' : 'text-slate-700'}`}>{t.avance}%</span>
                          </td>
                        </tr>
                      ));
                    })()}
                    {(!tareas.enSemanaActual || tareas.enSemanaActual.length === 0) && (!data.tareas_all || data.tareas_all.length === 0) && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-sm text-slate-400">Sin tareas registradas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span>Mostrando las tareas del proyecto</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Compras Recientes</h4>
                <ShoppingCartIcon className="text-slate-400" />
              </div>
              <div className="space-y-4 flex-1">
                {compras?.slice(0, 5).map((c, i) => {
                  const MuiIcons = [DescriptionIcon, MemoryIcon, BoltIcon, InventoryIcon];
                  const Icon = MuiIcons[i % 4] || InventoryIcon;
                  const colors = ['bg-emerald-100 text-emerald-600', 'bg-[#2074e9]/10 text-[#2074e9]', 'bg-amber-100 text-amber-600', 'bg-slate-100 text-slate-500'];
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer">
                      <div className={`w-10 h-10 shrink-0 rounded flex items-center justify-center ${colors[i % 4]}`}>
                        <Icon fontSize="small" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate" title={c.proveedor}>{c.proveedor}</p>
                        <p className="text-[10px] text-slate-500">REF: {c.numero} • {c.estado}</p>
                        <p className="text-xs font-extrabold mt-1 text-[#2074e9]">{money(c.total)}</p>
                      </div>
                    </div>
                  );
                })}
                {(!compras || compras.length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-4">No hay compras registradas</p>
                )}
              </div>
              <button className="mt-2 w-full py-2.5 rounded-lg border border-[#2074e9] text-[#2074e9] text-xs font-bold hover:bg-blue-50 transition-colors">
                View All Procurement
              </button>
              {(comprasSinFactura > 0) && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mt-auto">
                  <div className="flex items-center gap-3 mb-2">
                    <WarningAmberIcon fontSize="small" className="text-amber-500" />
                    <span className="text-xs font-bold text-amber-800">Alerta Financiera</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Hay {comprasSinFactura} compras pendientes de facturar. Revise los estados.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}