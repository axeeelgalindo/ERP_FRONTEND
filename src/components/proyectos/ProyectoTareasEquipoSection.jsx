// src/components/proyectos/ProyectoTareasEquipoSection.jsx
"use client";

import React, { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Chip,
  Box,
  LinearProgress,
  Typography,
  Button,
  Collapse,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import dayjs from "dayjs";

import AddTareaModal from "./tareas/AddTareaButton";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

function formatDate(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? d : d.toISOString();
  return dt.slice(0, 10);
}

const ESTADO_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
};

// helper para labels del modal según acción
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

export default function ProyectoTareasEquipoSection({
  proyectoId,
  tareas,
  miembros,
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState([]);
  const [updatingDetalleId, setUpdatingDetalleId] = useState(null);

  // modal de confirmación de acción (start/finish/reset)
  const [confirmState, setConfirmState] = useState({
    open: false,
    detalle: null,
    accion: null,
  });

  const handleAddClick = () => {
    setEditingTarea(null);
    setModalOpen(true);
  };

  const handleRowClick = (t) => {
    setEditingTarea(t);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingTarea(null);
    router.refresh();
  };

  const toggleExpanded = (tId, ev) => {
    ev.stopPropagation();
    setExpandedIds((prev) =>
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId]
    );
  };

  const handleDelete = async (t, ev) => {
    ev.stopPropagation();
    if (
      !window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")
    ) {
      return;
    }

    try {
      setDeletingId(t.id);

      // DELETE sin body, sin Content-Type
      const headers = { ...makeHeaders(session) };
      delete headers["Content-Type"];
      delete headers["content-type"];

      const res = await fetch(`${API}/tareas/delete/${t.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al eliminar tarea"
        );
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al eliminar la tarea");
    } finally {
      setDeletingId(null);
    }
  };

  // decide la acción según el estado actual de la subtarea
  const getAccionFromEstado = (estado) => {
    if (estado === "pendiente") return "start";
    if (estado === "en_progreso") return "finish";
    return "reset"; // completada
  };

  const getAccionIcon = (estado) => {
    if (estado === "pendiente") {
      return <PlayArrowIcon fontSize="small" />;
    }
    if (estado === "en_progreso") {
      return <CheckCircleOutlineIcon fontSize="small" />;
    }
    return <ReplayIcon fontSize="small" />; // completada
  };

  const getAccionTooltip = (estado) => {
    if (estado === "pendiente") return "Iniciar actividad";
    if (estado === "en_progreso") return "Finalizar actividad";
    return "Reiniciar a pendiente";
  };

  // cuando se hace click en el icono de acción
  const handleActionIconClick = (detalle, ev) => {
    ev.stopPropagation();
    if (!session?.user) return;

    const accion = getAccionFromEstado(detalle.estado);
    setConfirmState({
      open: true,
      detalle,
      accion,
    });
  };

  const handleCloseConfirmModal = () => {
    setConfirmState({
      open: false,
      detalle: null,
      accion: null,
    });
  };

  // Confirmar acción en el modal → llama al backend
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
        body: JSON.stringify({ accion }), // 👈 solo mandamos la acción; el backend calcula todo
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al actualizar subtarea"
        );
      }

      handleCloseConfirmModal();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al actualizar la subtarea");
    } finally {
      setUpdatingDetalleId(null);
    }
  };

  const tareasOrdenadas = useMemo(() => {
    return [...(tareas || [])].sort((a, b) => {
      const oa = a.orden ?? 0;
      const ob = b.orden ?? 0;
      if (oa !== ob) return oa - ob;
      return (
        dayjs(a.fecha_inicio_plan).valueOf() -
        dayjs(b.fecha_inicio_plan).valueOf()
      );
    });
  }, [tareas]);

  const currentAccionConfig =
    confirmState.accion && ACCION_LABELS[confirmState.accion]
      ? ACCION_LABELS[confirmState.accion]
      : null;

  const confirmTitle =
    currentAccionConfig?.title || "Confirmar acción en subtarea";

  return (
    <>
      <Card sx={{ mt: 4 }}>
        <CardHeader
          title="Tareas del proyecto"
          subheader="Planificación, responsables y avance"
          action={
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
            >
              Agregar tarea
            </Button>
          }
        />
        <CardContent sx={{ p: 0 }}>
          {tareasOrdenadas.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Aún no hay tareas para este proyecto. Usa el botón
                <strong> “Agregar tarea”</strong> para comenzar la planificación.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell>Nombre</TableCell>
                    <TableCell>Responsable</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Inicio plan</TableCell>
                    <TableCell>Fin plan</TableCell>
                    <TableCell width={180}>Avance</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tareasOrdenadas.map((t) => {
                    const responsableNombre =
                      t.responsable?.usuario?.nombre ||
                      t.responsable?.usuario?.correo ||
                      "—";

                    const detalles =
                      t.detalles || t.detalle || t.tareasDetalle || [];

                    const expanded = expandedIds.includes(t.id);
                    const totalSubtareas = detalles.length;
                    const completadas = detalles.filter(
                      (d) => d.estado === "completada"
                    ).length;

                    return (
                      <Fragment key={t.id}>
                        {/* FILA PRINCIPAL */}
                        <TableRow
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => handleRowClick(t)}
                        >
                          <TableCell
                            onClick={(ev) => toggleExpanded(t.id, ev)}
                            padding="checkbox"
                          >
                            <IconButton size="small">
                              {expanded ? (
                                <ExpandMoreIcon fontSize="small" />
                              ) : (
                                <ChevronRightIcon fontSize="small" />
                              )}
                            </IconButton>
                          </TableCell>

                          <TableCell>
                            {t.nombre}
                            {totalSubtareas > 0 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 1 }}
                              >
                                ({completadas}/{totalSubtareas} subtareas)
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell>{responsableNombre}</TableCell>

                          <TableCell>
                            <Chip
                              label={
                                ESTADO_LABELS[t.estado] || t.estado || "Pendiente"
                              }
                              size="small"
                              color={
                                t.estado === "completada"
                                  ? "success"
                                  : t.estado === "en_progreso"
                                  ? "warning"
                                  : "default"
                              }
                            />
                          </TableCell>

                          <TableCell>{formatDate(t.fecha_inicio_plan)}</TableCell>
                          <TableCell>{formatDate(t.fecha_fin_plan)}</TableCell>

                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Number(t.avance || 0)}
                                />
                              </Box>
                              <Typography variant="caption">
                                {Number(t.avance || 0)}%
                              </Typography>
                            </Box>
                          </TableCell>

                          <TableCell
                            align="right"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <Tooltip title="Editar tarea">
                              <IconButton
                                size="small"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleRowClick(t);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Eliminar tarea">
                              <IconButton
                                size="small"
                                onClick={(ev) => handleDelete(t, ev)}
                                disabled={deletingId === t.id}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>

                        {/* FILA DETALLE: SUBTAREAS */}
                        <TableRow>
                          <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                            <Collapse in={expanded} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  pl: 7,
                                  pr: 2,
                                  pb: 1,
                                  pt: 0.5,
                                  bgcolor: "grey.50",
                                }}
                              >
                                {detalles.length === 0 ? (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Esta tarea no tiene subtareas.
                                  </Typography>
                                ) : (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell width={40}>Acción</TableCell>
                                        <TableCell>Título</TableCell>
                                        <TableCell>Responsable</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell>Inicio plan</TableCell>
                                        <TableCell>Fin plan</TableCell>
                                        <TableCell>Días plan</TableCell>
                                        <TableCell>Inicio real</TableCell>
                                        <TableCell>Fin real</TableCell>
                                        <TableCell>Dif. días</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {detalles.map((d) => {
                                        const respNombre =
                                          d.responsable?.usuario?.nombre ||
                                          d.responsable?.usuario?.correo ||
                                          "—";

                                        const desviacion = d.dias_desviacion;

                                        let diffLabel = "—";
                                        let diffColor = "text.secondary";

                                        if (typeof desviacion === "number") {
                                          if (desviacion === 0) {
                                            diffLabel = "En plazo";
                                            diffColor = "text.secondary";
                                          } else if (desviacion > 0) {
                                            const plural =
                                              desviacion === 1 ? "" : "s";
                                            diffLabel = `${desviacion} día${plural} de atraso`;
                                            diffColor = "error.main";
                                          } else {
                                            const abs = Math.abs(desviacion);
                                            const plural = abs === 1 ? "" : "s";
                                            diffLabel = `${abs} día${plural} antes`;
                                            diffColor = "success.main";
                                          }
                                        }

                                        const isUpdating =
                                          updatingDetalleId === d.id;

                                        return (
                                          <TableRow
                                            key={d.id}
                                            hover
                                            sx={{ cursor: "default" }}
                                          >
                                            <TableCell padding="checkbox">
                                              {isUpdating ? (
                                                <CircularProgress size={18} />
                                              ) : (
                                                <Tooltip
                                                  title={getAccionTooltip(
                                                    d.estado
                                                  )}
                                                >
                                                  <IconButton
                                                    size="small"
                                                    onClick={(ev) =>
                                                      handleActionIconClick(
                                                        d,
                                                        ev
                                                      )
                                                    }
                                                  >
                                                    {getAccionIcon(d.estado)}
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                            </TableCell>
                                            <TableCell>{d.titulo}</TableCell>
                                            <TableCell>{respNombre}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={
                                                  ESTADO_LABELS[d.estado] ||
                                                  d.estado ||
                                                  "Pendiente"
                                                }
                                                size="small"
                                                color={
                                                  d.estado === "completada"
                                                    ? "success"
                                                    : d.estado ===
                                                      "en_progreso"
                                                    ? "warning"
                                                    : "default"
                                                }
                                              />
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(d.fecha_inicio_plan)}
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(d.fecha_fin_plan)}
                                            </TableCell>
                                            <TableCell>
                                              {d.dias_plan ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(d.fecha_inicio_real)}
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(d.fecha_fin_real)}
                                            </TableCell>
                                            <TableCell>
                                              <Typography
                                                variant="caption"
                                                sx={{ color: diffColor }}
                                              >
                                                {diffLabel}
                                              </Typography>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>

        <AddTareaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          proyectoId={proyectoId}
          miembros={miembros}
          tarea={editingTarea}
          onSaved={handleSaved}
        />
      </Card>

      {/* Modal de confirmación para iniciar/finalizar/resetear subtarea */}
      <Modal open={confirmState.open} onClose={handleCloseConfirmModal} title={confirmTitle}>
        <div className="space-y-4">
          {confirmState.detalle && (
            <>
              <p className="text-sm text-gray-700">
                {currentAccionConfig?.description ||
                  "Confirma la acción que deseas realizar sobre esta subtarea."}
              </p>

              <div className="rounded-md bg-gray-50 px-4 py-3 text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Subtarea: </span>
                  {confirmState.detalle.titulo}
                </p>
                <p>
                  <span className="font-semibold">Estado actual: </span>
                  {ESTADO_LABELS[confirmState.detalle.estado] ||
                    confirmState.detalle.estado}
                </p>
                <p>
                  <span className="font-semibold">Inicio plan: </span>
                  {formatDate(confirmState.detalle.fecha_inicio_plan)}
                </p>
                <p>
                  <span className="font-semibold">Fin plan: </span>
                  {formatDate(confirmState.detalle.fecha_fin_plan)}
                </p>
                <p>
                  <span className="font-semibold">Inicio real: </span>
                  {formatDate(confirmState.detalle.fecha_inicio_real)}
                </p>
                <p>
                  <span className="font-semibold">Fin real: </span>
                  {formatDate(confirmState.detalle.fecha_fin_real)}
                </p>
              </div>
            </>
          )}

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
