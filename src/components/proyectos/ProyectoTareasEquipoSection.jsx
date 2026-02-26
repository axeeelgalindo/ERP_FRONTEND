"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardContent,
  Tooltip,
  CircularProgress,
  Stack,
  Button,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import dayjs from "dayjs";

import AssignEpicToTaskModal from "./tareas/AssignEpicToTaskModal";
import WizardEpicaTareasSubtareasModal from "./tareas/WizardEpicaTareasSubtareasModal";
import AddTareaModal from "./tareas/AddTareaButton";
import ImportJiraCsvButton from "./tareas/ImportJiraCsvButton";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

import EpicaFormModal from "./tareas/modals/EpicaFormModal";
import TareaFormModal from "./tareas/modals/TareaFormModal";
import SubtareaFormModal from "./tareas/modals/SubtareaFormModal";

import TasksTreePremium from "./tareas/TasksTreePremium";

const API = process.env.NEXT_PUBLIC_API_URL;

const ACCION_LABELS = {
  start: {
    title: "Iniciar actividad",
    description:
      "Esto marcará la subtarea como 'En progreso' y registrará la fecha/hora de inicio real.",
    confirmText: "Sí, iniciar actividad",
  },
  finish: {
    title: "Finalizar actividad",
    description:
      "Esto marcará la subtarea como 'Completada' y registrará la fecha/hora de término real.",
    confirmText: "Sí, finalizar actividad",
  },
  reset: {
    title: "Reiniciar a pendiente",
    description:
      "Esto volverá la subtarea al estado 'Pendiente' y limpiará sus fechas reales.",
    confirmText: "Sí, reiniciar a pendiente",
  },
};

