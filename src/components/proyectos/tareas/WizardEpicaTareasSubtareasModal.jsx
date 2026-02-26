"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  MenuItem,
  Stack,
  Box,
  IconButton,
  Divider,
  Alert,
  Typography,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

const steps = ["Épica", "Filas", "Revisión"];

const newTempId = () =>
  `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;

function safeTrim(v) {
  return String(v ?? "").trim();
}

export default function WizardEpicaTareasSubtareasModal({
  open,
  onClose,
  session,
  proyectoId,
  epicas = [],
  miembros = [],
  epicaPreselectId = null,
  onSaved,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ===== paso 1: épica =====
  const [modeEpica, setModeEpica] = useState(
    epicaPreselectId ? "EXISTENTE" : "EXISTENTE",
  ); // EXISTENTE | NUEVA
  const [epicaId, setEpicaId] = useState(epicaPreselectId || "");
  const [epicaNombre, setEpicaNombre] = useState("");
  const [epicaDescripcion, setEpicaDescripcion] = useState("");

  // datos cargados de épica existente
  const [epicaDetail, setEpicaDetail] = useState(null);
  const [epicaTasks, setEpicaTasks] = useState([]);
  const [loadingEpicaDetail, setLoadingEpicaDetail] = useState(false);

  // ===== paso 2: filas mixtas =====
  const [rowsDraft, setRowsDraft] = useState(() => [
    {
      tempId: newTempId(),
      tipo: "TAREA", // TAREA | SUBTAREA

      // TAREA
      nombre: "",
      responsable_id: "",
      fecha_inicio_plan: "",
      dias_plan: "",

      // SUBTAREA
      tarea_target: "", // ID:xxx o TMP:xxx
      titulo: "",
      sub_responsable_id: "",
      sub_fecha_inicio_plan: "",
      sub_dias_plan: "",
    },
  ]);

  const epicasOrdenadas = useMemo(() => {
    return [...(epicas || [])].sort((a, b) =>
      String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"),
    );
  }, [epicas]);

  const miembrosOrdenados = useMemo(() => {
    return [...(miembros || [])]
      .map((m) => {
        // soporta distintas formas según tu backend
        const empleadoId =
          m?.empleado_id ||
          m?.empleado?.id ||
          m?.empleadoId ||
          m?.id_empleado ||
          null;

        const label =
          m?.empleado?.usuario?.nombre ||
          m?.empleado?.usuario?.correo ||
          m?.usuario?.nombre ||
          m?.usuario?.correo ||
          m?.nombre ||
          m?.correo ||
          String(empleadoId || "—");

        return { id: empleadoId, label };
      })
      .filter((x) => !!x.id);
  }, [miembros]);

  // opciones para subtareas
  const tareasNuevasOpciones = useMemo(() => {
    return rowsDraft
      .filter((x) => x.tipo === "TAREA" && safeTrim(x.nombre).length >= 2)
      .map((x) => ({
        value: `TMP:${x.tempId}`,
        label: `🆕 ${safeTrim(x.nombre)}`,
      }));
  }, [rowsDraft]);

  const tareasExistentesOpciones = useMemo(() => {
    return (epicaTasks || []).map((t) => ({
      value: `ID:${t.id}`,
      label: t.nombre,
    }));
  }, [epicaTasks]);

  const resetAll = () => {
    setActiveStep(0);
    setBusy(false);
    setError("");

    setModeEpica(epicaPreselectId ? "EXISTENTE" : "EXISTENTE");
    setEpicaId(epicaPreselectId || "");
    setEpicaNombre("");
    setEpicaDescripcion("");

    setEpicaDetail(null);
    setEpicaTasks([]);
    setLoadingEpicaDetail(false);

    setRowsDraft([
      {
        tempId: newTempId(),
        tipo: "TAREA",
        nombre: "",
        responsable_id: "",
        fecha_inicio_plan: "",
        dias_plan: "",
        tarea_target: "",
        titulo: "",
        sub_responsable_id: "",
        sub_fecha_inicio_plan: "",
        sub_dias_plan: "",
      },
    ]);
  };

  const handleClose = () => {
    if (busy) return;
    resetAll();
    onClose?.();
  };

  // ====== FETCH: al seleccionar épica existente, traer detalle + tareas existentes ======
  useEffect(() => {
    const run = async () => {
      if (!open) return;
      if (modeEpica !== "EXISTENTE") return;
      if (!epicaId || !proyectoId || !session?.user) return;

      try {
        setLoadingEpicaDetail(true);
        setError("");

        const headers = { ...makeHeaders(session) };

        const r1 = await fetch(`${API}/epicas/${epicaId}`, { headers });
        const j1 = await r1.json().catch(() => null);
        if (!r1.ok) throw new Error(j1?.msg || "Error cargando épica");
        setEpicaDetail(j1?.row || null);

        const r2 = await fetch(
          `${API}/tareas/by-epica?proyecto_id=${proyectoId}&epica_id=${epicaId}`,
          { headers },
        );
        const j2 = await r2.json().catch(() => null);
        if (!r2.ok)
          throw new Error(j2?.msg || "Error cargando tareas de épica");
        setEpicaTasks(Array.isArray(j2?.rows) ? j2.rows : []);
        console.log("epicaTasks:", Array.isArray(j2?.rows) ? j2.rows : j2);
      } catch (e) {
        setEpicaDetail(null);
        setEpicaTasks([]);
        setError(e?.message || "Error cargando épica");
      } finally {
        setLoadingEpicaDetail(false);
      }
    };

    run();
  }, [open, modeEpica, epicaId, proyectoId, session?.user]);

  // ===== filas helpers =====
  const addRow = () => {
    setRowsDraft((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        tipo: "TAREA",
        nombre: "",
        responsable_id: "",
        fecha_inicio_plan: "",
        dias_plan: "",
        tarea_target: "",
        titulo: "",
        sub_responsable_id: "",
        sub_fecha_inicio_plan: "",
        sub_dias_plan: "",
      },
    ]);
  };

  const removeRow = (tempId) => {
    setRowsDraft((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const updateRow = (tempId, patch) => {
    setRowsDraft((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)),
    );
  };

  // ===== validaciones =====
  const validateStep = () => {
    if (activeStep === 0) {
      if (modeEpica === "EXISTENTE") {
        if (!epicaId) return "Selecciona una épica.";
        if (loadingEpicaDetail)
          return "Espera a que carguen los datos de la épica.";
      } else {
        if (!safeTrim(epicaNombre)) return "Ingresa nombre de la épica.";
      }
    }

    if (activeStep === 1) {
      const validRows = rowsDraft.filter((r) => {
        if (r.tipo === "TAREA") {
          return safeTrim(r.nombre);
        }
        if (r.tipo === "SUBTAREA") {
          return safeTrim(r.titulo);
        }
        return false;
      });

      if (validRows.length === 0) {
        return "Agrega al menos 1 fila válida (TAREA o SUBTAREA).";
      }

      // Validar por tipo
      for (const r of validRows) {
        if (r.tipo === "TAREA") {
          if (!r.fecha_inicio_plan)
            return `Falta fecha inicio plan en tarea "${safeTrim(r.nombre)}".`;
          const dias = Number(r.dias_plan);
          if (!Number.isFinite(dias) || dias <= 0)
            return `Días plan debe ser > 0 en tarea "${safeTrim(r.nombre)}".`;
        } else {
          if (!r.tarea_target)
            return `Selecciona tarea objetivo en subtarea "${safeTrim(r.titulo)}".`;
          if (!r.sub_fecha_inicio_plan)
            return `Falta fecha inicio plan en subtarea "${safeTrim(r.titulo)}".`;
          const dias = Number(r.sub_dias_plan);
          if (!Number.isFinite(dias) || dias <= 0)
            return `Días plan debe ser > 0 en subtarea "${safeTrim(r.titulo)}".`;
        }
      }
    }

    return "";
  };

  const next = () => {
    const msg = validateStep();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setActiveStep((s) => Math.min(2, s + 1));
  };

  const back = () => {
    setError("");
    setActiveStep((s) => Math.max(0, s - 1));
  };

  // ===== Paso 3: resumen armado =====
  const resumen = useMemo(() => {
    const tareasDraft = rowsDraft
      .filter((r) => r.tipo === "TAREA" && safeTrim(r.nombre))
      .map((r) => ({
        tempId: r.tempId,
        nombre: safeTrim(r.nombre),
        responsable_id: r.responsable_id || null,
        fecha_inicio_plan: r.fecha_inicio_plan,
        dias_plan: Number(r.dias_plan),
      }));

    const subtareasDraft = rowsDraft
      .filter((r) => r.tipo === "SUBTAREA" && safeTrim(r.titulo))
      .map((r) => ({
        tempId: r.tempId,
        titulo: safeTrim(r.titulo),
        tarea_target: r.tarea_target,
        responsable_id: r.sub_responsable_id || null,
        fecha_inicio_plan: r.sub_fecha_inicio_plan,
        dias_plan: Number(r.sub_dias_plan),
      }));

    return { tareasDraft, subtareasDraft };
  }, [rowsDraft]);

  // ===== SUBMIT =====
  const handleSubmit = async () => {
    // valida pasos 0 y 1 antes de guardar
    const msg0 = activeStep !== 2 ? "" : ""; // ya estás en revisión, pero igual valida
    const msg = validateStep(); // valida paso actual (2 no valida mucho), así que validamos 0/1 manualmente
    if (msg0 || msg) {
      setError(msg0 || msg);
      return;
    }

    // validar de nuevo paso 0 y 1
    // paso 0:
    if (modeEpica === "EXISTENTE") {
      if (!epicaId) return setError("Selecciona una épica.");
      if (loadingEpicaDetail)
        return setError("Espera a que carguen los datos de la épica.");
    } else {
      if (!safeTrim(epicaNombre))
        return setError("Ingresa nombre de la épica.");
    }
    // paso 1:
    const msgStep1 = (() => {
      const validRows = rowsDraft.filter((r) =>
        r.tipo === "TAREA" ? safeTrim(r.nombre) : safeTrim(r.titulo),
      );
      if (validRows.length === 0) return "Agrega al menos 1 fila válida.";

      for (const r of validRows) {
        if (r.tipo === "TAREA") {
          if (!r.fecha_inicio_plan)
            return `Falta fecha inicio plan en tarea "${safeTrim(r.nombre)}".`;
          const dias = Number(r.dias_plan);
          if (!Number.isFinite(dias) || dias <= 0)
            return `Días plan debe ser > 0 en tarea "${safeTrim(r.nombre)}".`;
        } else {
          if (!r.tarea_target)
            return `Selecciona tarea objetivo en subtarea "${safeTrim(r.titulo)}".`;
          if (!r.sub_fecha_inicio_plan)
            return `Falta fecha inicio plan en subtarea "${safeTrim(r.titulo)}".`;
          const dias = Number(r.sub_dias_plan);
          if (!Number.isFinite(dias) || dias <= 0)
            return `Días plan debe ser > 0 en subtarea "${safeTrim(r.titulo)}".`;
        }
      }
      return "";
    })();

    if (msgStep1) return setError(msgStep1);

    try {
      setBusy(true);
      setError("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      // 1) conseguir finalEpicaId
      let finalEpicaId = epicaId;

      if (modeEpica === "NUEVA") {
        const epicaRes = await fetch(`${API}/epicas/add`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            proyecto_id: proyectoId,
            nombre: safeTrim(epicaNombre),
            descripcion: safeTrim(epicaDescripcion) || null,
          }),
        });

        const epJson = await epicaRes.json().catch(() => null);
        if (!epicaRes.ok) throw new Error(epJson?.msg || "Error creando épica");
        finalEpicaId = epJson?.row?.id;
        if (!finalEpicaId) throw new Error("No se recibió id de épica");
      }

      // 2) crear tareas nuevas (batch) si hay
      const tareasToCreate = resumen.tareasDraft.map((t) => ({
        tempId: t.tempId,
        nombre: t.nombre,
        responsable_id: t.responsable_id,
        fecha_inicio_plan: t.fecha_inicio_plan,
        dias_plan: t.dias_plan,
      }));

      let createdTasks = [];
      const tempToReal = new Map(); // TMP -> id real

      if (tareasToCreate.length > 0) {
        const batchRes = await fetch(`${API}/tareas/batch-add`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            proyecto_id: proyectoId,
            epica_id: finalEpicaId,
            tareas: tareasToCreate.map((t) => ({
              nombre: t.nombre,
              responsable_id: t.responsable_id,
              fecha_inicio_plan: t.fecha_inicio_plan,
              dias_plan: t.dias_plan,
            })),
          }),
        });

        const batchJson = await batchRes.json().catch(() => null);
        if (!batchRes.ok)
          throw new Error(batchJson?.msg || "Error creando tareas");

        createdTasks = Array.isArray(batchJson?.rows) ? batchJson.rows : [];

        // IMPORTANTE: como el backend no devuelve tempId, mapeamos por orden (misma cantidad y mismo orden)
        // Esto funciona mientras el backend cree en el mismo orden que se envía (como te lo dejé).
        createdTasks.forEach((row, idx) => {
          const temp = tareasToCreate[idx]?.tempId;
          if (temp && row?.id) tempToReal.set(temp, row.id);
        });
      }

      // 3) agrupar subtareas por tarea_id (existente o creada)
      const mapSubByTareaId = new Map(); // tareaId -> detalles[]

      for (const s of resumen.subtareasDraft) {
        let tareaId = null;

        if (s.tarea_target.startsWith("ID:")) {
          tareaId = s.tarea_target.replace("ID:", "");
        } else if (s.tarea_target.startsWith("TMP:")) {
          const tmp = s.tarea_target.replace("TMP:", "");
          tareaId = tempToReal.get(tmp) || null;
        }

        if (!tareaId) {
          throw new Error(
            `No se pudo resolver tarea objetivo para subtarea "${s.titulo}"`,
          );
        }

        const det = {
          titulo: s.titulo,
          responsable_id: s.responsable_id,
          fecha_inicio_plan: s.fecha_inicio_plan,
          dias_plan: s.dias_plan,
        };

        const list = mapSubByTareaId.get(tareaId) || [];
        list.push(det);
        mapSubByTareaId.set(tareaId, list);
      }

      // 4) enviar subtareas por tarea (batch-add)
      for (const [tarea_id, detalles] of mapSubByTareaId.entries()) {
        if (!detalles.length) continue;

        const detRes = await fetch(`${API}/tareas-detalle/batch-add`, {
          method: "POST",
          headers,
          body: JSON.stringify({ tarea_id, detalles }),
        });

        const detJson = await detRes.json().catch(() => null);
        if (!detRes.ok)
          throw new Error(detJson?.msg || "Error creando subtareas");
      }

      onSaved?.();
      handleClose();
    } catch (e) {
      setError(e?.message || "Error guardando wizard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Crear épica / tareas / subtareas</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stepper activeStep={activeStep} alternativeLabel sx={{ pt: 1 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* ================= PASO 1 ================= */}
          {activeStep === 0 && (
            <Stack spacing={2}>
              <TextField
                select
                label="Modo"
                value={modeEpica}
                onChange={(e) => setModeEpica(e.target.value)}
                fullWidth
              >
                <MenuItem value="EXISTENTE">Usar épica existente</MenuItem>
                <MenuItem value="NUEVA">Crear nueva épica</MenuItem>
              </TextField>

              {modeEpica === "EXISTENTE" ? (
                <TextField
                  select
                  label="Épica"
                  value={epicaId}
                  onChange={(e) => setEpicaId(e.target.value)}
                  fullWidth
                  disabled={!!epicaPreselectId}
                  helperText={epicaPreselectId ? "Épica preseleccionada." : ""}
                >
                  {epicasOrdenadas.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.nombre}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <TextField
                    label="Nombre de la épica"
                    value={epicaNombre}
                    onChange={(e) => setEpicaNombre(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Descripción (opcional)"
                    value={epicaDescripcion}
                    onChange={(e) => setEpicaDescripcion(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </>
              )}

              {loadingEpicaDetail ? (
                <Alert severity="warning">Cargando datos de la épica…</Alert>
              ) : null}

              {modeEpica === "EXISTENTE" && epicaDetail ? (
                <Alert severity="info">
                  <div>
                    <b>Descripción:</b> {epicaDetail.descripcion || "—"}
                  </div>
                  <div>
                    <b>Estado:</b> {epicaDetail.estado || "—"} · <b>Avance:</b>{" "}
                    {epicaDetail.avance ?? 0}%
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Tareas existentes:</b> {epicaTasks.length}
                  </div>
                </Alert>
              ) : null}
            </Stack>
          )}

          {/* ================= PASO 2 ================= */}
          {activeStep === 1 && (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="subtitle2">
                  Filas (Tarea o Subtarea)
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addRow}
                  disabled={busy}
                >
                  Agregar fila
                </Button>
              </Box>

              <Divider />

              <Stack spacing={2}>
                {rowsDraft.map((r, idx) => (
                  <Box
                    key={r.tempId}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Fila #{idx + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => removeRow(r.tempId)}
                        disabled={rowsDraft.length === 1 || busy}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      sx={{ mt: 1 }}
                    >
                      <TextField
                        select
                        label="Tipo"
                        value={r.tipo}
                        onChange={(e) => {
                          const tipo = e.target.value;

                          if (tipo === "TAREA") {
                            updateRow(r.tempId, {
                              tipo,
                              // limpia campos de subtarea
                              tarea_target: "",
                              titulo: "",
                              sub_responsable_id: "",
                              sub_fecha_inicio_plan: "",
                              sub_dias_plan: "",
                            });
                          } else {
                            updateRow(r.tempId, {
                              tipo,
                              // limpia campos de tarea
                              nombre: "",
                              responsable_id: "",
                              fecha_inicio_plan: "",
                              dias_plan: "",
                            });
                          }
                        }}
                        fullWidth
                      >
                        <MenuItem value="TAREA">Tarea</MenuItem>
                        <MenuItem value="SUBTAREA">Subtarea</MenuItem>
                      </TextField>

                      {r.tipo === "TAREA" ? (
                        <TextField
                          label="Nombre tarea"
                          value={r.nombre}
                          onChange={(e) =>
                            updateRow(r.tempId, { nombre: e.target.value })
                          }
                          fullWidth
                        />
                      ) : (
                        <TextField
                          label="Título subtarea"
                          value={r.titulo}
                          onChange={(e) =>
                            updateRow(r.tempId, { titulo: e.target.value })
                          }
                          fullWidth
                        />
                      )}
                    </Stack>

                    {/* ==== bloque TAREA ==== */}
                    {r.tipo === "TAREA" ? (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        sx={{ mt: 2 }}
                      >
                        <TextField
                          select
                          label="Responsable"
                          value={r.responsable_id}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              responsable_id: e.target.value,
                            })
                          }
                          fullWidth
                        >
                          <MenuItem value="">—</MenuItem>
                          {miembrosOrdenados.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                              {m.label}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          type="date"
                          label="Inicio plan"
                          InputLabelProps={{ shrink: true }}
                          value={r.fecha_inicio_plan}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              fecha_inicio_plan: e.target.value,
                            })
                          }
                          fullWidth
                        />

                        <TextField
                          label="Días plan"
                          value={r.dias_plan}
                          onChange={(e) =>
                            updateRow(r.tempId, { dias_plan: e.target.value })
                          }
                          fullWidth
                        />
                      </Stack>
                    ) : (
                      /* ==== bloque SUBTAREA ==== */
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        <TextField
                          select
                          label="Tarea objetivo"
                          value={r.tarea_target}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              tarea_target: e.target.value,
                            })
                          }
                          fullWidth
                          helperText="Puedes asignar la subtarea a una tarea nueva del wizard o a una tarea ya existente en la épica."
                        >
                          <MenuItem value="">Selecciona…</MenuItem>

                          {tareasNuevasOpciones.length > 0 &&
                            tareasNuevasOpciones.map((o) => (
                              <MenuItem key={o.value} value={o.value}>
                                {o.label}
                              </MenuItem>
                            ))}

                          {tareasNuevasOpciones.length > 0 &&
                          tareasExistentesOpciones.length > 0 ? (
                            <MenuItem disabled value="__sep__">
                              ─────────
                            </MenuItem>
                          ) : null}

                          {tareasExistentesOpciones.length > 0 ? (
                            tareasExistentesOpciones.map((o) => (
                              <MenuItem key={o.value} value={o.value}>
                                {o.label}
                              </MenuItem>
                            ))
                          ) : (
                            <MenuItem disabled value="__none__">
                              (No hay tareas existentes)
                            </MenuItem>
                          )}
                        </TextField>

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={2}
                        >
                          <TextField
                            select
                            label="Responsable"
                            value={r.sub_responsable_id}
                            onChange={(e) =>
                              updateRow(r.tempId, {
                                sub_responsable_id: e.target.value,
                              })
                            }
                            fullWidth
                          >
                            <MenuItem value="">—</MenuItem>
                            {miembrosOrdenados.map((m) => (
                              <MenuItem key={m.id} value={m.id}>
                                {m.label}
                              </MenuItem>
                            ))}
                          </TextField>

                          <TextField
                            type="date"
                            label="Inicio plan"
                            InputLabelProps={{ shrink: true }}
                            value={r.sub_fecha_inicio_plan}
                            onChange={(e) =>
                              updateRow(r.tempId, {
                                sub_fecha_inicio_plan: e.target.value,
                              })
                            }
                            fullWidth
                          />

                          <TextField
                            label="Días plan"
                            value={r.sub_dias_plan}
                            onChange={(e) =>
                              updateRow(r.tempId, {
                                sub_dias_plan: e.target.value,
                              })
                            }
                            fullWidth
                          />
                        </Stack>
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>

              <Alert severity="info">
                Tip: Si agregas una <b>TAREA</b> y luego una <b>SUBTAREA</b>,
                podrás apuntar la subtarea a esa tarea nueva usando “🆕 …”.
              </Alert>
            </Stack>
          )}

          {/* ================= PASO 3 ================= */}
          {activeStep === 2 && (
            <Stack spacing={2}>
              <Alert severity="info">
                Revisa antes de guardar. Se crearán las tareas nuevas y luego
                las subtareas (en tareas nuevas o existentes).
              </Alert>

              <Box>
                <Typography variant="subtitle2">
                  Tareas nuevas ({resumen.tareasDraft.length})
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {resumen.tareasDraft.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No hay tareas nuevas.
                    </Typography>
                  ) : (
                    resumen.tareasDraft.map((t) => (
                      <Box
                        key={t.tempId}
                        sx={{
                          display: "flex",
                          gap: 1,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip size="small" label="TAREA" />
                        <Typography variant="body2">{t.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          · {t.fecha_inicio_plan} · {t.dias_plan} días
                        </Typography>
                      </Box>
                    ))
                  )}
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2">
                  Subtareas ({resumen.subtareasDraft.length})
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {resumen.subtareasDraft.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No hay subtareas.
                    </Typography>
                  ) : (
                    resumen.subtareasDraft.map((s) => (
                      <Box
                        key={s.tempId}
                        sx={{
                          display: "flex",
                          gap: 1,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip size="small" color="warning" label="SUBTAREA" />
                        <Typography variant="body2">{s.titulo}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          · {s.tarea_target} · {s.fecha_inicio_plan} ·{" "}
                          {s.dias_plan} días
                        </Typography>
                      </Box>
                    ))
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Cancelar
        </Button>

        <Box sx={{ flex: 1 }} />

        <Button onClick={back} disabled={busy || activeStep === 0}>
          Atrás
        </Button>

        {activeStep < 2 ? (
          <Button variant="contained" onClick={next} disabled={busy}>
            Siguiente
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSubmit} disabled={busy}>
            Guardar todo
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
