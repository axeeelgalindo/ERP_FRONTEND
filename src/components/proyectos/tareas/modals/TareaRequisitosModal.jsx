"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Divider,
  TextField,
  MenuItem,
  CircularProgress,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function TareaRequisitosModal({ open, onClose, session, proyectoId, tarea, onSaved }) {
  const [requisitos, setRequisitos] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [requisitoTexto, setRequisitoTexto] = useState("");
  const [selectedPredecesoraId, setSelectedPredecesoraId] = useState("");

  // Cargar requisitos de la tarea
  const loadRequisitos = async () => {
    if (!session || !tarea?.id) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/tareas/${tarea.id}/requisitos`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json.rows)) {
        setRequisitos(json.rows);
      } else {
        setRequisitos([]);
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar requisitos");
    } finally {
      setLoading(false);
    }
  };

  // Cargar tareas del proyecto para usarlas como predecesoras
  const loadProjectTasks = async () => {
    if (!session || !proyectoId) return;
    try {
      const res = await fetch(`${API}/proyectos/${proyectoId}/tareas`, {
        headers: makeHeaders(session),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json.rows)) {
        // Filtrar la propia tarea actual
        const filtered = json.rows.filter(t => t.id !== tarea?.id);
        setTaskOptions(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open && tarea?.id) {
      loadRequisitos();
      loadProjectTasks();
      setRequisitoTexto("");
      setSelectedPredecesoraId("");
    }
  }, [open, tarea, proyectoId, session]);

  const handleToggleRequisito = async (reqId, idx, checked) => {
    try {
      setError("");
      const res = await fetch(`${API}/tareas-requisito/update/${reqId}`, {
        method: "PATCH",
        headers: makeHeaders(session),
        body: JSON.stringify({ completado: checked }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el requisito");
      
      // Actualizar localmente
      setRequisitos(prev =>
        prev.map((r, i) => (i === idx ? { ...r, completado: checked } : r))
      );
      onSaved?.();
    } catch (err) {
      console.error(err);
      setError("Error al actualizar: " + err.message);
    }
  };

  const handleDeleteRequisito = async (reqId, idx) => {
    try {
      setError("");
      const res = await fetch(`${API}/tareas-requisito/delete/${reqId}`, {
        method: "DELETE",
        headers: makeHeaders(session),
      });
      if (!res.ok) throw new Error("No se pudo eliminar el requisito");

      setRequisitos(prev => prev.filter((_, i) => i !== idx));
      onSaved?.();
    } catch (err) {
      console.error(err);
      setError("Error al eliminar: " + err.message);
    }
  };

  const handleAddRequisito = async () => {
    if (!requisitoTexto.trim()) return;
    try {
      setError("");
      const res = await fetch(`${API}/tareas-requisito/add`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify({
          tarea_id: tarea.id,
          nombre: requisitoTexto.trim(),
          predecesora_id: selectedPredecesoraId || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error("No se pudo agregar el requisito");

      setRequisitos(prev => [...prev, json.row]);
      setRequisitoTexto("");
      setSelectedPredecesoraId("");
      onSaved?.();
    } catch (err) {
      console.error(err);
      setError("Error al agregar: " + err.message);
    }
  };

  if (!tarea) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#f8fafc" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", lineHeight: 1.2 }}>
            Requisitos y Pendientes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {tarea.nombre}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {error && (
          <Typography variant="body2" color="error" sx={{ fontWeight: "semibold" }}>
            {error}
          </Typography>
        )}

        {/* Lista de Requisitos */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary", textTransform: "uppercase", display: "block", mb: 1 }}>
            Checklist de Requisitos ({requisitos.length})
          </Typography>

          {loading && requisitos.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {requisitos.map((req, idx) => (
                <Box
                  key={req.id || idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    bgcolor: req.completado ? "rgba(241, 245, 249, 0.6)" : "action.hover",
                    p: 1.5,
                    px: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: req.completado ? "divider" : "rgba(226, 232, 240, 0.8)",
                  }}
                >
                  <FormControlLabel
                    control={
                      <input
                        type="checkbox"
                        checked={req.completado || false}
                        onChange={(e) => handleToggleRequisito(req.id, idx, e.target.checked)}
                        style={{ marginRight: "10px", width: "18px", height: "18px", cursor: "pointer" }}
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          textDecoration: req.completado ? "line-through" : "none",
                          color: req.completado ? "text.secondary" : "text.primary",
                        }}
                      >
                        {req.nombre}
                        {(req.predecesora_id || req.predecesora?.id) && (
                          <span style={{ marginLeft: "8px", fontSize: "9px", background: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", border: "1px solid #dbeafe" }}>
                            TAREA
                          </span>
                        )}
                      </Typography>
                    }
                    sx={{ m: 0, cursor: "pointer" }}
                  />

                  <IconButton
                    size="small"
                    onClick={() => handleDeleteRequisito(req.id, idx)}
                    sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              {requisitos.length === 0 && (
                <Box sx={{ py: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                  <PlaylistAddCheckIcon sx={{ fontSize: 32, color: "text.disabled", mb: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    No hay requisitos registrados para esta tarea.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Sección de Agregar */}
        <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", p: 2.5, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase" }}>
            Agregar Nuevo Requisito
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <TextField
              select
              label="Opcional: Vincular a tarea previa del proyecto"
              value={selectedPredecesoraId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPredecesoraId(val);
                const predTask = taskOptions.find(t => t.id === val);
                if (predTask) {
                  setRequisitoTexto(predTask.nombre);
                }
              }}
              size="small"
              fullWidth
            >
              <MenuItem value="">
                <em>Ninguna (Requisito de texto libre)</em>
              </MenuItem>
              {taskOptions.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Nombre/Descripción del requisito"
                placeholder="Ej. Tener los implementos listos"
                value={requisitoTexto}
                onChange={(e) => setRequisitoTexto(e.target.value)}
                size="small"
                fullWidth
              />

              <Button
                variant="contained"
                onClick={handleAddRequisito}
                disabled={!requisitoTexto.trim()}
                sx={{ minWidth: 44, p: 0, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
              >
                <AddIcon />
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, bgcolor: "#f8fafc" }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: "#cbd5e1", color: "#475569", "&:hover": { borderColor: "#94a3b8", bgcolor: "#f1f5f9" } }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