function clampPct(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

// stats por épica
function computeEpicStats(tareas) {
  if (!tareas?.length) {
    return {
      avance: 0,
      estado: "pendiente",
      fecha_inicio_plan: null,
      fecha_fin_plan: null,
      totalTareas: 0,
      totalSubtareas: 0,
      subtareasCompletadas: 0,
    };
  }

  const avances = tareas.map((t) => clampPct(t.avance));
  const avgAvance = Math.round(
    avances.reduce((a, b) => a + b, 0) / Math.max(1, avances.length),
  );

  let estado = "pendiente";
  if (avgAvance >= 100) estado = "completada";
  else if (avgAvance > 0) estado = "en_progreso";

  let minInicio = null;
  let maxFin = null;

  let totalSubtareas = 0;
  let subtareasCompletadas = 0;

  for (const t of tareas) {
    if (t.fecha_inicio_plan) {
      const d = new Date(t.fecha_inicio_plan);
      if (!Number.isNaN(d.getTime())) {
        if (!minInicio || d < minInicio) minInicio = d;
      }
    }
    if (t.fecha_fin_plan) {
      const d = new Date(t.fecha_fin_plan);
      if (!Number.isNaN(d.getTime())) {
        if (!maxFin || d > maxFin) maxFin = d;
      }
    }

    const detalles = t.detalles || t.detalle || t.tareasDetalle || [];
    totalSubtareas += detalles.length;
    subtareasCompletadas += detalles.filter(
      (d) => d.estado === "completada",
    ).length;
  }

  return {
    avance: avgAvance,
    estado,
    fecha_inicio_plan: minInicio,
    fecha_fin_plan: maxFin,
    totalTareas: tareas.length,
    totalSubtareas,
    subtareasCompletadas,
  };
}

export default function ProyectoTareasEquipoSection({
  proyectoId,
  tareas,
  miembros,
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const [modalOpen, setModalOpen] = useState(false);

  // EPICA modal
  const [epicaModalOpen, setEpicaModalOpen] = useState(false);
  const [editingEpica, setEditingEpica] = useState(null);

  // TAREA modal
  const [tareaModalOpen, setTareaModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [presetEpicaId, setPresetEpicaId] = useState(null);

  // SUBTAREA modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subTareaParent, setSubTareaParent] = useState(null);
  const [editingSub, setEditingSub] = useState(null);

  const [assignEpicOpen, setAssignEpicOpen] = useState(false);
  const [assignEpicTarea, setAssignEpicTarea] = useState(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEpicaPreselectId, setWizardEpicaPreselectId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // expand/collapse
  const [expandedEpicaIds, setExpandedEpicaIds] = useState([]);
  const [expandedTareaIds, setExpandedTareaIds] = useState([]);

  // update subtarea action
  const [updatingDetalleId, setUpdatingDetalleId] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false,
    detalle: null,
    accion: null,
  });

  const openNewEpica = () => {
    setEditingEpica(null);
    setEpicaModalOpen(true);
  };

  const openEditEpica = (ep) => {
    setEditingEpica(ep);
    setEpicaModalOpen(true);
  };

  const openNewTarea = () => {
    setEditingTarea(null);
    setPresetEpicaId(null);
    setTareaModalOpen(true);
  };

  const openNewTareaInEpica = (ep) => {
    setEditingTarea(null);
    setPresetEpicaId(ep?.id || null);
    setTareaModalOpen(true);
  };

  const openEditTarea = (t) => {
    setEditingTarea(t);
    setPresetEpicaId(null);
    setTareaModalOpen(true);
  };

  const openNewSubtarea = (t) => {
    setSubTareaParent(t);
    setEditingSub(null);
    setSubModalOpen(true);
  };

  const openEditSubtarea = (t, d) => {
    setSubTareaParent(t);
    setEditingSub(d?.__delete ? { ...d, __delete: false } : d);
    setSubModalOpen(true);
  };

  const openAssignEpic = (t, ev) => {
    ev?.stopPropagation?.();
    setAssignEpicTarea(t);
    setAssignEpicOpen(true);
  };

  const openWizard = (epicaId = null, ev) => {
    ev?.stopPropagation?.();
    setWizardEpicaPreselectId(epicaId);
    setWizardOpen(true);
  };

  // ====== EPICAS (state + reload) ======
  const [epicas, setEpicas] = useState([]);
  const [loadingEpicas, setLoadingEpicas] = useState(false);

  const reloadEpicas = async () => {
    if (!session?.user || !proyectoId) return;

    try {
      setLoadingEpicas(true);
      const res = await fetch(`${API}/epicas?proyectoId=${proyectoId}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && Array.isArray(json.rows)) setEpicas(json.rows);
      else setEpicas([]);
    } catch (e) {
      console.error("Error cargando épicas", e);
      setEpicas([]);
    } finally {
      setLoadingEpicas(false);
    }
  };

  useEffect(() => {
    reloadEpicas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, proyectoId]);

  const epicasById = useMemo(() => {
    const m = new Map();
    for (const e of epicas || []) if (e?.id) m.set(e.id, e);
    return m;
  }, [epicas]);

  const handleAddClick = () => {
    setEditingTarea(null);
    setModalOpen(true);
  };

  const handleSaved = async () => {
    setModalOpen(false);
    setEditingTarea(null);
    await reloadEpicas();
    router.refresh();
  };

  const toggleExpandedEpica = (epicaId, ev) => {
    ev?.stopPropagation?.();
    setExpandedEpicaIds((prev) =>
      prev.includes(epicaId)
        ? prev.filter((id) => id !== epicaId)
        : [...prev, epicaId],
    );
  };

  const toggleExpandedTarea = (tId, ev) => {
    ev?.stopPropagation?.();
    setExpandedTareaIds((prev) =>
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId],
    );
  };

  const handleDelete = async (t, ev) => {
    ev?.stopPropagation?.();
    if (
      !window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")
    )
      return;

    try {
      setDeletingId(t.id);

      const headers = { ...makeHeaders(session) };
      delete headers["Content-Type"];
      delete headers["content-type"];

      const res = await fetch(`${API}/tareas/delete/${t.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json().catch(() => null);

      if (!res.ok)
        throw new Error(
          json?.message || json?.msg || "Error al eliminar tarea",
        );

      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al eliminar la tarea");
    } finally {
      setDeletingId(null);
    }
  };

  const getAccionFromEstado = (estado) => {
    if (estado === "pendiente") return "start";
    if (estado === "en_progreso") return "finish";
    return "reset";
  };

  const getAccionIcon = (estado) => {
    if (estado === "pendiente") return <PlayArrowIcon fontSize="small" />;
    if (estado === "en_progreso")
      return <CheckCircleOutlineIcon fontSize="small" />;
    return <ReplayIcon fontSize="small" />;
  };

  const getAccionTooltip = (estado) => {
    if (estado === "pendiente") return "Iniciar actividad";
    if (estado === "en_progreso") return "Finalizar actividad";
    return "Reiniciar a pendiente";
  };

  const handleActionIconClick = (detalle, ev) => {
    ev?.stopPropagation?.();
    if (!session?.user) return;
    const accion = getAccionFromEstado(detalle.estado);
    setConfirmState({ open: true, detalle, accion });
  };

  const handleCloseConfirmModal = () => {
    setConfirmState({ open: false, detalle: null, accion: null });
  };

  const handleConfirmAccion = async () => {
    const { detalle, accion } = confirmState;
    if (!detalle || !accion || !session?.user) return;

    try {
      setUpdatingDetalleId(detalle.id);

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      const res = await fetch(`${API}/tareas-detalle/update/${detalle.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ accion }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          json?.message || json?.msg || "Error al actualizar subtarea",
        );

      handleCloseConfirmModal();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al actualizar la subtarea");
    } finally {
      setUpdatingDetalleId(null);
    }
  };

  // ========= AGRUPAR POR ÉPICA (MOSTRAR INCLUSO VACÍAS) =========
  const epicasAgrupadas = useMemo(() => {
    const map = new Map();

    // 1) Pre-cargar todas las épicas (aunque no tengan tareas)
    for (const e of epicas || []) {
      if (!e?.id) continue;
      map.set(e.id, {
        id: e.id,
        nombre: e.nombre?.trim() || "Épica sin nombre",
        tareas: [],
      });
    }

    // 2) Bucket "Sin épica" (por si hay tareas sin épica)
    map.set("SIN_EPICA", { id: "SIN_EPICA", nombre: "Sin épica", tareas: [] });

    // 3) Meter tareas dentro de su épica
    const lista = Array.isArray(tareas) ? tareas : [];
    for (const t of lista) {
      const epId = t?.epica?.id || t?.epica_id || "SIN_EPICA";

      if (!map.has(epId)) {
        const epNombre =
          epId === "SIN_EPICA"
            ? "Sin épica"
            : epicasById.get(epId)?.nombre?.trim() ||
              t?.epica?.nombre?.trim() ||
              "Épica sin nombre";

        map.set(epId, { id: epId, nombre: epNombre, tareas: [] });
      }

      map.get(epId).tareas.push(t);
    }

    const rows = Array.from(map.values()).sort((a, b) => {
      if (a.id === "SIN_EPICA") return 1;
      if (b.id === "SIN_EPICA") return -1;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });

    for (const ep of rows) {
      ep.tareas = [...ep.tareas].sort((a, b) => {
        const oa = a.orden ?? 0;
        const ob = b.orden ?? 0;
        if (oa !== ob) return oa - ob;
        return (
          dayjs(a.fecha_inicio_plan).valueOf() -
          dayjs(b.fecha_inicio_plan).valueOf()
        );
      });
      ep.stats = computeEpicStats(ep.tareas);
    }

    return rows;
  }, [tareas, epicas, epicasById]);

  const currentAccionConfig =
    confirmState.accion && ACCION_LABELS[confirmState.accion]
      ? ACCION_LABELS[confirmState.accion]
      : null;

  const confirmTitle =
    currentAccionConfig?.title || "Confirmar acción en subtarea";

  const renderSubtareaAccionCell = (d) => {
    const isUpdating = updatingDetalleId === d.id;
    if (isUpdating) return <CircularProgress size={18} />;

    return (
      <Tooltip title={getAccionTooltip(d.estado)}>
        <button
          type="button"
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
          onClick={(ev) => handleActionIconClick(d, ev)}
        >
          {getAccionIcon(d.estado)}
        </button>
      </Tooltip>
    );
  };

  return (
    <>
      <Card>
        <CardContent sx={{ p: 2 }}>
          {loadingEpicas ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Cargando épicas...
              </Typography>
            </Box>
          ) : epicasAgrupadas.length === 0 ? (
            <Alert severity="info">
              Aún no hay tareas para este proyecto. Usa <b>Agregar tarea</b> o{" "}
              <b>Importar Jira (CSV)</b>.
            </Alert>
          ) : (
            <TasksTreePremium
              proyectoId={proyectoId}
              epicasAgrupadas={epicasAgrupadas}
              expandedEpicaIds={expandedEpicaIds}
              expandedTareaIds={expandedTareaIds}
              deletingId={deletingId}
              onToggleEpica={(epId, ev) => toggleExpandedEpica(epId, ev)}
              onToggleTarea={(tId, ev) => toggleExpandedTarea(tId, ev)}
              onOpenNewEpica={openNewEpica}
              onOpenWizard={() => openWizard(null)}
              onOpenNewTarea={openNewTarea}
              onEditEpica={openEditEpica}
              onNewTareaInEpica={openNewTareaInEpica}
              onEditTarea={openEditTarea}
              onDeleteTarea={handleDelete}
              onNewSubtareaInTarea={openNewSubtarea}
              onEditSubtarea={openEditSubtarea}
              renderSubtareaAccionCell={renderSubtareaAccionCell}
            />
          )}
        </CardContent>

        <EpicaFormModal
          open={epicaModalOpen}
          onClose={() => setEpicaModalOpen(false)}
          session={session}
          proyectoId={proyectoId}
          epica={editingEpica}
          onSaved={async () => {
            await reloadEpicas();
            router.refresh();
          }}
        />

        <TareaFormModal
          open={tareaModalOpen}
          onClose={() => setTareaModalOpen(false)}
          session={session}
          proyectoId={proyectoId}
          miembros={miembros}
          epicas={epicas}
          tarea={editingTarea}
          presetEpicaId={presetEpicaId}
          onSaved={async () => {
            await reloadEpicas();
            router.refresh();
          }}
        />

        <SubtareaFormModal
          open={subModalOpen}
          onClose={() => setSubModalOpen(false)}
          session={session}
          tarea={subTareaParent}
          miembros={miembros}
          subtarea={editingSub}
          onSaved={() => router.refresh()}
        />

        {/* MODALES (tu legacy) */}
        <AddTareaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          proyectoId={proyectoId}
          miembros={miembros}
          tarea={editingTarea}
          onSaved={handleSaved}
        />

        <AssignEpicToTaskModal
          open={assignEpicOpen}
          onClose={() => setAssignEpicOpen(false)}
          session={session}
          epicas={epicas}
          tarea={assignEpicTarea}
          onSaved={async () => {
            await reloadEpicas();
            router.refresh();
          }}
        />

        <WizardEpicaTareasSubtareasModal
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          session={session}
          proyectoId={proyectoId}
          epicas={epicas}
          miembros={miembros}
          epicaPreselectId={wizardEpicaPreselectId}
          onSaved={async () => {
            await reloadEpicas();
            router.refresh();
          }}
        />
      </Card>

      {/* CONFIRM MODAL SUBTAREA */}
      <Modal
        open={confirmState.open}
        onClose={handleCloseConfirmModal}
        title={confirmTitle}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {currentAccionConfig?.description ||
              "Confirma la acción que deseas realizar sobre esta subtarea."}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseConfirmModal}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmAccion}
              disabled={
                !!(
                  confirmState.detalle &&
                  updatingDetalleId === confirmState.detalle.id
                )
              }
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {currentAccionConfig?.confirmText || "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
