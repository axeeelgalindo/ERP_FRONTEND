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
  Switch,
  FormControlLabel,
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
  comentario: "",
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
      comentario: g?.comentario || "",
    }))
    .filter((g) => g.descripcion.length > 0); // 👈 si está vacía, la quitamos

  return cleaned.map((g, idx) => ({ ...g, orden: idx }));
}

const hasVentas = (ventaIds) =>
  Array.isArray(ventaIds) && ventaIds.length > 0;

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

  // nuevos campos editables
  const [vendedorId, setVendedorId] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [proyectoId, setProyectoId] = useState("");
  const [proyectos, setProyectos] = useState([]);

  // nuevos campos para suscripciones
  const [esSuscripcion, setEsSuscripcion] = useState(false);
  const [moneda, setMoneda] = useState("CLP");
  const [ciclosMensuales, setCiclosMensuales] = useState(12);
  const [valorUFManual, setValorUFManual] = useState("");
  const [valorUF, setValorUF] = useState(37700);

  // ✅ para saber si el usuario tocó glosas manualmente
  const [glosasTouched, setGlosasTouched] = useState(false);

  const [sinIva, setSinIva] = useState(false);

  // ========= cargar valor UF =========
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("https://mindicador.cl/api/uf");
        if (res.ok) {
          const data = await res.json();
          const val = data?.serie?.[0]?.valor;
          if (val) setValorUF(Number(val));
        }
      } catch (e) {
        console.error("Error fetching UF in client:", e);
      }
    })();
  }, [open]);

  const activeUF = useMemo(() => {
    return valorUFManual ? Number(valorUFManual) : valorUF;
  }, [valorUFManual, valorUF]);

  // ========= cargar usuarios y proyectos =========
  useEffect(() => {
    if (!open || !session) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/usuarios`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });
        const data = await safeJson(res);
        if (res.ok) setUsuarios(Array.isArray(data) ? data : data?.data || []);
      } catch (e) {
        setUsuarios([]);
      }
    })();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/proyectos`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });
        const data = await safeJson(res);
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        setProyectos(list);
      } catch (e) {
        setProyectos([]);
      }
    })();
  }, [open, session]);

  // ========= cargar cotización completa (o resetear para creación) =========
  useEffect(() => {
    if (!open || !session) return;

    if (!cotizacionId) {
      // Modo creación! Resetear campos
      setClienteId("");
      setResponsableId("");
      setAsunto("");
      setVigenciaDias(15);
      setTerminos("");
      setAcuerdoPago("");
      setVentaIds([]);
      setGlosas([emptyGlosa()]);
      setVendedorId("");
      setDescuentoPct("");
      setProyectoId("");
      setFechaDocumento(new Date().toISOString().split("T")[0]);
      
      // Suscripción por defecto en creación
      setEsSuscripcion(true);
      setMoneda("UF");
      setCiclosMensuales(12);
      setValorUFManual("");
      setSinIva(false);
      
      setGlosasTouched(false);
      setCot(null);
      return;
    }

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

        setVendedorId(data?.vendedor_id ? String(data.vendedor_id) : "");
        setDescuentoPct(data?.descuento_pct ? String(data.descuento_pct) : "");
        setProyectoId(data?.proyecto_id ? String(data.proyecto_id) : "");
        if (data?.fecha_documento) {
          setFechaDocumento(data.fecha_documento.split("T")[0]);
        } else {
          setFechaDocumento("");
        }

        setEsSuscripcion(!!data?.es_suscripcion);
        setMoneda(data?.moneda || "CLP");
        setCiclosMensuales(Number(data?.ciclos_mensuales ?? 12));
        setValorUFManual(data?.valor_uf_documento ? String(data.valor_uf_documento) : "");
        setSinIva(!!data?.sin_iva);

        const vIds = Array.isArray(data?.ventas)
          ? data.ventas.map((v) => String(v.id))
          : [];
        setVentaIds(vIds);

        const gs = Array.isArray(data?.glosas) ? data.glosas : [];
        const mappedGlosas = gs.map((g) => ({
          descripcion: g.descripcion || "",
          monto: g.monto || 0,
          monto_uf: g.monto_uf !== null && g.monto_uf !== undefined ? Number(g.monto_uf) : "",
          manual: g.manual ?? true,
          cantidad: Number(g.cantidad || 1),
          precio_unitario: Number(g.precio_unitario || g.monto || 0),
          comentario: g.comentario || "",
        }));

        setGlosas(mappedGlosas.length ? mappedGlosas : [emptyGlosa()]);
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
  }, [clienteId, open, responsables.length]);

  // ========= ventas disponibles =========
  const ventasDisponibles = useMemo(() => {
    return Array.isArray(cot?.ventas) ? cot.ventas : [];
  }, [cot]);

  // ========= subtotal neto desde ventas seleccionadas (CLP) o glosas =========
  const subtotalNeto = useMemo(() => {
    if (esSuscripcion) {
      // Para suscripciones, se calcula de las glosas
      return round0(
        glosas.reduce((acc, g) => acc + round0(g.monto || 0), 0)
      );
    }
    if (!ventasDisponibles.length || !ventaIds.length) return 0;
    const setIds = new Set(ventaIds.map(String));
    return round0(
      ventasDisponibles
        .filter((v) => setIds.has(String(v.id)))
        .reduce((acc, v) => acc + calcTotalVenta(v), 0)
    );
  }, [ventasDisponibles, ventaIds, esSuscripcion, glosas]);

  // ========= subtotal neto en UF (si corresponde) =========
  const subtotalNetoUF = useMemo(() => {
    if (moneda !== "UF") return 0;
    return glosas.reduce((acc, g) => acc + Number(g.monto_uf || 0), 0);
  }, [glosas, moneda]);

  // ========= Auto-ajuste SOLO cuando hay ventas y no es suscripción =========
  useEffect(() => {
    if (!open) return;
    if (esSuscripcion) return;
    if (!hasVentas(ventaIds)) return; // ✅ SOLO si hay ventas
    if (subtotalNeto <= 0) return;
    if (glosasTouched) return;

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

      return prev; // varias glosas: no tocamos
    });
  }, [open, subtotalNeto, asunto, glosasTouched, ventaIds, esSuscripcion]);

  const sumG = useMemo(() => sumGlosas(glosas), [glosas]);

  // ========= Validación glosas: 2 modos =========
  const glosasOk = useMemo(() => {
    const normalized = glosas.filter((g) => String(g.descripcion).trim().length > 0);

    // si está todo vacío, no es válido (en submit requerimos al menos una)
    if (normalized.length === 0) return false;

    // no negativos
    if (normalized.some((g) => round0(g.monto) < 0)) return false;

    // si es suscripción en UF, validar que tengan monto_uf > 0
    if (esSuscripcion && moneda === "UF") {
      if (normalized.some((g) => !g.monto_uf || Number(g.monto_uf) <= 0)) return false;
    }

    // ✅ con ventas => suma debe ser EXACTA al subtotal
    if (!esSuscripcion && hasVentas(ventaIds)) {
      if (subtotalNeto <= 0) return false;
      return sumGlosas(normalized) === subtotalNeto;
    }

    // ✅ sin ventas / suscripción => el total lo definen las glosas
    const suma = sumGlosas(normalized);
    return suma > 0;
  }, [glosas, subtotalNeto, ventaIds, esSuscripcion, moneda]);

  // ========= handlers glosas =========
  const setGlosa = (idx, patch) => {
    setGlosasTouched(true);

    setGlosas((prev) => {
      const next = [...prev];
      const current = { ...next[idx], ...patch, orden: idx };

      // Si actualizan monto_uf (tarifa UF)
      if (patch.monto_uf !== undefined) {
        const valUf = Number(patch.monto_uf || 0);
        current.monto_uf = valUf;
        // precio unitario y monto final en CLP
        current.monto = Math.round(valUf * activeUF);
        current.precio_unitario = Math.round(valUf * activeUF);
      }

      // normaliza monto en CLP
      if (patch.monto !== undefined) {
        current.monto = round0(patch.monto);
      }

      if (!esSuscripcion && hasVentas(ventaIds)) {
        const target = subtotalNeto;

        // suma de otros
        const others = next.reduce((acc, g, i) => {
          if (i === idx) return acc;
          return acc + round0(g?.monto || 0);
        }, 0);

        const maxAllowed = Math.max(0, target - others);
        current.monto = Math.min(round0(current.monto || 0), maxAllowed);
      }

      next[idx] = current;
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
      if (!vigenciaDias || vigenciaDias < 1 || vigenciaDias > 365)
        throw new Error("Vigencia debe estar entre 1 y 365 días.");

      const conVentas = !esSuscripcion && hasVentas(ventaIds);

      // glosas finales
      let glosasFinal = glosas
        .map((g) => ({
          descripcion: String(g?.descripcion || "").trim().slice(0, 250),
          monto: round0(g?.monto || 0),
          monto_uf: g?.monto_uf !== "" && g?.monto_uf !== null && g?.monto_uf !== undefined ? Number(g.monto_uf) : null,
          cantidad: Number(g?.cantidad || 1),
          precio_unitario: Number(g?.precio_unitario || g?.monto || 0),
          manual: g?.manual ?? true,
        }))
        .filter((g) => g.descripcion.length > 0);

      // Si no hay glosas válidas => 1 automática
      if (glosasFinal.length === 0) {
        glosasFinal = [
          {
            descripcion: (String(asunto || "").trim() || "Servicios").slice(
              0,
              250
            ),
            monto: conVentas ? subtotalNeto : 0,
            monto_uf: null,
            cantidad: 1,
            precio_unitario: conVentas ? subtotalNeto : 0,
            manual: true,
            orden: 0,
          },
        ];
      }

      const suma = sumGlosas(glosasFinal);

      if (conVentas) {
        if (subtotalNeto <= 0) {
          throw new Error(
            "El subtotal neto calculado desde ventas es 0. Revisa ventas seleccionadas."
          );
        }
        if (suma !== subtotalNeto) {
          throw new Error(
            `Las glosas deben sumar el subtotal neto (${formatCLP(
              subtotalNeto
            )}). Actualmente suman ${formatCLP(suma)}.`
          );
        }
      } else {
        // sin ventas/suscripción: glosas definen el total, exigir > 0
        if (suma <= 0) {
          throw new Error(
            "Las glosas deben sumar un monto mayor a 0."
          );
        }
      }

      const payload = {
        proyecto_id: proyectoId || null,
        cliente_id: clienteId,
        cliente_responsable_id: responsableId || null,
        vendedor_id: vendedorId || null,
        fecha_documento: fechaDocumento || null,
        descuento_pct: descuentoPct === "" ? 0 : Number(descuentoPct),
        
        asunto: asunto || null,
        vigencia_dias: Number(vigenciaDias),
        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,

        ventaIds: esSuscripcion ? [] : ventaIds,

        glosas: glosasFinal.map((g, i) => ({
          descripcion: g.descripcion,
          monto: g.monto,
          monto_uf: g.monto_uf,
          cantidad: g.cantidad,
          precio_unitario: g.precio_unitario,
          manual: true,
          orden: i,
          comentario: g.comentario || null,
        })),

        // Nuevos campos
        es_suscripcion: esSuscripcion,
        moneda: moneda,
        ciclos_mensuales: Number(ciclosMensuales || 12),
        valor_uf_manual: valorUFManual ? Number(valorUFManual) : null,
        sin_iva: sinIva,
      };

      const url = cotizacionId 
        ? `${API_URL}/cotizaciones/update/${cotizacionId}`
        : `${API_URL}/cotizaciones/add`;
      
      const method = cotizacionId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: makeHeaders(session),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error guardando cotización"
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
        sx: { borderRadius: 3,  },
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

        {/* Cliente y Vendedor */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
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

          <TextField
            select
            size="small"
            label="Vendedor Asignado"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">Mantener Original</MenuItem>
            {(usuarios || []).map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.nombre}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Proyecto asociado */}
        <TextField
          select
          size="small"
          label="Asociar a Proyecto (Opcional)"
          value={proyectoId}
          onChange={(e) => setProyectoId(e.target.value)}
          fullWidth
          helperText={proyectoId ? "Este costeo quedará vinculado al proyecto seleccionado" : "Útil para fichar la cotización como costeo adicional de un proyecto existente"}
        >
          <MenuItem value="">Sin proyecto asociado</MenuItem>
          {(proyectos || []).map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.nombre || p.id}
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

        {/* Asunto + Vigencia + Fecha + Descuento */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 140px 145px 120px" },
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
          <TextField
            size="small"
            type="date"
            label="Fecha Doc."
            InputLabelProps={{ shrink: true }}
            value={fechaDocumento}
            onChange={(e) => setFechaDocumento(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Desc. (%)"
            value={descuentoPct}
            onChange={(e) => setDescuentoPct(e.target.value)}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            fullWidth
          />
        </Box>

        {/* Toggles: Suscripción y Sin IVA */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, bgcolor: "action.hover", p: 1.5, borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={esSuscripcion}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setEsSuscripcion(val);
                    if (val) {
                      setMoneda("UF");
                      setVentaIds([]);
                    } else {
                      setMoneda("CLP");
                    }
                  }}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>Suscripción / Recurrente</Typography>
                  <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Tarifa mensual fijada en UF o CLP.</Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, bgcolor: "action.hover", p: 1.5, borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={sinIva}
                  onChange={(e) => setSinIva(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>Sin Impuestos (IVA 0%)</Typography>
                  <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Elimina el cálculo del 19% de IVA.</Typography>
                </Box>
              }
            />
          </Box>
        </Box>

        {/* Campos Condicionales de Suscripción */}
        {esSuscripcion && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
            <TextField
              select
              size="small"
              label="Moneda Base"
              value={moneda}
              onChange={(e) => {
                const val = e.target.value;
                setMoneda(val);
                if (val === "CLP") {
                  // clear monto_uf on change
                  setGlosas((prev) => prev.map((g) => ({ ...g, monto_uf: "" })));
                } else {
                  // calculate base monto_uf
                  setGlosas((prev) => prev.map((g) => ({ ...g, monto_uf: g.monto ? (g.monto / activeUF).toFixed(2) : "" })));
                }
              }}
              fullWidth
            >
              <MenuItem value="CLP">CLP (Pesos Chilenos)</MenuItem>
              <MenuItem value="UF">UF (Unidad de Fomento)</MenuItem>
            </TextField>

            <TextField
              size="small"
              type="number"
              label="Duración (Meses/Ciclos)"
              value={ciclosMensuales}
              onChange={(e) => setCiclosMensuales(Number(e.target.value))}
              inputProps={{ min: 1 }}
              fullWidth
              helperText="Cantidad de meses a facturar"
            />

            {moneda === "UF" && (
              <TextField
                size="small"
                type="number"
                label={`Valor UF (Día: ${formatCLP(valorUF)})`}
                placeholder={`Ref: ${valorUF}`}
                value={valorUFManual}
                onChange={(e) => setValorUFManual(e.target.value)}
                fullWidth
                helperText="Dejar vacío para usar UF oficial"
              />
            )}
          </Box>
        )}

        {/* Ventas */}
        {!esSuscripcion && (
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
                ? hasVentas(ventaIds)
                  ? `Subtotal neto preview: ${formatCLP(subtotalNeto)}`
                  : "Cotización sin ventas (importada). El total se define por las glosas."
                : "No hay ventas disponibles en la cotización."
            }
          >
            {(ventasDisponibles || []).map((v) => (
              <MenuItem key={v.id} value={v.id}>
                Venta #{v.numero ?? "—"} · {formatCLP(calcTotalVenta(v))}
              </MenuItem>
            ))}
          </TextField>
        )}

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
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.2,
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: moneda === "UF"
                      ? { xs: "1fr", md: "1fr 140px 140px 44px" }
                      : { xs: "1fr", md: "1fr 180px 44px" },
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
                  {moneda === "UF" ? (
                    <>
                      <TextField
                        size="small"
                        type="number"
                        label="Tarifa (UF)"
                        value={g.monto_uf ?? ""}
                        onChange={(e) => setGlosa(idx, { monto_uf: e.target.value })}
                        inputProps={{ step: "0.01", min: "0" }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        label="Equiv. CLP"
                        value={formatCLP(g.monto)}
                        disabled
                        fullWidth
                      />
                    </>
                  ) : (
                    <TextField
                      size="small"
                      type="number"
                      label="Monto"
                      value={g.monto}
                      onChange={(e) => setGlosa(idx, { monto: e.target.value })}
                      fullWidth
                    />
                  )}
                  <IconButton
                    onClick={() => removeGlosa(idx)}
                    disabled={glosas.length === 1}
                    sx={{ justifySelf: { xs: "start", md: "center" } }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Box sx={{ pr: { xs: 0, md: "44px" } }}>
                  <TextField
                    size="small"
                    label="Comentario particular (opcional)"
                    value={g.comentario || ""}
                    onChange={(e) => setGlosa(idx, { comentario: e.target.value })}
                    fullWidth
                    variant="standard"
                    placeholder="Nota o comentario particular para este ítem..."
                  />
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <Typography
              sx={{
                fontSize: 12,
                color: glosasOk ? "success.main" : "error.main",
              }}
            >
              {esSuscripcion ? (
                <>
                  {moneda === "UF" ? (
                    <>
                      {glosasOk
                        ? `✅ Total UF: ${Number(subtotalNetoUF).toFixed(2)} UF (~${formatCLP(subtotalNeto)} CLP) mensual por ${ciclosMensuales} meses.`
                        : "❌ Revisa glosas (las tarifas en UF deben ser mayores a 0)."}
                    </>
                  ) : (
                    <>
                      {glosasOk
                        ? `✅ Total CLP: ${formatCLP(subtotalNeto)} mensual por ${ciclosMensuales} meses.`
                        : "❌ Revisa glosas (monto total debe ser mayor a 0)."}
                    </>
                  )}
                </>
              ) : hasVentas(ventaIds) ? (
                <>
                  {subtotalNeto <= 0
                    ? "❌ Subtotal neto es 0 (revisa ventas)."
                    : glosasOk
                    ? `✅ Glosas cuadran: ${formatCLP(subtotalNeto)}`
                    : `❌ Glosas sumadas no cuadran con el subtotal neto (${formatCLP(subtotalNeto)}).`}
                </>
              ) : (
                <>
                  {glosasOk
                    ? `✅ Total por glosas: ${formatCLP(subtotalNeto)}`
                    : "❌ Revisa glosas (montos no negativos y total > 0)."}
                </>
              )}
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
          disabled={saving || loading || !glosasOk}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </Box>
    </Dialog>
  );
}
