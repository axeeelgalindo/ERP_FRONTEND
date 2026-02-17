"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const round0 = (n) => Math.round(Number(n || 0));

function calcTotalVenta(v) {
  return (v?.detalles || []).reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

function sumGlosas(glosas = []) {
  return (glosas || []).reduce((acc, g) => acc + round0(g.monto || 0), 0);
}

const emptyGlosa = () => ({
  descripcion: "",
  monto: 0,
  manual: true,
  orden: 0,
});

/**
 * ✅ Igual idea que backend:
 * - trim descripción
 * - slice 250
 * - monto round0
 * - filtra vacías (sin descripción)
 * - orden secuencial
 */
function normalizeGlosasClient(glosas = []) {
  const base = Array.isArray(glosas) ? glosas : [];

  const cleaned = base
    .map((g) => ({
      descripcion: String(g?.descripcion || "").trim().slice(0, 250),
      monto: round0(g?.monto || 0),
      manual: g?.manual ?? true,
    }))
    .filter((g) => g.descripcion.length > 0); // 👈 si está vacía, la quitamos

  return cleaned.map((g, idx) => ({ ...g, orden: idx }));
}

export default function EditCotizacionDialog({
  open,
  onClose,
  session,
  cotizacionId,
  clientes = [],
  onUpdated,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [cot, setCot] = useState(null);

  // campos editables
  const [clienteId, setClienteId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(15);
  const [terminos, setTerminos] = useState("");
  const [acuerdoPago, setAcuerdoPago] = useState("");
  const [ventaIds, setVentaIds] = useState([]);
  const [glosas, setGlosas] = useState([emptyGlosa()]);

  // ✅ para saber si el usuario tocó glosas manualmente
  const [glosasTouched, setGlosasTouched] = useState(false);

  // ========= cargar cotización completa =========
  useEffect(() => {
    if (!open || !cotizacionId || !session) return;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        setCot(null);
        setGlosasTouched(false);

        const res = await fetch(`${API_URL}/cotizaciones/${cotizacionId}`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });

        const data = await safeJson(res);
        if (!res.ok) {
          throw new Error(
            data?.error ||
              data?.detalle ||
              data?.message ||
              "Error cargando cotización"
          );
        }

        setCot(data);

        // hidratar formulario
        setClienteId(String(data?.cliente_id || data?.cliente?.id || ""));
        setResponsableId(
          data?.cliente_responsable_id ? String(data.cliente_responsable_id) : ""
        );
        setAsunto(data?.asunto || "");
        setVigenciaDias(Number(data?.vigencia_dias ?? 15));
        setTerminos(data?.terminos_condiciones || "");
        setAcuerdoPago(data?.acuerdo_pago || "");

        const vIds = Array.isArray(data?.ventas)
          ? data.ventas.map((v) => String(v.id))
          : [];
        setVentaIds(vIds);

        const gs = Array.isArray(data?.glosas) ? data.glosas : [];
        const normalized = normalizeGlosasClient(
          gs.map((g) => ({
            descripcion: g.descripcion || "",
            monto: g.monto || 0,
            manual: g.manual ?? true,
          }))
        );

        // ✅ si no hay glosas válidas, dejamos 1 vacía por ahora (la auto la haremos según subtotal)
        setGlosas(normalized.length ? normalized : [emptyGlosa()]);
      } catch (e) {
        setErr(e?.message || "Error cargando cotización");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, cotizacionId, session]);

  // ========= responsables según cliente =========
  const clienteSelected = useMemo(
    () =>
      (clientes || []).find((c) => String(c.id) === String(clienteId)) || null,
    [clientes, clienteId]
  );

  const responsables = useMemo(() => {
    const list = Array.isArray(clienteSelected?.responsables)
      ? clienteSelected.responsables
      : [];
    return list;
  }, [clienteSelected]);

  // si cambia cliente, limpia responsable si ya no corresponde
  useEffect(() => {
    if (!open) return;
    if (!clienteId) {
      setResponsableId("");
      return;
    }
    if (!responsables.length) {
      setResponsableId("");
      return;
    }
    const exists = responsables.some(
      (r) => String(r.id) === String(responsableId)
    );
    if (!exists) {
      const principal = responsables.find((r) => r.es_principal);
      setResponsableId(String(principal?.id || responsables[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, open, responsables.length]);

  // ========= ventas disponibles =========
  const ventasDisponibles = useMemo(() => {
    return Array.isArray(cot?.ventas) ? cot.ventas : [];
  }, [cot]);

  // ========= subtotal neto desde ventas seleccionadas =========
  const subtotalNeto = useMemo(() => {
    if (!ventasDisponibles.length || !ventaIds.length) return 0;
    const setIds = new Set(ventaIds.map(String));
    return round0(
      ventasDisponibles
        .filter((v) => setIds.has(String(v.id)))
        .reduce((acc, v) => acc + calcTotalVenta(v), 0)
    );
  }, [ventasDisponibles, ventaIds]);

  // ========= “misma lógica create”: si NO tocaron glosas y hay 1 glosa, auto-ajusta al subtotal =========
  useEffect(() => {
    if (!open) return;
    if (subtotalNeto <= 0) return;

    // Solo auto-ajustar si el usuario no ha tocado glosas
    if (glosasTouched) return;

    // si hay 0 o 1 glosa, lo dejamos listo
    setGlosas((prev) => {
      const normalized = normalizeGlosasClient(prev);

      if (normalized.length === 0) {
        return [
          {
            descripcion: (String(asunto || "").trim() || "Servicios").slice(
              0,
              250
            ),
            monto: subtotalNeto,
            manual: true,
            orden: 0,
          },
        ];
      }

      if (normalized.length === 1) {
        return [
          {
            ...normalized[0],
            descripcion:
              normalized[0].descripcion ||
              (String(asunto || "").trim() || "Servicios").slice(0, 250),
            monto: subtotalNeto,
            orden: 0,
          },
        ];
      }

      // si hay varias glosas, NO tocamos nada
      return prev;
    });
  }, [open, subtotalNeto, asunto, glosasTouched]);

  const sumG = useMemo(() => sumGlosas(glosas), [glosas]);

  const glosasOk = useMemo(() => {
    if (subtotalNeto <= 0) return false;

    const normalized = normalizeGlosasClient(glosas);

    // misma regla: si el usuario deja todo vacío, se auto crea 1 (en submit).
    // para el preview: si no hay glosas válidas, lo consideramos OK “pendiente auto”
    if (normalized.length === 0) return true;

    return sumGlosas(normalized) === subtotalNeto;
  }, [glosas, subtotalNeto]);

  // ========= handlers glosas =========
  const setGlosa = (idx, patch) => {
    setGlosasTouched(true);
    setGlosas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, orden: idx };
      if (patch.monto !== undefined) next[idx].monto = round0(patch.monto);
      return next;
    });
  };

  const addGlosa = () => {
    setGlosasTouched(true);
    setGlosas((prev) =>
      [...prev, emptyGlosa()].map((g, i) => ({ ...g, orden: i }))
    );
  };

  const removeGlosa = (idx) => {
    setGlosasTouched(true);
    setGlosas((prev) => {
      const base = prev.filter((_, i) => i !== idx);
      const next = (base.length ? base : [emptyGlosa()]).map((g, i) => ({
        ...g,
        orden: i,
      }));
      return next;
    });
  };

  // ========= guardar =========
  const submit = async () => {
    try {
      if (!session) return;

      setSaving(true);
      setErr("");

      if (!clienteId) throw new Error("Selecciona un cliente.");
      if (!ventaIds.length)
        throw new Error("Debe existir al menos 1 venta seleccionada.");
      if (!vigenciaDias || vigenciaDias < 1 || vigenciaDias > 365)
        throw new Error("Vigencia debe estar entre 1 y 365 días.");

      if (subtotalNeto <= 0) {
        throw new Error(
          "El subtotal neto calculado desde ventas es 0. Revisa ventas seleccionadas."
        );
      }

      // ✅ MISMA LÓGICA CREATE
      let glosasFinal = normalizeGlosasClient(glosas);

      // Si no hay glosas válidas => 1 automática con subtotal
      if (glosasFinal.length === 0) {
        glosasFinal = [
          {
            descripcion: (String(asunto || "").trim() || "Servicios").slice(
              0,
              250
            ),
            monto: subtotalNeto,
            manual: true,
            orden: 0,
          },
        ];
      }

      // validación: todas con descripción (ya está garantizado), y suma exacta
      const suma = sumGlosas(glosasFinal);
      if (suma !== subtotalNeto) {
        throw new Error(
          `Las glosas deben sumar el subtotal neto (${formatCLP(
            subtotalNeto
          )}). Actualmente suman ${formatCLP(suma)}.`
        );
      }

      const payload = {
        cliente_id: clienteId,
        cliente_responsable_id: responsableId || null,
        asunto: asunto || null,
        vigencia_dias: Number(vigenciaDias),
        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,
        ventaIds,
        glosas: glosasFinal.map((g, i) => ({
          descripcion: g.descripcion,
          monto: round0(g.monto || 0),
          manual: true,
          orden: i,
        })),
      };

      const res = await fetch(`${API_URL}/cotizaciones/update/${cotizacionId}`, {
        method: "PUT",
        headers: makeHeaders(session),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error actualizando cotización"
        );
      }

      onClose?.();
      await onUpdated?.(data);
    } catch (e) {
      setErr(e?.message || "Error guardando cotización");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, overflow: "hidden" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "background.paper",
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
            Editar Cotización
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            ID: {cotizacionId}
          </Typography>
        </Box>

        <IconButton onClick={onClose} disabled={saving}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ p: 2.5, display: "grid", gap: 2 }}>
        {err ? <Alert severity="error">{err}</Alert> : null}
        {loading ? (
          <Typography sx={{ color: "text.secondary" }}>Cargando...</Typography>
        ) : null}

        {/* Cliente */}
        <TextField
          select
          size="small"
          label="Cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          fullWidth
        >
          <MenuItem value="">Seleccionar...</MenuItem>
          {(clientes || []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.nombre || c.razonSocial || c.id}
            </MenuItem>
          ))}
        </TextField>

        {/* Responsable */}
        <TextField
          select
          size="small"
          label="Responsable"
          value={responsableId}
          onChange={(e) => setResponsableId(e.target.value)}
          fullWidth
          disabled={!clienteId}
          helperText={
            !clienteId
              ? "Selecciona un cliente"
              : responsables.length
              ? "Selecciona contacto responsable"
              : "Este cliente no tiene responsables"
          }
        >
          <MenuItem value="">
            {responsables.length ? "Seleccionar..." : "Sin responsables"}
          </MenuItem>
          {responsables.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.nombre}
              {r.cargo ? ` — ${r.cargo}` : ""}
              {r.correo ? ` (${r.correo})` : ""}
              {r.es_principal ? " ⭐" : ""}
            </MenuItem>
          ))}
        </TextField>

        {/* Asunto + Vigencia */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 180px" },
            gap: 2,
          }}
        >
          <TextField
            size="small"
            label="Asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Vigencia (días)"
            value={vigenciaDias}
            onChange={(e) => setVigenciaDias(e.target.value)}
            inputProps={{ min: 1, max: 365, step: 1 }}
            fullWidth
          />
        </Box>

        {/* Ventas */}
        <TextField
          select
          size="small"
          label="Ventas relacionadas"
          fullWidth
          value={ventaIds}
          onChange={(e) => {
            const v = e.target.value;
            setVentaIds(Array.isArray(v) ? v : [v]);
          }}
          SelectProps={{ multiple: true }}
          helperText={
            ventasDisponibles.length
              ? `Subtotal neto preview: ${formatCLP(subtotalNeto)}`
              : "No hay ventas disponibles en la cotización."
          }
        >
          {(ventasDisponibles || []).map((v) => (
            <MenuItem key={v.id} value={v.id}>
              Venta #{v.numero ?? "—"} · {formatCLP(calcTotalVenta(v))}
            </MenuItem>
          ))}
        </TextField>

        {/* Glosas */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontWeight: 900 }}>Glosas</Typography>
            <Button size="small" onClick={addGlosa} startIcon={<AddIcon />}>
              Agregar
            </Button>
          </Box>

          <Box sx={{ display: "grid", gap: 1.5 }}>
            {glosas.map((g, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 180px 44px" },
                  gap: 1.2,
                  alignItems: "center",
                }}
              >
                <TextField
                  size="small"
                  label={`Descripción #${idx + 1}`}
                  value={g.descripcion}
                  onChange={(e) => setGlosa(idx, { descripcion: e.target.value })}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Monto"
                  value={g.monto}
                  onChange={(e) => setGlosa(idx, { monto: e.target.value })}
                  fullWidth
                />
                <IconButton
                  onClick={() => removeGlosa(idx)}
                  disabled={glosas.length === 1}
                  sx={{ justifySelf: { xs: "start", md: "center" } }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <Typography
              sx={{
                fontSize: 12,
                color:
                  subtotalNeto <= 0
                    ? "error.main"
                    : glosasOk
                    ? "success.main"
                    : "error.main",
              }}
            >
              {subtotalNeto <= 0
                ? "❌ Subtotal neto es 0 (revisa ventas)."
                : glosasOk
                ? `✅ Glosas cuadran: ${formatCLP(sumGlosas(normalizeGlosasClient(glosas)) || subtotalNeto)}`
                : `❌ Glosas: ${formatCLP(sumGlosas(normalizeGlosasClient(glosas)))} · Subtotal neto: ${formatCLP(subtotalNeto)}`}
            </Typography>
          </Box>
        </Box>

        {/* Términos y acuerdo */}
        <TextField
          size="small"
          label="Términos y condiciones"
          value={terminos}
          onChange={(e) => setTerminos(e.target.value)}
          multiline
          minRows={2}
        />
        <TextField
          size="small"
          label="Acuerdo de pago"
          value={acuerdoPago}
          onChange={(e) => setAcuerdoPago(e.target.value)}
          multiline
          minRows={2}
        />
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ p: 2.2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || loading || subtotalNeto <= 0 || !glosasOk}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </Box>
    </Dialog>
  );
}
