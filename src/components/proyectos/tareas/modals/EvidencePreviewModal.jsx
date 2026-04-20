"use client";

import React from "react";
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
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";

export default function EvidencePreviewModal({ open, onClose, item }) {
  if (!item) return null;

  const evidencias = item.evidencias || [];
  const nombre = item.nombre || item.titulo || "Tarea";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#f8fafc" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", lineHeight: 1.2 }}>
            Evidencias del trabajador
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {nombre}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={`${evidencias.length} archivo${evidencias.length !== 1 ? "s" : ""}`}
            size="small"
            color="warning"
            variant="outlined"
          />
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 2, bgcolor: "#f1f5f9" }}>
        {evidencias.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <ImageIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No hay evidencias cargadas para esta tarea.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {evidencias.map((ev, idx) => (
              <Box
                key={ev.id}
                sx={{
                  p: 2,
                  bgcolor: "white",
                  borderRadius: 2,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 600, color: "#64748b" }}>
                  #{idx + 1} — {new Date(ev.creado_en).toLocaleString("es-CL")}
                </Typography>

                {ev.comentario && (
                  <Box sx={{ display: "flex", gap: 1, mb: 1.5, p: 1.5, bgcolor: "#eff6ff", borderRadius: 1.5, borderLeft: "3px solid #3b82f6" }}>
                    <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: "#3b82f6", mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: "#1e3a5f", fontStyle: "italic" }}>
                      "{ev.comentario}"
                    </Typography>
                  </Box>
                )}

                {ev.archivo_url && (
                  <Box sx={{ borderRadius: 1.5, overflow: "hidden", border: "1px solid #e2e8f0", cursor: "pointer" }}
                    onClick={() => window.open(`${BASE_URL}${ev.archivo_url}`, "_blank")}
                  >
                    {/\.(mp4|webm|ogg)$/i.test(ev.archivo_url) ? (
                      <video controls style={{ width: "100%", maxHeight: 360, display: "block" }}>
                        <source src={`${BASE_URL}${ev.archivo_url}`} />
                      </video>
                    ) : (
                      <img
                        src={`${BASE_URL}${ev.archivo_url}`}
                        alt={`Evidencia ${idx + 1}`}
                        style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }}
                      />
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" fullWidth>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
