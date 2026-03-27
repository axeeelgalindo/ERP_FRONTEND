"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  LineChart,
  Gauge
} from '@mui/x-charts';

// Icons using Material Symbols
const Icon = ({ name, className = "", onClick }) => (
  <span className={`material-symbols-outlined ${className}`} onClick={onClick}>{name}</span>
);

const money = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Math.round(Number(n || 0)));

const pct1 = (n) => `${Number(n || 0).toFixed(1)}%`;

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtRange = (s, e) => {
  if (!s && !e) return "—";
  return `${fmtDate(s)} | ${fmtDate(e)}`;
};

export default function ProyectoDevengadoRealPage({ params }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  const { data: session, status } = useSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI States
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [addingMember, setAddingMember] = useState(false);

  const fetchData = async () => {
    if (status === "loading") return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    try {
      const r = await fetch(`${apiUrl}/proyectos/${id}/devengado?base=VENTA`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.user.accessToken}`,
          "x-empresa-id": String(session.user.empresaId),
        }
      });
      const res = await r.json();
      if (!res.ok) throw new Error(res.error || "Error al cargar");
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    try {
      const r = await fetch(`${apiUrl}/empleados`, {
        headers: {
          "Authorization": `Bearer ${session.user.accessToken}`,
          "x-empresa-id": String(session.user.empresaId),
        }
      });
      const res = await r.json();
      setAllEmployees(res.items || res.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
      fetchEmployees();
    }
  }, [id, session, status]);

  const toggleExpand = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) newExpanded.delete(itemId);
    else newExpanded.add(itemId);
    setExpandedItems(newExpanded);
  };

  const handleAddMember = async (empleadoId) => {
    setAddingMember(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    try {
      // Get current members IDs
      const currentIds = empleados.map(e => e.id);
      if (currentIds.includes(empleadoId)) return;

      const newIds = [...currentIds, empleadoId];
      await fetch(`${apiUrl}/proyectos/update/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.user.accessToken}`,
          "x-empresa-id": String(session.user.empresaId),
        },
        body: JSON.stringify({ miembros: newIds })
      });
      await fetchData();
    } catch (e) {
      alert("Error al añadir miembro");
    } finally {
      setAddingMember(false);
    }
  };

  const { proyecto, financiero = {}, empleados = [], weekly = {} } = data || {};
  const { base = {}, costos = {}, devengado = {} } = financiero;
  const history = useMemo(() => weekly?.history || [], [weekly]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004b98]"></div>
          <p className="font-bold text-sm text-slate-500">Sincronizando jerarquía proyectual...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4 max-w-md">
          <Icon name="report" className="text-5xl text-red-500 mx-auto" />
          <h2 className="text-xl font-extrabold text-slate-900">Error de Datos</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <Link href="/proyectos" className="inline-block mt-4 text-[#004b98] font-bold text-sm hover:underline">
            Volver a Proyectos
          </Link>
        </div>
      </div>
    );
  }

  const chartData = history.map((h) => ({
    label: h.mes,
    subLabel: `S${h.semana}`,
    plan: h.planValue || 0,
    real: h.realValue || 0,
    fullLabel: `${h.mes} - S${h.semana}`
  }));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e1e1e] font-sans p-6 lg:p-10 space-y-6 animate-in fade-in duration-700">
      
      <div className="flex items-center justify-start">
        <Link
          href={`/proyectos/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-[#004b98] hover:border-[#004b98] transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          <span>Volver al Proyecto</span>
        </Link>
      </div>

      {/* Hero Header */}
      <section className="bg-white p-8 rounded-xl shadow-sm border-l-[10px] border-[#006a3a] flex flex-col lg:flex-row items-center justify-between gap-6 border-t border-r border-b border-slate-100">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-[#1e1e1e] tracking-tight">Inteligencia de Ejecución Financiera</h1>
          <p className="text-[#64748b] text-base font-medium max-w-2xl">
            Análisis en tiempo real de devengados y salud estructural del proyecto {proyecto.nombre}.
          </p>
        </div>

        <div className="flex items-center gap-12">
          {/* Members Stack */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b] text-center lg:text-right">Responsables</p>
            <div className="flex -space-x-4 justify-center lg:justify-end cursor-pointer group" onClick={() => setShowMembersModal(true)}>
              {empleados.slice(0, 4).map((e, i) => (
                <div key={i} className="w-12 h-12 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-800 shadow-sm overflow-hidden transform group-hover:translate-x-1 transition-transform" title={e.nombre}>
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(e.nombre)}&background=random&color=fff&bold=true`} alt={e.nombre} />
                </div>
              ))}
              {empleados.length > 4 && (
                <div className="w-12 h-12 rounded-full border-2 border-white bg-[#004b98] flex items-center justify-center text-[10px] font-bold text-white shadow-sm z-10">
                  +{empleados.length - 4}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPIItem title="VENTA" val={money(base.valor)} sub="Venta Total" icon="analytics" color="#004b98" />
        <KPIItem title="REAL" val={pct1(devengado.avancePct)} sub="Avance Físico" icon="verified" color="#006a3a" barVal={devengado.avancePct} />
        <KPIItem title="PLAN" val={pct1(devengado.avancePlanPct)} sub="Avance Proyectado" icon="schedule" color="#64748b" barVal={devengado.avancePlanPct} />

        <div className={`bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 group ${devengado.desviacion_devengado < 0 ? 'border-red-100' : 'border-emerald-100'}`}>
          <div className="flex justify-between items-start">
            <p className={`text-[11px] font-black uppercase tracking-widest ${devengado.desviacion_devengado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              DESVIACIÓN DEVENGADO
            </p>
            <Icon name={devengado.desviacion_devengado < 0 ? "trending_down" : "trending_up"} className={devengado.desviacion_devengado < 0 ? "text-red-500" : "text-emerald-500"} />
          </div>
          <div>
            <h3 className={`text-4xl font-black tracking-tight ${devengado.desviacion_devengado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {money(devengado.desviacion_devengado)}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">Diferencia Plan vs Real</p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Desv. Física:</span>
            <span className={`text-[10px] font-black ${devengado.desviacion_avance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {devengado.desviacion_avance > 0 ? '+' : ''}{devengado.desviacion_avance}%
            </span>
          </div>
        </div>

        {(() => {
          const avail = (costos.costoPlanCompras || 0) - costos.pptoUtilizadoReal;
          const isCritical = avail < 0;
          return (
            <div className={`${isCritical ? 'bg-[#fff5f5] border-red-100' : 'bg-white border-slate-100'} p-8 rounded-2xl shadow-sm border space-y-6 group`}>
              <div className="flex justify-between items-start">
                <p className={`text-[11px] font-black uppercase tracking-widest ${isCritical ? 'text-red-600' : 'text-[#64748b]'}`}>
                  {isCritical ? 'EXCEDIÉNDOSE' : 'PPTO COMPRAS'}
                </p>
                <Icon name={isCritical ? "report" : "shopping_cart"} className={isCritical ? "text-red-500" : "text-slate-400"} />
              </div>
              <div>
                <h3 className={`text-4xl font-black tracking-tight ${isCritical ? 'text-red-600' : 'text-[#1e1e1e]'}`}>{money(avail)}</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase mt-1 text-center">Ppto Compras Disponible</p>
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                  TOTAL: {money(costos.costoPlanCompras)} | USADO: {money(costos.pptoUtilizadoReal)}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 group">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">COSTEO PLAN</p>
            <Icon name="assignment" className="text-[#004b98] text-2xl" />
          </div>
          <div>
            <h3 className="text-4xl font-black tracking-tight text-[#1e1e1e]">{money(costos.hhPlan?.costo || 0)}</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">Total HH Plan</p>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
              TOTAL HORAS: {Number(costos.hhPlan?.horas || 0).toLocaleString('es-CL')} HH
            </p>
          </div>
        </div>
      </div>

      {/* Trajectory & Epics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-2xl shadow-sm border border-slate-50 relative">
          <div className="flex justify-between items-center mb-10 text-center lg:text-left">
            <div>
              <h4 className="text-2xl font-black text-[#1e1e1e]">Trayectoria Financiera</h4>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-tight">Evolución Proyectado vs. Real</p>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <LineChart
              xAxis={[{
                data: chartData.map((_, i) => i),
                scaleType: 'point',
                valueFormatter: (i) => chartData[i]?.subLabel || '',
                stroke: '#e2e8f0'
              }]}
              yAxis={[{
                valueFormatter: (v) => {
                  if (v === null || v === undefined) return '';
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return String(v);
                },
                tickLabelStyle: { fontSize: 10, fontWeight: 700, fill: '#64748b' }
              }]}
              series={[
                {
                  data: chartData.map(d => d.plan),
                  label: 'Proyectado',
                  color: '#94a3b8',
                  area: true,
                  showMark: false,
                  curve: "monotoneX"
                },
                {
                  data: chartData.map(d => d.real),
                  label: 'Real',
                  color: '#004b98',
                  showMark: true,
                  curve: "monotoneX",
                  area: false
                },
              ]}
              slotProps={{
                legend: {
                  hidden: false,
                  direction: 'row',
                  position: { vertical: 'bottom', horizontal: 'middle' },
                  padding: { top: 20 }
                }
              }}
              margin={{ left: 60, right: 30, top: 20, bottom: 60 }}
              sx={{
                [`& .MuiAreaElement-root`]: { fill: '#94a3b8', fillOpacity: 0.1 },
                [`& .MuiLineElement-root`]: { strokeWidth: 3 },
                [`& .MuiChartsLegend-label`]: { fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }
              }}
            />
          </div>
        </div>

        {/* Epic Progress Card */}
        <div className="bg-[#f8fafc] p-10 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="mb-10 text-center lg:text-left">
            <h4 className="text-2xl font-black text-[#1e1e1e]">Eficiencia por Fase</h4>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-tight">Cumplimiento Ponderado</p>
          </div>
          <div className="space-y-8 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {(proyecto.epicas || []).map((e, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                  <span className="text-[#1e1e1e] truncate pr-4">{e.nombre}</span>
                  <span className="text-slate-400">{e.avance_real_pct || 0}%</span>
                </div>
                <div className="h-3 w-full bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
                  <div className="bg-[#004b98] h-full rounded-full transition-all duration-1000" style={{ width: `${e.avance_real_pct || 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-10 mt-auto border-t border-slate-200">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest mb-4">
              <span>Eficiencia de Ejecución</span>
              <span className="text-[#004b98]">{pct1(devengado.avancePct / (devengado.avancePlanPct || 1) * 100)}</span>
            </div>
            <div className="h-4 w-full bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
              <div
                className="bg-[#004b98] h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (devengado.avancePct / (devengado.avancePlanPct || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchical Task Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h4 className="text-2xl font-black text-[#1e1e1e]">Detalle de Ejecución Jerárquico</h4>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-tight">Desglose desde Épica hasta Subtarea</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.2em] text-[#64748b] border-b border-slate-100">
                <th className="px-10 py-6 uppercase">ID / Concepto</th>
                <th className="px-10 py-6 uppercase text-center">Progreso (R / P)</th>
                <th className="px-10 py-6 uppercase">Planificado (Inicio | Fin)</th>
                <th className="px-10 py-6 uppercase">Devengado (Real / Plan)</th>
                <th className="px-10 py-6 uppercase text-center">Desviación</th>
                <th className="px-10 py-6 uppercase text-right">Participación</th>
              </tr>
            </thead>
            <tbody>
              {(proyecto.epicas || []).map((epica) => (
                <React.Fragment key={epica.id}>
                  {/* EPIC ROW */}
                  <tr className="bg-slate-50/50 group border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleExpand(epica.id)}>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <Icon name={expandedItems.has(epica.id) ? "expand_more" : "chevron_right"} className="text-[#004b98] font-black" />
                        <div>
                          <p className="text-sm font-black text-[#1e1e1e] uppercase tracking-tight">ÉPICA: {epica.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">FASE DEL PROYECTO</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black">
                          <span className="text-[#006a3a]">{epica.avance_real_pct}% R</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-slate-400">{epica.avance_plan_pct}% P</span>
                        </div>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div className="bg-[#006a3a] h-full" style={{ width: `${epica.avance_real_pct}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-[11px] font-bold text-[#1e1e1e]">
                      <div className="flex flex-col">
                        <span title="Planificado">{fmtRange(epica.fecha_inicio_plan, epica.fecha_fin_plan)}</span>
                        <span className="text-[10px] text-slate-400 font-normal italic" title="Real (Inicio | Fin)">
                          Real: {fmtRange(epica.fecha_inicio_real, epica.fecha_fin_real)}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-[#1e1e1e]">{money(epica.devengado_real)}</span>
                        <span className="text-[10px] text-slate-400 font-bold">Planned: {money(epica.devengado_plan)}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={`text-[11px] font-black ${epica.desviacion_pct < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {epica.desviacion_pct > 0 ? '+' : ''}{epica.desviacion_pct}%
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Number(epica.participacion * 100).toFixed(1)}%</span>
                    </td>
                  </tr>

                  {/* TASKS UNDER EPIC */}
                  {expandedItems.has(epica.id) && (epica.tareas || []).map((tarea) => (
                    <React.Fragment key={tarea.id}>
                      <tr className="bg-white group border-b border-slate-50 cursor-pointer hover:bg-slate-50/30 transition-colors" onClick={() => toggleExpand(tarea.id)}>
                        <td className="px-10 py-5 pl-24">
                          <div className="flex items-center gap-3">
                            <Icon name={expandedItems.has(tarea.id) ? "expand_more" : "chevron_right"} className="text-slate-400 text-sm" />
                            <div>
                              <p className="text-[13px] font-black text-[#1e1e1e] leading-tight group-hover:text-[#004b98] transition-colors">{tarea.nombre}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">TAREA PRINCIPAL</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1 text-[9px] font-black">
                              <span className="text-[#004b98]">{tarea.avance_real_pct}% R</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-slate-400">{tarea.avance_plan_pct}% P</span>
                            </div>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                              <div className="bg-[#004b98] h-full" style={{ width: `${tarea.avance_real_pct}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-5 text-[11px] font-bold text-[#1e1e1e]">
                          <div className="flex flex-col">
                            <span title="Planificado">{fmtRange(tarea.fecha_inicio_plan, tarea.fecha_fin_plan)}</span>
                            <span className="text-[9px] text-slate-400 font-normal italic" title="Real (Inicio | Fin)">
                              Real: {fmtRange(tarea.fecha_inicio_real, tarea.fecha_fin_real)}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#1e1e1e]">{money(tarea.devengado_real)}</span>
                            <span className="text-[9px] text-slate-400 font-bold">Plan: {money(tarea.devengado_plan)}</span>
                          </div>
                        </td>
                        <td className="px-10 py-5 text-center">
                          <span className={`text-[10px] font-black ${tarea.desviacion_pct < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {tarea.desviacion_pct > 0 ? '+' : ''}{tarea.desviacion_pct}%
                          </span>
                        </td>
                        <td className="px-10 py-5 text-right">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{Number(tarea.participacion * 100).toFixed(1)}%</span>
                        </td>
                      </tr>

                      {/* SUBTASKS (DETALLES) UNDER TASK */}
                      {expandedItems.has(tarea.id) && (tarea.detalles || []).map((sub) => (
                        <tr key={sub.id} className="bg-slate-50/10 group border-b border-slate-50/30">
                          <td className="px-10 py-4 pl-36">
                            <div className="flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                              <div>
                                <p className="text-xs font-medium text-[#64748b] leading-tight">{sub.titulo}</p>
                                <p className="text-[8px] text-slate-300 font-bold uppercase">SUBTAREA / ITEM</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-[10px] font-black ${sub.avance_real_pct === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {sub.avance_real_pct}% R / {sub.avance_plan_pct}% P
                              </span>
                            </div>
                          </td>
                          <td className="px-10 py-4 text-[10px] font-bold text-slate-400">
                            <div className="flex flex-col">
                              <span title="Planificado">{fmtRange(sub.fecha_inicio_plan, sub.fecha_fin_plan)}</span>
                              <span className="text-[9px] text-slate-300 font-normal italic" title="Real (Inicio | Fin)">
                                Real: {fmtRange(sub.fecha_inicio_real, sub.fecha_fin_real)}
                              </span>
                            </div>
                          </td>
                          <td className="px-10 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-500">{money(sub.devengado_real)}</span>
                              <span className="text-[9px] text-slate-400">Plan: {money(sub.devengado_plan)}</span>
                            </div>
                          </td>
                          <td className="px-10 py-4 text-center">
                            <span className={`text-[10px] font-black ${sub.desviacion_pct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {sub.desviacion_pct > 0 ? '+' : ''}{sub.desviacion_pct}%
                            </span>
                          </td>
                          <td className="px-10 py-4 text-right">
                            <span className="text-[9px] font-black text-slate-200 uppercase tracking-widest">{Number(sub.participacion * 100).toFixed(2)}%</span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Members Management Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-[#004b98] text-white">
              <div>
                <h2 className="text-2xl font-black">Equipo Responsable</h2>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Gestión de acceso y roles del proyecto</p>
              </div>
              <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Icon name="close" className="text-2xl" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Current Members */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748b]">Miembros Actuales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {empleados.map((e, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center text-xs font-bold text-[#004b98] overflow-hidden">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(e.nombre)}&background=random&color=fff&bold=true`} alt={e.nombre} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#1e1e1e] truncate">{e.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{e.cargo || "Responsable"}</p>
                      </div>
                      <Icon name="verified" className="text-emerald-500 text-lg" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Member Section */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748b]">Asignar Nuevo Responsable</h3>
                <div className="flex gap-4">
                  <select
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004b98] outline-none appearance-none"
                    onChange={(e) => {
                      if (e.target.value) handleAddMember(e.target.value);
                    }}
                  >
                    <option value="">Selecciona un colaborador...</option>
                    {allEmployees.filter(emp => !empleados.some(current => current.id === emp.id)).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.usuario?.nombre || emp.nombre}</option>
                    ))}
                  </select>
                  <div className="bg-[#f1f5f9] p-3 rounded-xl">
                    <Icon name="person_add" className="text-[#004b98]" />
                  </div>
                </div>
                {addingMember && <p className="text-[10px] font-bold text-blue-600 animate-pulse">Procesando asignación...</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800;900&display=swap');
        
        :root { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}</style>
    </div>
  );
}

// Reusable KPI Component
function KPIItem({ title, val, sub, icon, color, barVal }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 group">
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">{title}</p>
        <Icon name={icon} className="text-2xl" style={{ color }} />
      </div>
      <div>
        <h3 className="text-4xl font-black tracking-tight text-[#1e1e1e]">{val}</h3>
        <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ backgroundColor: color, width: `${barVal ?? 100}%` }}
        ></div>
      </div>
    </div>
  );
}