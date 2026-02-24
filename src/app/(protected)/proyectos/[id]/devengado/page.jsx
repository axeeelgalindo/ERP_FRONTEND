// src/app/(protected)/proyectos/[id]/devengado/page.jsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { serverApi } from "@/lib/api";

function clp(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function pct(v) {
  const n = Number(v || 0);
  return `${Math.round(n)}%`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "2-digit" });
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
        tones[tone] || tones.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="bg-white  border border-slate-200  rounded-2xl p-4 md:p-5 shadow-sm">
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm md:text-base font-extrabold text-slate-900 ">
                {title}
              </h3>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function ProgressBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-full">
      <div className="h-2.5 rounded-full bg-slate-100  overflow-hidden">
        <div className="h-full bg-slate-900 " style={{ width: `${v}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500 ">{pct(v)}</div>
    </div>
  );
}

function TaskRow({ t }) {
  const avance = Number(t?.avance || 0);
  const estado = String(t?.estado || "pendiente");

  let tone = "slate";
  if (avance >= 100 || estado === "completa") tone = "green";
  else if (estado === "en_progreso" || (avance > 0 && avance < 100)) tone = "blue";
  else if (estado === "pendiente") tone = "slate";

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 py-3 border-b border-slate-100  last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={tone}>{(t?.tipo || "").toLowerCase()}</Badge>
          <div className="font-semibold text-slate-900  truncate">
            {t?.nombre || "Sin nombre"}
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-500  flex flex-wrap gap-x-3 gap-y-1">
          <span>Plan: {fmtDate(t?.fecha_inicio_plan)} → {fmtDate(t?.fecha_fin_plan)}</span>
          <span>Real: {fmtDate(t?.fecha_inicio_real)} → {fmtDate(t?.fecha_fin_real)}</span>
          {t?.responsable?.nombre ? <span>Resp: {t.responsable.nombre}</span> : null}
        </div>
      </div>

      <div className="w-full md:w-48">
        <ProgressBar value={avance} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="p-3 md:p-4 rounded-2xl border border-slate-200  bg-white ">
      <div className="text-xs text-slate-500 ">{label}</div>
      <div className="mt-1 text-lg md:text-xl font-black text-slate-900 ">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500 ">{sub}</div> : null}
    </div>
  );
}

export default async function ProyectoDevengadoPage({ params }) {
  // Next 15: params es Promise
  const { id } = await params;

  let data;
  try {
    data = await serverApi(`/proyectos/${id}/reporte-devengado`);
  } catch (err) {
    console.error("Error cargando devengado", err);
    return notFound();
  }

  if (!data?.ok) return notFound();

  const proyecto = data?.proyecto || {};
  const rango = data?.rango || {};
  const tareas = data?.tareas || {};
  const fin = data?.financiero || {};

  const base = fin?.base || {};
  const costos = fin?.costos || {};
  const dev = fin?.devengado || {};

  const avancePct = Number(tareas?.avancePct || 0);
  const usandoSubtareas = Boolean(tareas?.usandoSubtareas);

  const yaPasoCosto = Boolean(dev?.yaPasoCosto);
  const breakevenPct = dev?.breakevenPct != null ? Number(dev.breakevenPct) : null;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 ">
              <Link
                href={`/proyectos/${id}`}
                className="hover:underline text-slate-600 "
              >
                ← Volver al proyecto
              </Link>
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-slate-900  truncate">
              Devengado · {proyecto?.nombre || "Proyecto"}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="purple">proyecto</Badge>
              <Badge tone="slate">avance: {pct(avancePct)}</Badge>
              <Badge tone={base?.fuente === "VENTA" ? "green" : "blue"}>
                base: {base?.fuente || "—"}
              </Badge>
              <Badge tone={yaPasoCosto ? "green" : "yellow"}>
                {yaPasoCosto ? "equilibrio alcanzado" : "aún sin equilibrio"}
              </Badge>
              <Badge tone="slate">
                {usandoSubtareas ? "ponderado por subtareas" : "ponderado por tareas"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 ">
          Semana pasada: {fmtDate(rango?.semanaPasada?.inicio)} → {fmtDate(rango?.semanaPasada?.fin)} ·
          Semana actual: {fmtDate(rango?.semanaActual?.inicio)} → {fmtDate(rango?.semanaActual?.fin)}
        </div>
      </div>

      {/* Resumen KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat
          label="Base del contrato"
          value={clp(base?.valor)}
          sub={`Fuente: ${base?.fuente || "—"} · Vendido: ${clp(base?.valorVendido)} · Cotizado: ${clp(
            base?.valorCotizado
          )}`}
        />
        <Stat
          label="Devengado estimado"
          value={clp(dev?.devengado)}
          sub={`Avance ponderado: ${pct(dev?.avancePct ?? avancePct)}`}
        />
        <Stat
          label="Costo acumulado"
          value={clp(costos?.costoAcumulado)}
          sub={`Compras: ${clp(costos?.totalCompras)} · Rendiciones: ${clp(
            costos?.totalRendiciones
          )} · HH real: ${clp(costos?.valorHHReal)}`}
        />
        <Stat
          label="Utilidad devengada"
          value={clp(dev?.utilidadDevengada)}
          sub={
            yaPasoCosto
              ? "Ya estás sobre el costo (ganancias devengadas positivas)."
              : `Faltan ${clp(dev?.faltanteParaEquilibrio)} para cubrir costos.${
                  breakevenPct != null ? ` (equilibrio aprox en ${pct(breakevenPct)})` : ""
                }`
          }
        />
      </div>

      {/* Bloque equilibrio + barra */}
      <Card
        title="Avance devengado"
        right={<Badge tone={yaPasoCosto ? "green" : "yellow"}>{yaPasoCosto ? "OK" : "Pendiente"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <div className="text-sm text-slate-700  font-semibold mb-2">
              Avance ponderado (por costo/horas plan)
            </div>
            <ProgressBar value={avancePct} />
            {breakevenPct != null && base?.valor > 0 && (
              <div className="mt-3 text-xs text-slate-500 ">
                Punto de equilibrio aprox: <b className="text-slate-700 ">{pct(breakevenPct)}</b>{" "}
                de avance (cuando devengado ≈ costo acumulado).
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Devengado" value={clp(dev?.devengado)} sub={`Base ${base?.fuente || "—"}`} />
            <Stat label="Costo" value={clp(costos?.costoAcumulado)} sub="Compras + rendiciones + HH" />
            <Stat
              label="Diferencia"
              value={clp((Number(dev?.devengado || 0) - Number(costos?.costoAcumulado || 0)) || 0)}
              sub={yaPasoCosto ? "Sobre el costo" : "Bajo el costo"}
            />
            <Stat
              label="Faltante equilibrio"
              value={clp(dev?.faltanteParaEquilibrio)}
              sub={yaPasoCosto ? "—" : "Para cubrir costos"}
            />
          </div>
        </div>
      </Card>

      {/* Listas de tareas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card
          title="Hechas la semana pasada"
          right={<Badge tone="green">{tareas?.conteo?.completadasSemanaPasada || 0}</Badge>}
        >
          {Array.isArray(tareas?.completadasSemanaPasada) && tareas.completadasSemanaPasada.length > 0 ? (
            <div>
              {tareas.completadasSemanaPasada.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 ">No hay tareas terminadas en ese rango.</div>
          )}
        </Card>

        <Card
          title="Tocan esta semana"
          right={<Badge tone="blue">{tareas?.conteo?.enSemanaActual || 0}</Badge>}
        >
          {Array.isArray(tareas?.enSemanaActual) && tareas.enSemanaActual.length > 0 ? (
            <div>
              {tareas.enSemanaActual.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 ">No hay tareas planificadas para esta semana.</div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Atrasadas" right={<Badge tone="red">{tareas?.conteo?.atrasadas || 0}</Badge>}>
          {Array.isArray(tareas?.atrasadas) && tareas.atrasadas.length > 0 ? (
            <div>
              {tareas.atrasadas.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 ">No hay tareas atrasadas 🎉</div>
          )}
        </Card>

        <Card
          title="Pendientes futuras"
          right={<Badge tone="slate">{tareas?.conteo?.pendientesFuturas || 0}</Badge>}
        >
          {Array.isArray(tareas?.pendientesFuturas) && tareas.pendientesFuturas.length > 0 ? (
            <div>
              {tareas.pendientesFuturas.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 ">No hay pendientes futuras registradas.</div>
          )}
        </Card>
      </div>

      {/* Footer mini */}
      <div className="text-xs text-slate-500 ">
        Nota: el devengado se calcula como <b>Base ({base?.fuente || "—"}) × Avance ponderado</b>. El avance ponderado
        usa costo plan / horas plan cuando existen, para que no todas las tareas “pesen igual”.
      </div>
    </div>
  );
}