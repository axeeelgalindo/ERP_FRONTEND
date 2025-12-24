"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function NuevaVentaDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  onCreated,
}) {
  // =========================
  // Form state
  // =========================
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [descripcionVenta, setDescripcionVenta] = useState("");
  const [ordenVentaId, setOrdenVentaId] = useState("");

  // periodo HH
  const now = useMemo(() => new Date(), []);
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1));

  // catálogos
  const [tipoItems, setTipoItems] = useState([]);
  const [tipoDias, setTipoDias] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [hhRegistros, setHhRegistros] = useState([]);
  const [compraItems, setCompraItems] = useState([]);

  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [catalogosErr, setCatalogosErr] = useState("");

  // =========================
  // helpers
  // =========================
  const empleadoLabel = (emp) =>
    emp?.usuario?.nombre || emp?.nombre || emp?.rut || emp?.id || "Empleado";

  const compraItemLabel = (ci) => {
    const cant = Number(ci?.cantidad) || 1;
    const total = Number(ci?.total) || 0;

    const pu =
      ci?.precio_unit != null
        ? Number(ci.precio_unit)
        : cant > 0
        ? total / cant
        : total;

    const proveedor = ci?.proveedor?.nombre;
    const productoId = ci?.producto_id;

    const itemText = (ci?.item != null ? String(ci.item) : "").trim();
    const prodName = (
      ci?.producto?.nombre != null ? String(ci.producto.nombre) : ""
    ).trim();

    const nombreBase = productoId
      ? prodName || `Producto (${String(productoId).slice(0, 6)}…)`
      : itemText || "Ítem sin nombre";

    const compraNumero = ci?.compra?.numero ? `OC #${ci.compra.numero}` : "";

    return `${nombreBase}${proveedor ? ` | ${proveedor}` : ""}${
      compraNumero ? ` | ${compraNumero}` : ""
    } | PU: ${formatCLP(pu)}`;
  };

  function normalizeRut(rut) {
    return String(rut || "")
      .trim()
      .toUpperCase()
      .replace(/\./g, "")
      .replace(/-/g, "")
      .replace(/\s+/g, "");
  }

  function getEmpleadoRut(emp) {
    return emp?.rut ?? emp?.RUT ?? emp?.usuario?.rut ?? emp?.usuario?.RUT ?? null;
  }

  function getHHRut(hh) {
    return hh?.rut ?? hh?.RUT ?? hh?.empleado?.rut ?? hh?.empleado?.RUT ?? null;
  }

  function getHHEmpleadoEmpleadoId(hh) {
    return hh?.empleado_id ?? hh?.empleadoId ?? hh?.empleado?.id ?? null;
  }

  const emptyDet = () => ({
    descripcion: "",
    modo: "HH", // "HH" | "COMPRA"
    cantidad: 1,
    tipoItemId: "",
    tipoDiaId: "",
    alphaPct: 10, // default 10%
    empleadoId: "",
    compraId: "",
  });

  const [detalles, setDetalles] = useState([emptyDet()]);

  const resetForm = () => {
    const d = new Date();
    setDescripcionVenta("");
    setOrdenVentaId("");
    setAnio(String(d.getFullYear()));
    setMes(String(d.getMonth() + 1));
    setDetalles([emptyDet()]);
    setFormErr("");
    setCatalogosErr("");
  };

  // =========================
  // fetch catálogos
  // =========================
  const fetchCatalogos = async () => {
    if (!session?.user) return;

    try {
      setLoadingCatalogos(true);
      setCatalogosErr("");

      const headers = makeHeaders(session, empresaIdFromToken);

      const [resTipoItems, resTipoDias, resOV] = await Promise.all([
        fetch(`${API_URL}/ventas/tipoitems`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/tipodias`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/ordenes-venta`, { headers, cache: "no-store" }),
      ]);

      const [dataTipoItems, dataTipoDias, dataOV] = await Promise.all([
        safeJson(resTipoItems),
        safeJson(resTipoDias),
        safeJson(resOV),
      ]);

      if (!resTipoItems.ok)
        throw new Error(
          dataTipoItems?.error || dataTipoItems?.message || "Error cargando tipoItems"
        );
      if (!resTipoDias.ok)
        throw new Error(
          dataTipoDias?.error || dataTipoDias?.message || "Error cargando tipoDias"
        );
      if (!resOV.ok)
        throw new Error(
          dataOV?.error || dataOV?.message || "Error cargando cotizaciones/OV"
        );

      setTipoItems(Array.isArray(dataTipoItems) ? dataTipoItems : []);
      setTipoDias(Array.isArray(dataTipoDias) ? dataTipoDias : []);
      setOrdenesVenta(Array.isArray(dataOV) ? dataOV : []);

      // empleados / HH periodo / compras disponibles
      const [resEmpleados, resHH, resCompraDisp] = await Promise.all([
        fetch(`${API_URL}/ventas/empleados`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/compras/disponibles-venta`, { headers, cache: "no-store" }),
      ]);

      const [dataEmpleados, dataHH, dataCompraDisp] = await Promise.all([
        safeJson(resEmpleados),
        safeJson(resHH),
        safeJson(resCompraDisp),
      ]);

      if (!resEmpleados.ok)
        throw new Error(
          dataEmpleados?.error || dataEmpleados?.message || "Error cargando empleados"
        );
      if (!resHH.ok)
        throw new Error(dataHH?.error || dataHH?.message || "Error HHEmpleado");
      if (!resCompraDisp.ok)
        throw new Error(
          dataCompraDisp?.error ||
            dataCompraDisp?.message ||
            "Error cargando compras disponibles"
        );

      setEmpleados(Array.isArray(dataEmpleados) ? dataEmpleados : []);
      setHhRegistros(Array.isArray(dataHH) ? dataHH : []);

      // normalizar compras -> CompraItem[]
      const raw = Array.isArray(dataCompraDisp)
        ? dataCompraDisp
        : Array.isArray(dataCompraDisp?.data)
        ? dataCompraDisp.data
        : [];

      const isCompraItemArray =
        raw.length > 0 &&
        (raw[0]?.compra_id !== undefined ||
          raw[0]?.precio_unit !== undefined ||
          raw[0]?.item !== undefined);

      if (isCompraItemArray) {
        setCompraItems(raw.map((it) => ({ ...it, compra: it.compra || null })));
      } else {
        const comprasArr = raw;
        const itemsFlat = comprasArr.flatMap((c) =>
          (c.items || []).map((it) => ({ ...it, compra: c }))
        );
        setCompraItems(itemsFlat);
      }
    } catch (e) {
      setCatalogosErr(e?.message || "Error cargando catálogos");
    } finally {
      setLoadingCatalogos(false);
    }
  };

  // al abrir
  useEffect(() => {
    if (!open) return;
    resetForm();
    fetchCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // refrescar HH si cambia periodo mientras está abierto
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        const headers = makeHeaders(session);
        const resHH = await fetch(
          `${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`,
          { headers, cache: "no-store" }
        );
        const dataHH = await safeJson(resHH);
        if (!resHH.ok) throw new Error(dataHH?.error || "Error HHEmpleado");
        setHhRegistros(Array.isArray(dataHH) ? dataHH : []);
      } catch {
        // silencioso
      }
    })();
  }, [anio, mes, open, session]);

  // =========================
  // detalles handlers
  // =========================
  const updateDetalle = (idx, patch) => {
    setDetalles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addDetalle = () => setDetalles((prev) => [...prev, emptyDet()]);
  const removeDetalle = (idx) =>
    setDetalles((prev) => prev.filter((_, i) => i !== idx));

  const findHHForEmpleado = (empleadoId) => {
    if (!empleadoId) return null;

    const idStr = String(empleadoId);

    const byId =
      hhRegistros.find((hh) => String(getHHEmpleadoEmpleadoId(hh)) === idStr) || null;
    if (byId) return byId;

    const emp = empleados.find((e) => String(e.id) === idStr);
    const empRut = normalizeRut(getEmpleadoRut(emp));
    if (!empRut) return null;

    return hhRegistros.find((hh) => normalizeRut(getHHRut(hh)) === empRut) || null;
  };

  // =========================
  // preview (misma lógica)
  // =========================
  const preview = useMemo(() => {
    const contains = (s, sub) =>
      String(s || "").toLowerCase().includes(String(sub).toLowerCase());

    const lines = detalles.map((d) => {
      const cantidad = Number(d.cantidad) || 1;
      const alpha = (Number(d.alphaPct ?? 10) || 10) / 100;

      const tipoItem = tipoItems.find((t) => t.id === d.tipoItemId) || null;
      const tipoDia = tipoDias.find((t) => t.id === d.tipoDiaId) || null;

      const gananciaPct = tipoItem ? Number(tipoItem.porcentajeUtilidad || 0) : 0;

      const tipoDiaNombre = tipoDia?.nombre || "";
      const isFinSemana = contains(tipoDiaNombre, "fin de semana");
      const isUrgente = contains(tipoDiaNombre, "urgente");
      const extraFijo = (isFinSemana ? 200000 : 0) + (isUrgente ? 400000 : 0);

      let costoTotal = 0;
      let ventaTotal = 0;

      if (d.modo === "HH") {
        const hh = findHHForEmpleado(d.empleadoId);
        const costoHH = hh?.costoHH != null ? Number(hh.costoHH) : 0;
        const cif = hh?.cif != null ? Number(hh.cif) : 0;

        costoTotal = costoHH * cantidad + cif;

        const ventaUnit = costoHH * (gananciaPct / 100) + cif / cantidad + extraFijo;
        const multGananciaFinSemana = isFinSemana ? 1 + gananciaPct / 100 : 1;

        ventaTotal = ventaUnit * cantidad * multGananciaFinSemana * (1 + alpha);
      } else {
        const ci = compraItems.find((x) => x.id === d.compraId);
        let costoUnit = 0;
        if (ci) {
          const cantCompra = Number(ci.cantidad) || 1;
          costoUnit =
            ci.precio_unit != null
              ? Number(ci.precio_unit)
              : (Number(ci.total) || 0) / cantCompra;
        }

        costoTotal = costoUnit * cantidad;
        ventaTotal = costoTotal * (1 + gananciaPct / 100) * (1 + alpha);
      }

      const utilidad = ventaTotal - costoTotal;
      const pct = ventaTotal > 0 ? (utilidad / ventaTotal) * 100 : 0;

      return { costoTotal, ventaTotal, utilidad, pct };
    });

    const total = lines.reduce((acc, x) => acc + (x.ventaTotal || 0), 0);
    const costo = lines.reduce((acc, x) => acc + (x.costoTotal || 0), 0);
    const utilidad = total - costo;

    return { total, costo, utilidad, lines };
  }, [detalles, tipoItems, tipoDias, hhRegistros, compraItems, empleados]);

  // =========================
  // validate + submit
  // =========================
  const validateForm = () => {
    if (!detalles.length) return "Debes agregar al menos un ítem.";

    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      if (!d.descripcion?.trim()) return `Ítem #${i + 1}: Falta descripción.`;
      if (!d.tipoItemId) return `Ítem #${i + 1}: Selecciona Tipo ítem.`;

      const cant = Number(d.cantidad);
      if (!cant || cant <= 0) return `Ítem #${i + 1}: Cantidad inválida.`;

      if (d.modo === "HH") {
        if (!d.empleadoId) return `Ítem #${i + 1}: Selecciona empleado.`;
        const hh = findHHForEmpleado(d.empleadoId);
        if (!hh) {
          return `Ítem #${i + 1}: Falta HH del período para este empleado (${mes}/${anio}).`;
        }
      } else {
        if (!d.compraId) return `Ítem #${i + 1}: Selecciona un detalle de compra.`;
      }
    }

    return "";
  };

  const submitVenta = async () => {
    const msg = validateForm();
    if (msg) {
      setFormErr(msg);
      return;
    }

    try {
      setSaving(true);
      setFormErr("");

      const payload = {
        ordenVentaId: ordenVentaId || null,
        descripcion: descripcionVenta || null,
        detalles: detalles.map((d) => {
          const alpha = (Number(d.alphaPct ?? 10) || 10) / 100;

          if (d.modo === "HH") {
            const hh = findHHForEmpleado(d.empleadoId);
            return {
              descripcion: d.descripcion,
              cantidad: Number(d.cantidad) || 1,
              tipoItemId: d.tipoItemId || null,
              tipoDiaId: d.tipoDiaId || null,
              alpha,
              empleadoId: d.empleadoId || null,
              hhEmpleadoId: hh?.id || null,
              compraId: null,
            };
          }

          return {
            descripcion: d.descripcion,
            cantidad: Number(d.cantidad) || 1,
            tipoItemId: d.tipoItemId || null,
            tipoDiaId: d.tipoDiaId || null,
            alpha,
            empleadoId: null,
            hhEmpleadoId: null,
            compraId: d.compraId || null,
          };
        }),
      };

      const res = await fetch(`${API_URL}/ventas/add`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.detalle || data?.error || data?.message || "Error al crear venta"
        );
      }

      onClose?.();
      await onCreated?.();
    } catch (e) {
      setFormErr(e?.message || "Error al crear venta");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Nueva venta</DialogTitle>

      <DialogContent dividers>
        {loadingCatalogos && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando catálogos...
            </Typography>
          </Box>
        )}

        {catalogosErr && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {catalogosErr}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="Descripción de la venta (opcional)"
            value={descripcionVenta}
            onChange={(e) => setDescripcionVenta(e.target.value)}
            fullWidth
            size="small"
          />

          <TextField
            select
            label="Cotización/OV (opcional)"
            value={ordenVentaId}
            onChange={(e) => setOrdenVentaId(e.target.value)}
            fullWidth
            size="small"
          >
            <MenuItem value="">(Sin cotización/OV)</MenuItem>
            {ordenesVenta.map((ov) => (
              <MenuItem key={ov.id} value={ov.id}>
                #{ov.numero} — {ov.proyecto?.nombre || "Sin proyecto"} —{" "}
                {ov.cliente?.nombre || "Sin cliente"} — {formatCLP(ov.total)}{" "}
                {ov.estado ? `— ${ov.estado}` : ""}
              </MenuItem>
            ))}
          </TextField>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Período HH (para buscar HHEmpleado)
          </Typography>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              select
              label="Año"
              size="small"
              value={anio}
              onChange={(e) => setAnio(String(e.target.value))}
              sx={{ minWidth: 140 }}
            >
              {Array.from({ length: 7 }).map((_, i) => {
                const y = new Date().getFullYear() - 3 + i;
                return (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                );
              })}
            </TextField>

            <TextField
              select
              label="Mes"
              size="small"
              value={mes}
              onChange={(e) => setMes(String(e.target.value))}
              sx={{ minWidth: 160 }}
            >
              {[
                "Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
              ].map((m, idx) => (
                <MenuItem key={idx + 1} value={String(idx + 1)}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Ítems (detalleVenta)
          </Typography>

          {detalles.map((det, idx) => {
            const hhSelected = det.modo === "HH" ? findHHForEmpleado(det.empleadoId) : null;

            const hhSelectedCostoHH = hhSelected?.costoHH != null ? Number(hhSelected.costoHH) : 0;
            const hhSelectedCIF = hhSelected?.cif != null ? Number(hhSelected.cif) : 0;

            const faltaHH = det.modo === "HH" && det.empleadoId && !hhSelected;

            return (
              <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography fontWeight={700}>Ítem #{idx + 1}</Typography>
                    {detalles.length > 1 && (
                      <IconButton onClick={() => removeDetalle(idx)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1.5fr 1fr" },
                      gap: 2,
                      mt: 1,
                    }}
                  >
                    <TextField
                      label="Descripción"
                      size="small"
                      value={det.descripcion}
                      onChange={(e) => updateDetalle(idx, { descripcion: e.target.value })}
                      fullWidth
                    />

                    <TextField
                      select
                      label="Modo"
                      size="small"
                      value={det.modo}
                      onChange={(e) => {
                        const modo = e.target.value;
                        updateDetalle(idx, {
                          modo,
                          empleadoId: modo === "HH" ? det.empleadoId : "",
                          compraId: "",
                        });
                      }}
                      fullWidth
                    >
                      <MenuItem value="HH">HH (Empleado)</MenuItem>
                      <MenuItem value="COMPRA">Compra (Insumo)</MenuItem>
                    </TextField>

                    <TextField
                      select
                      label="Tipo ítem (margen)"
                      size="small"
                      value={det.tipoItemId}
                      onChange={(e) => updateDetalle(idx, { tipoItemId: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="">(Selecciona)</MenuItem>
                      {tipoItems.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.nombre}
                          {t.unidadItem?.nombre ? ` (${t.unidadItem.nombre})` : ""} —{" "}
                          {t.porcentajeUtilidad ?? 0}%
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Cantidad"
                      size="small"
                      type="number"
                      value={det.cantidad}
                      onChange={(e) =>
                        updateDetalle(idx, { cantidad: Number(e.target.value) })
                      }
                      fullWidth
                      inputProps={{ min: 1 }}
                    />

                    <TextField
                      select
                      label="Tipo día (opcional)"
                      size="small"
                      value={det.tipoDiaId}
                      onChange={(e) => updateDetalle(idx, { tipoDiaId: e.target.value })}
                      fullWidth
                      helperText="Si el nombre contiene 'fin de semana' o 'urgente', aplica extra fijo."
                    >
                      <MenuItem value="">(Sin tipo día)</MenuItem>
                      {tipoDias.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.nombre}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Ajuste % (alpha)"
                      size="small"
                      type="number"
                      value={det.alphaPct ?? 10}
                      onChange={(e) =>
                        updateDetalle(idx, { alphaPct: Number(e.target.value) })
                      }
                      fullWidth
                      inputProps={{ step: 0.1 }}
                      helperText="Ej: 10 = +10% (default) | 0 = sin ajuste"
                    />

                    {det.modo === "HH" ? (
                      <>
                        <TextField
                          select
                          label="Empleado"
                          size="small"
                          value={det.empleadoId}
                          onChange={(e) =>
                            updateDetalle(idx, { empleadoId: e.target.value })
                          }
                          fullWidth
                        >
                          <MenuItem value="">(Selecciona)</MenuItem>
                          {empleados.map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                              {empleadoLabel(emp)}
                            </MenuItem>
                          ))}
                        </TextField>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <TextField
                            label="Costo HH (según período)"
                            size="small"
                            value={
                              det.empleadoId
                                ? hhSelected
                                  ? `${formatCLP(hhSelectedCostoHH)}${
                                      hhSelectedCIF
                                        ? ` | CIF: ${formatCLP(hhSelectedCIF)}`
                                        : ""
                                    }`
                                  : "-"
                                : "-"
                            }
                            fullWidth
                            disabled
                            helperText={
                              det.empleadoId && !hhSelected
                                ? `No hay HHEmpleado para este empleado en ${mes}/${anio}.`
                                : ""
                            }
                          />

                          {faltaHH && (
                            <Alert severity="warning">
                              Falta HH del período para este empleado. Carga el
                              HHEmpleado de {mes}/{anio} o revisa la relación
                              (empleado_id) en HHEmpleado.
                            </Alert>
                          )}
                        </Box>
                      </>
                    ) : (
                      <>
                        <TextField
                          select
                          label="Detalle de compra"
                          size="small"
                          value={det.compraId}
                          onChange={(e) =>
                            updateDetalle(idx, { compraId: e.target.value })
                          }
                          fullWidth
                        >
                          <MenuItem value="">(Selecciona)</MenuItem>
                          {compraItems.map((ci) => (
                            <MenuItem key={ci.id} value={ci.id}>
                              {compraItemLabel(ci)}
                            </MenuItem>
                          ))}
                        </TextField>

                        <Box />
                      </>
                    )}
                  </Box>

                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Preview ítem: costo {formatCLP(preview.lines[idx]?.costoTotal)} | venta{" "}
                      {formatCLP(preview.lines[idx]?.ventaTotal)} | utilidad{" "}
                      {formatCLP(preview.lines[idx]?.utilidad)}{" "}
                      {preview.lines[idx]?.pct != null
                        ? `(${preview.lines[idx].pct.toFixed(1)}%)`
                        : ""}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}

          <Button variant="outlined" startIcon={<AddIcon />} onClick={addDetalle}>
            Agregar ítem
          </Button>

          <Divider />

          <Card sx={{ borderRadius: 2, background: "rgba(25,118,210,0.05)" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Totales (preview)
              </Typography>
              <Typography fontWeight={700}>
                Venta: {formatCLP(preview.total)} | Costo: {formatCLP(preview.costo)} | Utilidad:{" "}
                {formatCLP(preview.utilidad)}
              </Typography>
            </CardContent>
          </Card>

          {formErr && <Alert severity="error">{formErr}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submitVenta}
          disabled={saving || loadingCatalogos}
        >
          {saving ? "Guardando..." : "Crear venta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
