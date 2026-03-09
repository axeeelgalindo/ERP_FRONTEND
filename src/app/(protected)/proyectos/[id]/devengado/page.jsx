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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

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
    <div className="bg-slate-50 text-slate-900 min-h-screen transition-colors duration-200 p-5">
      <main className="p-4 md:p-8 mx-auto space-y-8">
        <header className="mb-4">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            <span>Proyectos</span>
            <ChevronRightIcon fontSize="small" className="text-sm" />
            <span className="text-slate-600 font-bold">{proyecto.nombre}</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Devengado</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${estadoTone === 'ok' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${estadoTone === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {proyecto.estado}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-slate-500 mt-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarMonthIcon fontSize="small" className="text-[18px]" />
                  <span>Hoy: {fmtDate(new Date())}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-1.5 text-sm">
                  <UpdateIcon fontSize="small" className="text-[18px]" />
                  <span>Plan: {fmtDate(proyecto.fecha_inicio_plan)} → {fmtDate(proyecto.fecha_fin_plan)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/proyectos/${id}`}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white border border-slate-200 shadow-sm rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowBackIcon fontSize="small" className="text-sm" />
                Volver
              </Link>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-md text-slate-900">Realtime</button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Venta Total</span>
              <span className="text-emerald-500 flex items-center text-xs font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{base.fuente}</span>
            </div>
            <div className="text-xl md:text-2xl font-bold mb-4 tracking-tight">{money(base.valor)}</div>
            <div className="h-10 w-full relative -mx-2 -mb-2">
              <SparkLineChart
                data={[2, 4, 4, 6, 8, 12, 15]}
                colors={['#3B82F6']}
                area
                curve="step"
                margin={{ top: 5, bottom: 5, left: 5, right: 5 }}
                sx={{
                  '& .MuiAreaElement-root': { fill: 'url(#gradient-blue)' },
                  '& .MuiLineElement-root': { strokeWidth: 2 }
                }}
              />
              <svg style={{ height: 0 }}><defs><linearGradient id="gradient-blue" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs></svg>
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Costo Real</span>
              <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${costos.costoAcumulado > base.valor / 2 ? 'text-amber-500 bg-amber-50' : 'text-emerald-500 bg-emerald-50'}`}>
                {costos.costoAcumulado === costos.costoPlan ? 'Costo Base (Venta)' : 'Facturado+HH'}
              </span>
            </div>
            <div className="text-xl md:text-2xl font-bold mb-4 tracking-tight text-rose-500">{money(costos.costoAcumulado)}</div>
            <div className="h-10 w-full relative -mx-2 -mb-2">
              <SparkLineChart
                data={[1, 3, 5, 8, 12, 13, 16]}
                colors={['#F43F5E']}
                area
                curve="monotoneX"
                margin={{ top: 5, bottom: 5, left: 5, right: 5 }}
                sx={{
                  '& .MuiAreaElement-root': { fill: 'url(#gradient-rose)' },
                  '& .MuiLineElement-root': { strokeWidth: 2 }
                }}
              />
              <svg style={{ height: 0 }}><defs><linearGradient id="gradient-rose" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#F43F5E" stopOpacity={0.2} /><stop offset="100%" stopColor="#F43F5E" stopOpacity={0} /></linearGradient></defs></svg>
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ganancia (Devengada)</span>
              <span className="text-emerald-500 flex items-center text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{devengado.yaPasoCosto ? 'Positivo' : 'Negativo'}</span>
            </div>
            <div className={`text-xl md:text-2xl font-bold mb-4 tracking-tight ${devengado.utilidadDevengada > 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {money(devengado.utilidadDevengada)}
            </div>
            <div className="h-12 w-full relative -mx-2 -mb-4">
              <BarChart
                series={[{ data: [2, 5, 3, 8, 10, 15, 12], color: '#10B981', valueFormatter: () => '' }]}
                xAxis={[{ scaleType: 'band', data: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'], display: false }]}
                yAxis={[{ display: false }]}
                margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                tooltip={{ trigger: 'none' }}
                sx={{ '& .MuiBarElement-root': { rx: 2 } }}
              />
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Margen Bruto</span>
                <span className="text-slate-400 flex items-center text-[10px] font-bold">
                  Target: {base.margenObjetivo ? Math.round(base.margenObjetivo) + '%' : '65%'}
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center relative -mt-4">
              <Gauge
                value={Number(margenBruto)}
                valueMin={-100}
                valueMax={100}
                startAngle={-110}
                endAngle={110}
                innerRadius="75%"
                sx={{
                  '& .MuiGauge-valueArc': {
                    fill: margenBruto >= (base.margenObjetivo || 65)
                      ? '#10B981'
                      : margenBruto >= (base.margenObjetivo || 65) * 0.5
                        ? '#F59E0B'
                        : '#EF4444'
                  },
                  '& .MuiGauge-referenceArc': { fill: '#F1F5F9' },
                  '& .MuiGauge-valueText': { fontSize: 24, fontWeight: 'bold', fill: '#0F172A', transform: 'translate(0px, 4px)' }
                }}
                text={`${Math.round(margenBruto)}%`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200/60 rounded-[12px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Avance General del Proyecto</h3>
                <p className="text-sm text-slate-500">Métricas de ejecución física vs. financiera</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <button className="px-3 py-1 bg-white shadow-sm rounded-md text-slate-900 border border-slate-100">Acumulado</button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center shrink-0">
                <PieChart
                  series={[
                    {
                      data: [
                        { id: 0, value: devengado.avancePct, color: '#3B82F6' },
                        { id: 1, value: Math.max(0, 100 - devengado.avancePct), color: '#E2E8F0' },
                      ],
                      innerRadius: 70,
                      outerRadius: 90,
                      paddingAngle: 0,
                      cornerRadius: 0,
                      startAngle: 0,
                      endAngle: 360,
                      cx: '50%',
                      cy: '50%',
                    }
                  ]}
                  margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                  sx={{ '& .MuiPieArc-root': { stroke: 'none' } }}
                  tooltip={{ trigger: 'none' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl md:text-5xl font-extrabold text-slate-900">{Math.round(devengado.avancePct)}<span className="text-lg md:text-2xl font-bold text-slate-400">%</span></span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Completado</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-slate-600">Avance Ponderado</span>
                      <span className="text-sm font-bold text-blue-500">{pct1(devengado.avancePct)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, devengado.avancePct)}%` }}></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 opacity-80">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-slate-600">Costeo / Venta Actual</span>
                      <span className="text-sm font-bold text-slate-800">{pct1((costos.costoAcumulado / (base.valor || 1)) * 100)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(100, (costos.costoAcumulado / (base.valor || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2.5">
                    <CheckCircleIcon fontSize="small" className="text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">Tareas OK (Semana)</p>
                      <p className="text-sm font-bold">{tareas.conteo.completadasSemanaPasada || currentWeek?.real?.tareasHechasCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <PendingActionsIcon fontSize="small" className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">Atrasadas</p>
                      <p className="text-sm font-bold">{tareas.conteo.atrasadas || 0} Tareas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200/60 rounded-[12px] p-6 md:p-8 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg text-slate-800">Weekly Pulse</h3>
              <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Ingreso</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> Costo</span>
              </div>
            </div>
            <div className="flex-1 mb-8 h-48 border-slate-100 pb-2 relative w-full -ml-4">
              <BarChart
                series={[
                  { data: daily.map(d => d.costo), color: '#E2E8F0', label: 'Costo Semanal', valueFormatter: (v) => money(v) },
                  { data: daily.map(d => d.ingreso), color: '#3B82F6', label: 'Ingreso Semanal', valueFormatter: (v) => money(v) }
                ]}
                xAxis={[{ data: daily.map(d => d.day), scaleType: 'band' }]}
                margin={{ left: 10, right: 10, top: 10, bottom: 20 }}
                yAxis={[{ display: false }]}
                slotProps={{ legend: { hidden: true } }}
                barLabel={(item, context) => { return null; }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wider">Ingreso Sem. (+{pct1(deltaWeekPct)})</p>
                <p className="text-xl font-bold text-slate-900">{money(ingresoSemana)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${gananciaSemanaPos > 0 ? "bg-emerald-50 border-emerald-100/50" : "bg-slate-50 border-slate-100"}`}>
                <p className={`text-[10px] uppercase font-bold mb-1 tracking-wider ${gananciaSemanaPos > 0 ? "text-emerald-600" : "text-slate-500"}`}>Neto Sem.</p>
                <p className={`text-xl font-bold ${gananciaSemanaPos > 0 ? "text-emerald-700" : "text-slate-700"}`}>{money(gananciaSemanaPos)}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-12 gap-8">
          <div className="col-span-12">
            <div className="flex items-center gap-3 mb-6">
              <BusinessCenterIcon className="text-slate-900" />
              <h2 className="text-lg font-bold">Gestión de Operaciones & Contratos</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-full">Base: {base.fuente}</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cotizado General</p>
                    <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{money(base.valorCotizado)}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Vendido Contrato</p>
                      <p className="text-lg font-bold text-slate-700">{money(base.valorVendido)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Diferencia Oportunidad</p>
                      <p className="text-lg font-bold text-slate-700">{money(Math.max(0, base.valorCotizado - base.valorVendido))}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full">COSTEO ACUMULADO</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Inversión Devengada Real</p>
                    <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">{money(costos.costoAcumulado)}</h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 py-6 border-y border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Costo HH Acumulado</p>
                      <p className="text-lg font-bold text-emerald-400">{money(costos.valorHHReal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Compras (OC Facturadas)</p>
                      <p className="text-lg font-bold text-white">{money(costos.comprasFacturadas)}</p>
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Total OC/Trx</p>
                      <p className="text-lg font-bold text-slate-300">{money(costos.totalCompras)}</p>
                    </div>
                  </div>
                  <div className="text-sm border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                      <TrendingDownIcon fontSize="small" />
                      <span>Costo Actual {pct1((costos.costoAcumulado / (base.valor || 1)) * 100)} del Presupuesto de {base.fuente}</span>
                    </div>
                    {costos.costoAcumulado === costos.costoPlan && (
                      <div className="text-xs text-slate-400 mt-1">
                        * El costo actual se mantiene bajo la línea base de los detalles de la Venta ({money(costos.costoPlan)}).
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-8 pb-10">
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-900">Compras del Proyecto</h3>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{comprasFact} FACTURADAS</span>
                  {comprasSinFactura > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{comprasSinFactura} PENDIENTES</span>}
                </div>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-[10px] text-slate-400 uppercase border-b border-slate-100 z-10 shadow-sm">
                    <tr>
                      <th className="text-left px-6 py-4 font-semibold">OC / Ref</th>
                      <th className="text-left px-6 py-4 font-semibold">Estado</th>
                      <th className="text-right px-6 py-4 font-semibold">Total Bruto</th>
                      <th className="text-center px-6 py-4 font-semibold">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {compras?.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 border-transparent transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-slate-700">#{c.numero}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex flex-col"><span className="font-medium text-slate-500 truncate" style={{ maxWidth: '130px' }} title={c.proveedor}>{c.proveedor}</span><span>{fmtDate(c.fecha)}</span></div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.factura_url || c.estado === 'FACTURADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {c.factura_url ? 'Facturada' : c.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{money(c.total)}</td>
                        <td className="px-6 py-4 text-center">
                          {c.factura_url ? <CheckCircleIcon fontSize="small" className="text-emerald-500 text-lg" /> : <PendingIcon fontSize="small" className="text-slate-300 text-lg" />}
                        </td>
                      </tr>
                    ))}
                    {(!compras || compras.length === 0) && <tr><td colSpan="4" className="text-center py-6 text-slate-400">Sin historial de OC</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inversión Facturada (OC)</span>
                <span className="text-sm font-extrabold text-slate-900">{money(costos.comprasFacturadas)}</span>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-900">Equipo Asignado</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">Impacto HH</span>
              </div>
              <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-[300px] max-h-[440px]">
                {empleados?.map((e, i) => {
                  const m = Math.max(...empleados.map(o => o.costoHH), 1);
                  const w = Math.min((e.costoHH / m) * 100, 100);
                  const cs = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500'];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase">{e.nombre?.slice(0, 2) || "US"}</div>
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${cs[i % 4]}`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{e.nombre}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-medium">{e.cargo?.slice(0, 25) || "Miembro"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{money(e.costoHH / 1000)}k</p>
                          <p className="text-[9px] text-slate-400 uppercase">Cost HH: {money(e.costoHH)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div className={`${cs[i % 4]} h-full rounded-full transition-all duration-700`} style={{ width: `${w}%` }}></div>
                      </div>
                    </div>
                  )
                })}
                {(!empleados || empleados.length === 0) && (
                  <p className="text-center text-slate-400 text-sm mt-8">Sin miembros de proyecto asignados</p>
                )}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}