"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // 👈 nuevo
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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
  const router = useRouter(); // 👈

  const [bundle, setBundle] = useState(null);
  const [err, setErr] = useState("");
  const [periodo, setPeriodo] = useState('mensual'); // 👈 nuevo estado
  const [refDate, setRefDate] = useState(new Date());

  // 👇 redirección si NO hay sesión
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // si no hay token todavía, no cargamos nada
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

    // solo intento cargar si estamos autenticados
    if (status === "authenticated") {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [session, status, periodo, refDate]);

  // Mientras NextAuth resuelve la sesión (o justo antes de redirigir)
  if (status === "loading" || status === "unauthenticated") {
    return <div className="px-4 py-8">Cargando…</div>;
  }

  // (opcional) este if ya no es necesario, porque para llegar acá ya hay sesión
  // lo dejo solo como backup por si acaso
  if (!session) return null;

  if (err)
    return (
      <div className="px-4 py-8">
        <p className="text-red-600 font-medium">Error al cargar datos:</p>
        <p className="text-sm">{err}</p>
      </div>
    );

  if (!bundle) return <div className="px-4 py-8">Cargando información…</div>;


  // ⚠ tu /me es { user, scope }
  const me = bundle.me?.user ?? {};
  const empresa = me?.empresa ?? null;
  const rolNombre = me?.rol?.nombre ?? "";
  const rolCodigo = me?.rol?.codigo ?? "";
  const userName = me?.nombre ?? session?.user?.name ?? "Usuario";

  const count = (x) =>
    Array.isArray(x)
      ? x.length
      : Array.isArray(x?.items)
        ? x.items.length
        : Array.isArray(x?.data)
          ? x.data.length
          : 0;

  // Formateadores
  const money = (n) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(Number(n || 0));

  // --- METRICS DESDE EL BACKEND ---
  const dbData = bundle.dashboard || {};
  
  // Helpers de navegación con Selects
  const handleScaleSelect = (scale) => {
    setPeriodo(scale);
    setRefDate(new Date()); // Reseteamos al presente al cambiar de escala
  };

  const handleWeekSelect = (e) => {
    const offset = Number(e.target.value);
    const nd = new Date(); // base actual
    nd.setDate(nd.getDate() + (offset * 7));
    setRefDate(nd);
  };

  const handleMonthSelect = (e) => {
    const nd = new Date(refDate);
    nd.setMonth(Number(e.target.value));
    setRefDate(nd);
  };

  const handleYearSelect = (e) => {
    const nd = new Date(refDate);
    nd.setFullYear(Number(e.target.value));
    setRefDate(nd);
  };

  // KPIs
  const {
    ventasMes = 0,
    facturadoMes = 0,
    cotizadoMes = 0,
    comprasSemana = 0,
    devengadoSemana = 0,
    ingresosMes = 0,
    flujoCajaMes = 0
  } = dbData.kpis || {};

  // Charts
  const pieTrabajos = dbData.charts?.trabajosMes || [];
  const pieCotizaciones = dbData.charts?.cotizacionesMes || [];
  const pieFlujo = dbData.charts?.flujoCaja || [];
  const barChartDataset = dbData.charts?.evolucion6Meses || [];

  // Flags for rendering "Sin Datos"
  const { proyectosMesActivo, cotizacionesMesDataActivo } = dbData.flags || {};



  // Render principal
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Dashboard, {userName.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm">
            Vista general y resúmenes financieros. Rol: <span className="font-medium text-slate-700">{rolNombre || rolCodigo}</span>
            {empresa?.nombre ? (
              <>
                {" "}· Empresa: <span className="font-medium text-slate-700">{empresa.nombre}</span>
              </>
            ) : null}
          </p>
        </div>
        
        {/* Componente de Filtros Avanzado */}
        <div className="flex flex-col sm:flex-row items-center gap-4 self-start md:self-auto bg-white border border-slate-200 p-1.5 rounded-lg shadow-sm">
          {/* Tipo de Periodo (Escala) */}
          <div className="flex bg-slate-100 p-1 rounded-md">
            <button onClick={() => handleScaleSelect('semanal')} className={`px-3 py-1 text-sm font-bold rounded flex-1 transition-colors ${periodo === 'semanal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semana</button>
            <button onClick={() => handleScaleSelect('mensual')} className={`px-3 py-1 text-sm font-bold rounded flex-1 transition-colors ${periodo === 'mensual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Mes</button>
            <button onClick={() => handleScaleSelect('anual')} className={`px-3 py-1 text-sm font-bold rounded flex-1 transition-colors ${periodo === 'anual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Año</button>
          </div>

          <div className="flex items-center gap-2 pr-2">
            {periodo === 'semanal' && (
              <select 
                key="week-select"
                className="text-sm font-bold bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer outline-none w-full sm:w-auto min-w-[140px]"
                defaultValue={0} 
                onChange={handleWeekSelect}
              >
                <option value={0}>Esta semana</option>
                <option value={-1}>Semana pasada</option>
                <option value={-2}>Hace 2 semanas</option>
                <option value={-3}>Hace 3 semanas</option>
                <option value={-4}>Hace 4 semanas</option>
              </select>
            )}

            {periodo === 'mensual' && (
              <>
                <select 
                  className="text-sm font-bold bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer outline-none"
                  value={refDate.getMonth()} 
                  onChange={handleMonthSelect}
                >
                  {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <span className="text-slate-300">/</span>
              </>
            )}

            {(periodo === 'mensual' || periodo === 'anual') && (
              <select 
                className="text-sm font-bold bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer outline-none"
                value={refDate.getFullYear()} 
                onChange={handleYearSelect}
              >
                {(dbData.availableYears || [new Date().getFullYear()]).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* 5 KPIs Clave Solicitados */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 xl:gap-6">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ventas</div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{money(ventasMes)}</div>
            <div className="mt-2 text-[11px] text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-0.5 rounded">Órdenes de Venta</div>
          </div>
          
          {/* Cuadro algo más pequeño para Cotizados */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Cotizados</span>
            <span className="text-sm font-extrabold text-slate-700">{money(cotizadoMes)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Facturado</div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{money(facturadoMes)}</div>
            <div className="mt-2 text-[11px] text-indigo-600 font-bold bg-indigo-50 inline-block px-2 py-0.5 rounded">Facturación Real</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Generado (EV)</div>
            <div className="text-3xl font-extrabold text-blue-600 tracking-tight">{money(devengadoSemana)}</div>
            <div className="mt-2 text-[11px] text-blue-600 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded">Devengado de Proyectos</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Compras</div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{money(comprasSemana)}</div>
            <div className="mt-2 text-[11px] text-amber-600 font-bold bg-amber-50 inline-block px-2 py-0.5 rounded">Gasto proyectado OC</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ingresos Mes</div>
            <div className={`text-3xl font-extrabold tracking-tight text-emerald-600`}>
              {money(ingresosMes)}
            </div>
            <div className={`mt-2 text-[11px] font-bold inline-block px-2 py-0.5 rounded text-emerald-600 bg-emerald-50`}>
              Cobros realizados
            </div>
          </div>
        </div>
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-left font-bold text-slate-800 mb-4">Trabajos</h3>
          <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
            {/* Render pie chart if data is present otherwise placeholder */}
            {proyectosMesActivo ? (
              // Simulacro visual rápido de PieChart de MaterialUI (requiere importación en top)
              <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative' }}>
                <PieChartFallback data={pieTrabajos} />
              </div>
            ) : (<span className="text-xs text-slate-400">Sin datos en el periodo</span>)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-left font-bold text-slate-800 mb-4">Cotizaciones</h3>
          <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
            {cotizacionesMesDataActivo ? (
              <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative' }}>
                <PieChartFallback data={pieCotizaciones} />
              </div>
            ) : (<span className="text-xs text-slate-400">Sin datos en el periodo</span>)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-left font-bold text-slate-800 mb-4">Flujo Entrada vs Salida</h3>
          <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
            {(pieFlujo[0]?.value > 0 || pieFlujo[1]?.value > 0) ? (
              <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative' }}>
                <PieChartFallback data={pieFlujo} />
              </div>
            ) : (<span className="text-xs text-slate-400">Sin datos de cobro/pago</span>)}
          </div>
        </div>
      </section>

      {/* Gráfico de Barras */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6">Evolución Ventas y Flujo Caja (6 Meses)</h3>
        <div className="w-full h-[350px] flex items-end justify-between gap-4">
          {barChartDataset.map((d, i) => {
            // Normalizar la altura en base al máximo
            const maxVal = Math.max(...barChartDataset.flatMap(x => [x.ventas, Math.abs(x.flujoNeto)])) || 1;
            const hVentas = (d.ventas / maxVal) * 100;
            const hFlujo = (Math.abs(d.flujoNeto) / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 relative group">
                <div className="w-full h-[80%] flex items-end justify-center gap-1 sm:gap-4 relative px-2">
                  {/* Barra Ventas */}
                  <div className="w-full max-w-[40px] bg-blue-500 rounded-t-lg relative group-hover:bg-blue-600 transition-colors" style={{ height: `${Math.max(2, hVentas)}%` }}></div>
                  {/* Barra Flujo (Si es negativo pintamos diferente o hacia abajo visualmente, aquí se simplifica la barra con color distinto si es en pérdida) */}
                  <div className={`w-full max-w-[40px] rounded-t-lg transition-colors ${d.flujoNeto < 0 ? 'bg-rose-500 group-hover:bg-rose-600' : 'bg-emerald-400 group-hover:bg-emerald-500'}`} style={{ height: `${Math.max(2, hFlujo)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-slate-500 mt-2">{d.mes}</span>

                {/* Tooltip Hover */}
                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-3 py-2 rounded shadow-xl pointer-events-none z-10 whitespace-nowrap">
                  <p className="border-b border-slate-700 pb-1 mb-1 font-bold">{d.mes}</p>
                  <p>Ventas: <span className="text-blue-400">{money(d.ventas)}</span></p>
                  <p>Flujo Neto: <span className={d.flujoNeto < 0 ? 'text-rose-400' : 'text-emerald-400'}>{money(d.flujoNeto)}</span></p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500"></div> Ventas Totales</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-400"></div> Flujo Caja (Positivo)</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-rose-500"></div> Flujo Caja (Pérdida)</span>
        </div>
      </section>

      {/* Se mantienen las Listas Pequeñas Originales Abajo como tablas de últimos registros */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        <ListPreview
          title="Últimos clientes"
          rows={dbData.recents?.clientes || []}
          cols={["nombre", "rut", "correo"]}
          href="/clientes"
        />
        <ListPreview
          title="Últimas compras"
          rows={dbData.recents?.compras || []}
          cols={["numero", "proveedor", "total"]}
          href="/compras"
        />
        <ListPreview
          title="Proyectos"
          rows={dbData.recents?.proyectos || []}
          cols={["nombre", "estado", "createdAt"]}
          href="/proyectos"
        />
        <ListPreview
          title="Cotizaciones Recientes"
          rows={dbData.recents?.cotizaciones || []}
          cols={["titulo", "clienteNombre", "totalOtorgar"]}
          href="/cotizaciones"
        />
      </section>
    </div>
  );
}

// Sub-componente para PieChart nativo simple (Evitando problemas de SSR con MUI Charts)
function PieChartFallback({ data }) {
  // Un render simple circular si el import d3/MUI falla visualmente o en Server Side
  const total = data.reduce((acc, current) => acc + current.value, 0);
  if (total === 0) return <span className="text-xs text-slate-400">Sin valores</span>;

  let currentAngle = 0;
  const conicGradients = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const segment = `${d.color} ${currentAngle}deg ${currentAngle + angle}deg`;
    currentAngle += angle;
    return segment;
  });

  return (
    <div className="flex flex-col items-center w-full gap-6">
      <div
        className="w-32 h-32 rounded-full shadow-inner"
        style={{ background: `conic-gradient(${conicGradients.join(', ')})` }}
      ></div>
      <div className="flex flex-col gap-2 w-full px-4">
        {data.map((d, i) => (
          <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span> {d.label}</span>
            <span>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====== UI helpers ====== */
function ListPreview({ title, rows = [], cols = [], href = "#" }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-sm text-slate-800">{title}</h3>
        <Link className="text-xs font-bold text-[#2074e9] hover:underline" href={href}>
          Ver todo &rarr;
        </Link>
      </div>
      <div>
        {rows.length === 0 ? (
          <div className="text-sm text-slate-400 px-1 py-8 text-center font-medium">
            Sin registros recientes
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <li key={r.id || i} className="py-3 px-5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">
                    {r.nombre ||
                      r.razonSocial ||
                      r.titulo ||
                      r.codigo ||
                      `#${r.id ?? i + 1}`}
                  </div>
                  <div className="text-slate-400 text-[11px] font-medium mt-0.5">
                    {cols
                      .filter((c) => r[c] && c !== "nombre")
                      .slice(0, 3)
                      .map((c, j) => (
                        <span key={c}>
                          {String(r[c])}
                          {j < Math.min(2, cols.length - 1) ? " · " : ""}
                        </span>
                      ))}
                  </div>
                </div>
                <ChevronRightIcon fontSize="small" className="text-slate-300" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
