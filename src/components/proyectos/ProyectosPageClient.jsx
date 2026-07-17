"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProyectoFormModal from "@/components/proyectos/ProyectoFormModal";
import ProjectsTable from "@/components/proyectos/ProjectsTable";
import ActaEntregaModal from "@/components/proyectos/ActaEntregaModal";

import { Filter, Plus, Folder, TrendingUp, AlertTriangle, CheckCircle2, X, Trash2, Play } from "lucide-react";

import {
  calcProgresoProyecto,
  calcRangoPlanProyecto,
} from "@/lib/proyectos/progreso";

function StatCard({ icon: Icon, iconBg, iconColor, tag, title, value }) {
  return (
    <div className="bg-white  p-6 rounded-xl border border-gray-200  shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {tag ? (
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700   rounded-full">
            {tag}
          </span>
        ) : null}
      </div>
      <h3 className="text-gray-500  text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold text-gray-900  mt-1">{value}</p>
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
  const { data: session } = useSession();
  const [openModal, setOpenModal] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState(null);
  const [proyectoToDelete, setProyectoToDelete] = useState(null);
  const [proyectoToStart, setProyectoToStart] = useState(null);
  const [proyectoToFinish, setProyectoToFinish] = useState(null);
  const [proyectoForActa, setProyectoForActa] = useState(null);
  const [toast, setToast] = useState({ open: false, msg: "", type: "success" });

  const triggerToast = (msg, type = "success") => {
    setToast({ open: true, msg, type });
  };

  useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => {
        setToast((t) => ({ ...t, open: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.open]);

  const handleDeleteProyecto = (proyecto) => {
    if (!proyecto?.id) return;
    setProyectoToDelete(proyecto);
  };

  const executeDeleteProyecto = async (proyecto) => {
    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
      
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const API = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API}/proyectos/delete/${proyecto.id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({}), // ✅ Avoid empty body parser crash in Fastify
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al eliminar proyecto");
      }

      triggerToast("Proyecto eliminado correctamente", "success");
      router.refresh();
    } catch (err) {
      triggerToast(err.message || "Error al eliminar el proyecto", "error");
    }
  };

  const handleStartProyecto = (proyecto) => {
    if (!proyecto?.id) return;
    setProyectoToStart(proyecto);
  };

  const executeStartProyecto = async (proyecto) => {
    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
      
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const API = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API}/proyectos/${proyecto.id}/iniciar`, {
        method: "POST",
        headers,
        body: JSON.stringify({}), // ✅ Avoid empty body parser crash in Fastify
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al iniciar proyecto");
      }

      triggerToast("Proyecto iniciado correctamente", "success");
      router.refresh();
    } catch (err) {
      triggerToast(err.message || "Error al iniciar el proyecto", "error");
    }
  };

  const handleFinishProyecto = (proyecto) => {
    if (!proyecto?.id) return;
    setProyectoToFinish(proyecto);
  };

  const executeFinishProyecto = async (proyecto) => {
    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
      
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const API = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API}/proyectos/${proyecto.id}/finalizar`, {
        method: "POST",
        headers,
        body: JSON.stringify({}), // ✅ Avoid empty body parser crash in Fastify
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al finalizar proyecto");
      }

      triggerToast("Proyecto finalizado correctamente", "success");
      router.refresh();
    } catch (err) {
      triggerToast(err.message || "Error al finalizar el proyecto", "error");
    }
  };

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
    <div className="p-4 lg:p-8 bg-gray-100  min-h-[calc(100vh-64px)]">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 ">Proyectos</h1>
          <p className="text-gray-500  mt-1">
            Crea, edita y gestiona el avance de tus proyectos de forma eficiente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 bg-white  border border-gray-200  text-gray-600  px-4 py-2 rounded-lg hover:bg-gray-50  transition-colors shadow-sm"
            onClick={() => alert("Filtros: pendiente")}
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
          </button>

          <button
            type="button"
            className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            onClick={() => {
              setEditingProyecto(null);
              setOpenModal(true);
            }}
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
          iconBg="bg-blue-50 "
          iconColor="text-blue-600 "
          tag="+12%"
          title="Total Proyectos"
          value={stats.totalProyectos}
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-green-50 "
          iconColor="text-green-600 "
          title="En Curso"
          value={stats.enCurso}
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="bg-amber-50 "
          iconColor="text-amber-600 "
          tag="Atención"
          title="Próximo Vencimiento"
          value={0}
        />
        <StatCard
          icon={CheckCircle2}
          iconBg="bg-indigo-50 "
          iconColor="text-indigo-600 "
          title="Completados"
          value={0}
        />
      </div>

      {/* TABLE CARD */}
      <div className="bg-white  rounded-xl border border-gray-200  shadow-sm overflow-hidden">
        <ProjectsTable
          rows={rows}
          loading={loading}
          error={error}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => goTo(p)}
          onEdit={(row) => {
            setEditingProyecto(row);
            setOpenModal(true);
          }}
          onDelete={handleDeleteProyecto}
          onStart={handleStartProyecto}
          onFinish={handleFinishProyecto}
          onActaEntrega={(row) => setProyectoForActa(row)}
        />
      </div>

      {/* MODAL NUEVO/EDITAR PROYECTO */}
      <ProyectoFormModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setTimeout(() => setEditingProyecto(null), 200);
        }}
        mode={editingProyecto ? "edit" : "create"}
        initialProyecto={editingProyecto}
        onSaved={() => {
          setOpenModal(false);
          setTimeout(() => setEditingProyecto(null), 200);
          triggerToast(
            editingProyecto
              ? "Proyecto actualizado correctamente"
              : "Proyecto creado correctamente",
            "success"
          );
          router.refresh();
        }}
      />

      {/* MODAL ACTA DE ENTREGA */}
      <ActaEntregaModal
        open={!!proyectoForActa}
        onClose={() => setProyectoForActa(null)}
        proyecto={proyectoForActa}
      />

      {/* CONFIRM DELETE MODAL */}
      {proyectoToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 transition-all transform scale-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Eliminar Proyecto</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar el proyecto <span className="font-semibold text-gray-800">"{proyectoToDelete.nombre}"</span>? Esta acción es irreversible y borrará toda la información relacionada.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProyectoToDelete(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium hover:cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = proyectoToDelete;
                  setProyectoToDelete(null);
                  executeDeleteProyecto(p);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md shadow-red-600/10 hover:cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM START MODAL */}
      {proyectoToStart && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 transition-all transform scale-100">
            <div className="flex items-center gap-3 text-green-600 mb-4">
              <div className="p-2 bg-green-50 rounded-full">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Iniciar Proyecto</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas iniciar el proyecto <span className="font-semibold text-gray-800">"{proyectoToStart.nombre}"</span>? Esto registrará la fecha de inicio real de hoy.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProyectoToStart(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium hover:cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = proyectoToStart;
                  setProyectoToStart(null);
                  executeStartProyecto(p);
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md shadow-green-600/10 hover:cursor-pointer"
              >
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM FINISH MODAL */}
      {proyectoToFinish && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 transition-all transform scale-100">
            <div className="flex items-center gap-3 text-indigo-600 mb-4">
              <div className="p-2 bg-indigo-50 rounded-full">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Finalizar Proyecto</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas finalizar el proyecto <span className="font-semibold text-gray-800">"{proyectoToFinish.nombre}"</span>? Esto registrará la fecha de término real de hoy y cambiará su estado a Finalizado.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProyectoToFinish(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium hover:cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = proyectoToFinish;
                  setProyectoToFinish(null);
                  executeFinishProyecto(p);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md shadow-indigo-600/10 hover:cursor-pointer"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TOAST NOTIFICATION SYSTEM */}
      {toast.open && (
        <div className="fixed bottom-5 right-5 z-[10001] flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-gray-800 animate-slide-in min-w-[320px] max-w-md">
          {toast.type === "success" ? (
            <div className="p-1 bg-green-500/20 text-green-400 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1 bg-red-500/20 text-red-400 rounded-full">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 text-sm font-medium">{toast.msg}</div>
          <button
            onClick={() => setToast((t) => ({ ...t, open: false }))}
            className="text-gray-400 hover:text-white transition-colors hover:cursor-pointer"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}