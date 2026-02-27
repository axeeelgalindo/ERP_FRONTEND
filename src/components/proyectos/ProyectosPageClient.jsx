"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProyectoFormModal from "@/components/proyectos/ProyectoFormModal";
import ProjectsTable from "@/components/proyectos/ProjectsTable";

import { Filter, Plus, Folder, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  calcProgresoProyecto,
  calcRangoPlanProyecto,
} from "@/lib/proyectos/progreso";

function StatCard({ icon: Icon, iconBg, iconColor, tag, title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {tag ? (
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
            {tag}
          </span>
        ) : null}
      </div>
      <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

// flatten ventas desde cotizaciones para que ClientsCell(ventas) funcione
function extractVentasFromProyecto(p) {
  const cotis = Array.isArray(p?.cotizaciones) ? p.cotizaciones : [];
  const out = [];
  for (const c of cotis) {
    const ventas = Array.isArray(c?.ventas) ? c.ventas : [];
    for (const v of ventas) out.push(v);
  }
  return out;
}

export default function ProyectosPageClient({
  items = [],
  total = 0,
  page = 1,
  pageSize = 10,
  loading = false,
  error = "",
  // handlers (puedes conectarlos a tu modal/API)
  onEditProyecto,
  onDeleteProyecto,
  onStartProyecto,
  onFinishProyecto,
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(pageSize) || 10)));

  // ✅ aquí calculamos progreso y fechas plan usando src/lib/proyectos/progreso.js
  const rows = useMemo(() => {
    const list = Array.isArray(items) ? items : [];

    return list.map((p) => {
      const progresoPct = calcProgresoProyecto(p);

      const rango = calcRangoPlanProyecto(p);
      const fecha_inicio_plan = p?.fecha_inicio_plan || rango.inicio;
      const fecha_fin_plan = p?.fecha_fin_plan || rango.fin;

      const ventas = extractVentasFromProyecto(p);

      return {
        ...p,
        progresoPct, // ProjectsTable lo lee
        fecha_inicio_plan,
        fecha_fin_plan,
        ventas, // ClientsCell lo lee
      };
    });
  }, [items]);

  const stats = useMemo(() => {
    const list = rows;

    const totalProyectos = Number(total) || list.length;

    let enCurso = 0;
    let completados = 0;
    let proximosVenc = 0;

    const now = new Date();
    const soonDays = 7;

    for (const p of list) {
      const estado = String(p?.estado || "activo").toLowerCase();
      const isCompletado = ["completado", "completa", "finalizado", "cerrado"].includes(estado);
      const isPausado = ["pausado", "pause", "detenido"].includes(estado);

      if (isCompletado) completados += 1;
      else if (!isPausado) enCurso += 1;

      if (p?.fecha_fin_plan) {
        const end = new Date(p.fecha_fin_plan);
        if (!Number.isNaN(end.getTime())) {
          const diffDays = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= soonDays && !isCompletado) proximosVenc += 1;
        }
      }
    }

    return { totalProyectos, enCurso, completados, proximosVenc };
  }, [rows, total]);

  const goTo = (newPage) => {
    const p = Math.max(1, Math.min(totalPages, newPage));
    const qs = new URLSearchParams({
      page: String(p),
      pageSize: String(pageSize),
    }).toString();
    router.push(`/proyectos?${qs}`);
  };

  return (
    <div className="p-4 lg:p-8 bg-gray-100 dark:bg-slate-900 min-h-[calc(100vh-64px)]">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proyectos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Crea, edita y gestiona el avance de tus proyectos de forma eficiente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            onClick={() => alert("Filtros: pendiente")}
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
          </button>

          <button
            type="button"
            className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            onClick={() => setOpenModal(true)}
          >
            <Plus className="w-5 h-5" />
            Nuevo proyecto
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Folder}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          tag="+12%"
          title="Total Proyectos"
          value={stats.totalProyectos}
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-green-50 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          title="En Curso"
          value={stats.enCurso}
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          tag="Atención"
          title="Próximo Vencimiento"
          value={0}
        />
        <StatCard
          icon={CheckCircle2}
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
          title="Completados"
          value={0}
        />
      </div>

      {/* TABLE CARD */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <ProjectsTable
          rows={rows}
          loading={loading}
          error={error}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => goTo(p)}
          onEdit={(row) => onEditProyecto?.(row)}
          onDelete={(row) => onDeleteProyecto?.(row)}
          onStart={(row) => onStartProyecto?.(row)}
          onFinish={(row) => onFinishProyecto?.(row)}
        />
      </div>

      {/* MODAL NUEVO PROYECTO */}
      <ProyectoFormModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        mode="create"
        initialProyecto={null}
        onSaved={() => {
          setOpenModal(false);
          router.refresh();
        }}
      />
    </div>
  );
}