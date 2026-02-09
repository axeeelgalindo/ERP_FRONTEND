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

  // ✅ % utilidad objetivo global (sobre COSTO)
  const [utilidadPctObjetivo, setUtilidadPctObjetivo] = useState("");

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
    return (
      emp?.rut ?? emp?.RUT ?? emp?.usuario?.rut ?? emp?.usuario?.RUT ?? null
    );
  }

  function getHHRut(hh) {
    return hh?.rut ?? hh?.RUT ?? hh?.empleado?.rut ?? hh?.empleado?.RUT ?? null;
  }

  function getHHEmpleadoEmpleadoId(hh) {
    return hh?.empleado_id ?? hh?.empleadoId ?? hh?.empleado?.id ?? null;
  }

  // ✅ CIF helpers
  function getHHCIFValue(hh) {
    if (!hh) return 0;

    if (hh?.cif != null && typeof hh.cif === "number") return Number(hh.cif);

    if (hh?.cif != null && typeof hh.cif === "string") {
      const n = Number(hh.cif);
      return Number.isFinite(n) ? n : 0;
    }

    if (hh?.cif?.valor != null) {
      const n = Number(hh.cif.valor);
      return Number.isFinite(n) ? n : 0;
    }

    if (hh?.cifObj?.valor != null) {
      const n = Number(hh.cifObj.valor);
      return Number.isFinite(n) ? n : 0;
    }

    if (hh?.cifObj?.cif?.valor != null) {
      const n = Number(hh.cifObj.cif.valor);
      return Number.isFinite(n) ? n : 0;
    }

    return 0;
  }

  // TipoItem HH (para UI/preview)
  const tipoItemHH = useMemo(() => {
    const hh =
      tipoItems.find((t) => String(t?.codigo || "").toUpperCase() === "HH") ||
      tipoItems.find((t) => String(t?.nombre || "").toUpperCase() === "HH") ||
      null;
    return hh;
  }, [tipoItems]);

  // ✅ alpha: si viene null/"" => default 10; si viene 0 => 0 real
  const normalizeAlphaPctUI = (v) => {
    if (v == null || v === "") return 10;
    const n = Number(v);
    if (!Number.isFinite(n)) return 10;
    if (n < 0) return 0;
    return n;
  };

  // =========================
  // ✅ Money input helpers
  // =========================
  const onlyDigits = (s) => String(s ?? "").replace(/[^\d]/g, "");

  const parseCLPToNumberString = (s) => {
    const digits = onlyDigits(s);
    return digits ? String(Number(digits)) : "";
  };

  const toCLPDisplay = (sOrNumber) => {
    const n = Number(sOrNumber);
    if (!Number.isFinite(n)) return "";
    return formatCLP(n);
  };

  const getManualPUNumber = (det) => {
    const raw = det?.costoUnitarioManual;
    const clean = parseCLPToNumberString(raw);
    const n = clean ? Number(clean) : 0;
    return Number.isFinite(n) ? n : 0;
  };

  // =========================
  // Tipo día enable rule
  // =========================
  const normalizeText = (s) =>
    String(s ?? "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  const isTipoItemAllowedTipoDia = (tipoItem) => {
    if (!tipoItem) return false;

    const nombre = normalizeText(tipoItem?.nombre);
    const codigo = normalizeText(tipoItem?.codigo);

    if (codigo === "HH" || nombre === "HH") return true;
    if (nombre === "LOGISTICA Y TRANSPORTE") return true;
    if (codigo === "LOGISTICA Y TRANSPORTE") return true;
    if (codigo === "LOGISTICA_TRANSPORTE") return true;
    if (codigo === "LOGISTICA-TRANSPORTE") return true;

    return false;
  };

  const isTipoDiaEnabled = (det) => {
    if (det?.modo === "HH") return true;
    const ti = tipoItems.find((t) => t.id === det?.tipoItemId) || null;
    return isTipoItemAllowedTipoDia(ti);
  };

  const emptyDet = () => ({
    descripcion: "",
    modo: "HH", // "HH" | "COMPRA"
    cantidad: 1,

    tipoItemId: tipoItemHH?.id || "",

    tipoDiaId: "",
    alphaPct: 10,

    empleadoId: "",

    compraId: "",
    costoUnitarioManual: "",
  });

  const [detalles, setDetalles] = useState([emptyDet()]);

  const resetForm = () => {
    const d = new Date();
    setDescripcionVenta("");
    setOrdenVentaId("");
    setUtilidadPctObjetivo("");
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
        fetch(`${API_URL}/ventas/ordenes-venta`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const [dataTipoItems, dataTipoDias, dataOV] = await Promise.all([
        safeJson(resTipoItems),
        safeJson(resTipoDias),
        safeJson(resOV),
      ]);

      if (!resTipoItems.ok)
        throw new Error(
          dataTipoItems?.error ||
            dataTipoItems?.message ||
            "Error cargando tipoItems"
        );
      if (!resTipoDias.ok)
        throw new Error(
          dataTipoDias?.error ||
            dataTipoDias?.message ||
            "Error cargando tipoDias"
        );
      if (!resOV.ok)
        throw new Error(
          dataOV?.error || dataOV?.message || "Error cargando cotizaciones/OV"
        );

      const ti = Array.isArray(dataTipoItems) ? dataTipoItems : [];
      setTipoItems(ti);
      setTipoDias(Array.isArray(dataTipoDias) ? dataTipoDias : []);
      setOrdenesVenta(Array.isArray(dataOV) ? dataOV : []);

      const [resEmpleados, resHH, resCompraDisp] = await Promise.all([
        fetch(`${API_URL}/ventas/empleados`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/compras/disponibles-venta`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const [dataEmpleados, dataHH, dataCompraDisp] = await Promise.all([
        safeJson(resEmpleados),
        safeJson(resHH),
        safeJson(resCompraDisp),
      ]);

      if (!resEmpleados.ok)
        throw new Error(
          dataEmpleados?.error ||
            dataEmpleados?.message ||
            "Error cargando empleados"
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

      const hh =
        ti.find((t) => String(t?.codigo || "").toUpperCase() === "HH") ||
        ti.find((t) => String(t?.nombre || "").toUpperCase() === "HH") ||
        null;

      if (hh?.id) {
        setDetalles((prev) =>
          prev.map((d) => (d.modo === "HH" ? { ...d, tipoItemId: hh.id } : d))
        );
      }
    } catch (e) {
      setCatalogosErr(e?.message || "Error cargando catálogos");
    } finally {
      setLoadingCatalogos(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    fetchCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        const headers = makeHeaders(session, empresaIdFromToken);
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
  }, [anio, mes, open, session, empresaIdFromToken]);

  // =========================
  // detalles handlers
  // =========================
  const updateDetalle = (idx, patch) => {
    setDetalles((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };

      const enabled = isTipoDiaEnabled(merged);
      if (!enabled && merged.tipoDiaId) merged.tipoDiaId = "";

      next[idx] = merged;
      return next;
    });
  };

  const addDetalle = () =>
    setDetalles((prev) => [
      ...prev,
      {
        ...emptyDet(),
        tipoItemId: tipoItemHH?.id || "",
      },
    ]);

  const removeDetalle = (idx) =>
    setDetalles((prev) => prev.filter((_, i) => i !== idx));

  const findHHForEmpleado = (empleadoId) => {
    if (!empleadoId) return null;

    const idStr = String(empleadoId);

    const byId =
      hhRegistros.find((hh) => String(getHHEmpleadoEmpleadoId(hh)) === idStr) ||
      null;
    if (byId) return byId;

    const emp = empleados.find((e) => String(e.id) === idStr);
    const empRut = normalizeRut(getEmpleadoRut(emp));
    if (!empRut) return null;

    return (
      hhRegistros.find((hh) => normalizeRut(getHHRut(hh)) === empRut) || null
    );
  };

  // =========================
  // preview (✅ utilidad global sobre COSTO)
  // =========================
  const preview = useMemo(() => {
    const lines = detalles.map((d) => {
      const cantidad = Number(d.cantidad) || 1;

      const alphaPct = normalizeAlphaPctUI(d.alphaPct);
      const alphaMult = 1 + alphaPct / 100;

      const tipoDia = tipoDias.find((t) => t.id === d.tipoDiaId) || null;
      const extraFijo = tipoDia ? Number(tipoDia.valor ?? 0) : 0;

      let costoTotal = 0;
      let ventaTotalActual = 0;

      if (d.modo === "HH") {
        const hh = findHHForEmpleado(d.empleadoId);
        const costoHH = hh?.costoHH != null ? Number(hh.costoHH) : 0;
        const cif = getHHCIFValue(hh);

        costoTotal = costoHH * cantidad + cif;

        const ventaBase = costoTotal + extraFijo;
        ventaTotalActual = ventaBase * alphaMult;
      } else {
        const ci = compraItems.find((x) => x.id === d.compraId);
        let costoUnit = 0;

        if (ci) {
          const cantCompra = Number(ci.cantidad) || 1;
          costoUnit =
            ci.precio_unit != null
              ? Number(ci.precio_unit)
              : (Number(ci.total) || 0) / cantCompra;
        } else {
          const manualPU = getManualPUNumber(d);
          costoUnit = Number.isFinite(manualPU) ? manualPU : 0;
        }

        costoTotal = costoUnit * cantidad;

        const ventaBase = costoTotal + extraFijo;
        ventaTotalActual = ventaBase * alphaMult;
      }

      return { costoTotal, ventaTotalActual };
    });

    const totalVentaActual = lines.reduce(
      (acc, x) => acc + (x.ventaTotalActual || 0),
      0
    );
    const totalCosto = lines.reduce((acc, x) => acc + (x.costoTotal || 0), 0);

    const u = utilidadPctObjetivo === "" ? null : Number(utilidadPctObjetivo);

    let k = 1;

    // ✅ ahora permite > 100 porque es utilidad sobre COSTO
    if (u != null && Number.isFinite(u) && u >= 0 && totalVentaActual > 0) {
      const ventaObjetivo = totalCosto * (1 + u / 100);
      if (Number.isFinite(ventaObjetivo) && ventaObjetivo > 0) {
        k = ventaObjetivo / totalVentaActual;
      }
    }

    const linesFinal = lines.map((x) => {
      const ventaTotal = (x.ventaTotalActual || 0) * k;
      const utilidad = ventaTotal - (x.costoTotal || 0);
      const pct = ventaTotal > 0 ? (utilidad / ventaTotal) * 100 : 0;
      return { ...x, ventaTotal, utilidad, pct };
    });

    const total = totalVentaActual * k;
    const utilidad = total - totalCosto;

    return {
      k,
      total,
      costo: totalCosto,
      utilidad,
      lines: linesFinal,
    };
  }, [
    detalles,
    tipoDias,
    hhRegistros,
    compraItems,
    empleados,
    tipoItemHH,
    utilidadPctObjetivo,
  ]);

  // =========================
  // validate + submit
  // =========================
  const validateForm = () => {
    if (!detalles.length) return "Debes agregar al menos un ítem.";

    // ✅ ahora solo valida >= 0 (sin max 99)
    if (utilidadPctObjetivo !== "") {
      const u = Number(utilidadPctObjetivo);
      if (!Number.isFinite(u) || u < 0) {
        return "% utilidad objetivo inválido (>= 0).";
      }
    }

    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      if (!d.descripcion?.trim()) return `Ítem #${i + 1}: Falta descripción.`;

      const cant = Number(d.cantidad);
      if (!cant || cant <= 0) return `Ítem #${i + 1}: Cantidad inválida.`;

      const alphaPct = normalizeAlphaPctUI(d.alphaPct);
      if (!Number.isFinite(alphaPct) || alphaPct < 0) {
        return `Ítem #${i + 1}: Ajuste % (alpha) inválido.`;
      }

      if (d.modo === "HH") {
        if (!d.empleadoId) return `Ítem #${i + 1}: Selecciona empleado.`;
        const hh = findHHForEmpleado(d.empleadoId);
        if (!hh) {
          return `Ítem #${i + 1}: Falta HH del período para este empleado (${mes}/${anio}).`;
        }
      } else {
        if (!d.tipoItemId) return `Ítem #${i + 1}: Selecciona Tipo ítem.`;

        const manualClean = parseCLPToNumberString(d.costoUnitarioManual);
        const manualPU = manualClean ? Number(manualClean) : null;

        const tieneCompra = !!d.compraId;
        const tieneManual =
          manualPU != null && Number.isFinite(manualPU) && manualPU > 0;

        if (!tieneCompra && !tieneManual) {
          return `Ítem #${i + 1}: En COMPRA debes seleccionar un detalle de compra o ingresar un Precio Unitario manual.`;
        }
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

        // ✅ fuerza base COSTO (permite 130%, 180%, etc.)
        utilidadObjetivoBase: "COSTO",
        utilidadPctObjetivo:
          utilidadPctObjetivo === "" ? null : Number(utilidadPctObjetivo),

        detalles: detalles.map((d) => {
          const alpha = normalizeAlphaPctUI(d.alphaPct);

          if (d.modo === "HH") {
            const hh = findHHForEmpleado(d.empleadoId);
            return {
              descripcion: d.descripcion,
              cantidad: Number(d.cantidad) || 1,
              modo: "HH",
              tipoItemId: null,
              tipoDiaId: d.tipoDiaId || null,
              alpha,
              empleadoId: d.empleadoId || null,
              hhEmpleadoId: hh?.id || null,
              compraId: null,
              costoUnitarioManual: null,
            };
          }

          const manualClean = parseCLPToNumberString(d.costoUnitarioManual);
          const manualNumber =
            manualClean && Number(manualClean) > 0 ? Number(manualClean) : null;

          return {
            descripcion: d.descripcion,
            cantidad: Number(d.cantidad) || 1,
            modo: "COMPRA",
            tipoItemId: d.tipoItemId || null, // categoría
            tipoDiaId: d.tipoDiaId || null,
            alpha,
            empleadoId: null,
            hhEmpleadoId: null,
            compraId: d.compraId || null,
            costoUnitarioManual: d.compraId ? null : manualNumber,
          };
        }),
      };

      const res = await fetch(`${API_URL}/ventas/add`, {
        method: "POST",
        headers: makeHeaders(session, empresaIdFromToken),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        console.log("❌ create venta error", res.status, data, payload);
        throw new Error(
          data?.detalle ||
            data?.error ||
            data?.message ||
            "Error al crear venta"
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
            label="Descripción de la venta"
            value={descripcionVenta}
            onChange={(e) => setDescripcionVenta(e.target.value)}
            fullWidth
            size="small"
            required
          />

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
                "Enero",
                "Febrero",
                "Marzo",
                "Abril",
                "Mayo",
                "Junio",
                "Julio",
                "Agosto",
                "Septiembre",
                "Octubre",
                "Noviembre",
                "Diciembre",
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
            const hhSelected =
              det.modo === "HH" ? findHHForEmpleado(det.empleadoId) : null;

            const hhSelectedCostoHH =
              hhSelected?.costoHH != null ? Number(hhSelected.costoHH) : 0;

            const hhSelectedCIF = getHHCIFValue(hhSelected);

            const faltaHH = det.modo === "HH" && det.empleadoId && !hhSelected;

            const tipoDiaEnabled = isTipoDiaEnabled(det);

            return (
              <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
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
                      onChange={(e) =>
                        updateDetalle(idx, { descripcion: e.target.value })
                      }
                      fullWidth
                    />

                    <TextField
                      select
                      label="Modo"
                      size="small"
                      value={det.modo}
                      onChange={(e) => {
                        const modo = e.target.value;

                        if (modo === "HH") {
                          updateDetalle(idx, {
                            modo,
                            empleadoId: det.empleadoId || "",
                            compraId: "",
                            costoUnitarioManual: "",
                            tipoItemId: tipoItemHH?.id || det.tipoItemId || "",
                          });
                        } else {
                          const nextTipoItemId =
                            det.tipoItemId &&
                            det.tipoItemId !== (tipoItemHH?.id || "")
                              ? det.tipoItemId
                              : "";

                          const ti =
                            tipoItems.find((t) => t.id === nextTipoItemId) ||
                            null;
                          const enabled = isTipoItemAllowedTipoDia(ti);

                          updateDetalle(idx, {
                            modo,
                            empleadoId: "",
                            compraId: "",
                            costoUnitarioManual: "",
                            tipoItemId: nextTipoItemId,
                            tipoDiaId: enabled ? det.tipoDiaId : "",
                          });
                        }
                      }}
                      fullWidth
                    >
                      <MenuItem value="HH">HH (Empleado)</MenuItem>
                      <MenuItem value="COMPRA">Compra (Insumo)</MenuItem>
                    </TextField>

                    {det.modo === "HH" ? (
                      <TextField
                        label="Tipo ítem (auto)"
                        size="small"
                        value={tipoItemHH ? `${tipoItemHH.nombre}` : "HH"}
                        fullWidth
                        disabled
                        helperText="En modo HH el Tipo ítem se fuerza a HH en el backend (solo categoría)."
                      />
                    ) : (
                      <TextField
                        select
                        label="Tipo ítem (categoría)"
                        size="small"
                        value={det.tipoItemId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const ti =
                            tipoItems.find((t) => t.id === nextId) || null;
                          const enabled = isTipoItemAllowedTipoDia(ti);

                          updateDetalle(idx, {
                            tipoItemId: nextId,
                            tipoDiaId: enabled ? det.tipoDiaId : "",
                          });
                        }}
                        fullWidth
                      >
                        <MenuItem value="">(Selecciona)</MenuItem>

                        {tipoItems
                          .filter(
                            (t) =>
                              String(t?.codigo || "").toUpperCase() !== "HH"
                          )
                          .filter(
                            (t) =>
                              String(t?.nombre || "").toUpperCase() !== "HH"
                          )
                          .map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.nombre}
                              {t.unidadItem?.nombre
                                ? ` (${t.unidadItem.nombre})`
                                : ""}
                            </MenuItem>
                          ))}
                      </TextField>
                    )}

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
                      onChange={(e) =>
                        updateDetalle(idx, { tipoDiaId: e.target.value })
                      }
                      fullWidth
                      disabled={!tipoDiaEnabled}
                      helperText={
                        tipoDiaEnabled
                          ? "Extra fijo sale de tipoDia.valor (Normal debería ser 0)."
                          : "Solo disponible para Tipo ítem: HH o Logística y transporte."
                      }
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
                      value={det.alphaPct}
                      onChange={(e) =>
                        updateDetalle(idx, {
                          alphaPct:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      fullWidth
                      inputProps={{ step: 1, min: 0 }}
                      helperText="Ej: 10 = +10% | 0 = sin ajuste (0 se respeta)"
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
                                  ? `${formatCLP(hhSelectedCostoHH)} | CIF: ${formatCLP(
                                      hhSelectedCIF
                                    )}`
                                  : "-"
                                : "-"
                            }
                            fullWidth
                            disabled
                            helperText={
                              det.empleadoId && !hhSelected
                                ? `No hay HHEmpleado para este empleado en ${mes}/${anio}.`
                                : "CIF se muestra aunque sea 0."
                            }
                          />

                          {faltaHH && (
                            <Alert severity="warning">
                              Falta HH del período para este empleado. Carga el HHEmpleado de{" "}
                              {mes}/{anio} o revisa la relación (empleado_id) en HHEmpleado.
                            </Alert>
                          )}
                        </Box>
                      </>
                    ) : (
                      <>
                        <TextField
                          select
                          label="Detalle de compra (opcional)"
                          size="small"
                          value={det.compraId}
                          onChange={(e) =>
                            updateDetalle(idx, {
                              compraId: e.target.value,
                              ...(e.target.value ? { costoUnitarioManual: "" } : {}),
                            })
                          }
                          fullWidth
                          helperText="Si seleccionas uno, costea con datos reales. Si lo dejas vacío, ingresa PU manual."
                        >
                          <MenuItem value="">(Sin vincular: usar PU manual)</MenuItem>
                          {compraItems.map((ci) => (
                            <MenuItem key={ci.id} value={ci.id}>
                              {compraItemLabel(ci)}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Precio unitario manual (opcional)"
                          size="small"
                          type="text"
                          value={det.costoUnitarioManual}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const clean = parseCLPToNumberString(raw);

                            updateDetalle(idx, {
                              costoUnitarioManual: clean ? toCLPDisplay(clean) : "",
                              ...(clean ? { compraId: "" } : {}),
                            });
                          }}
                          fullWidth
                          inputProps={{ inputMode: "numeric" }}
                          disabled={!!det.compraId}
                          helperText={
                            det.compraId
                              ? "Deshabilitado porque seleccionaste un CompraItem."
                              : "Ingresa PU para estimación (COMPRA manual)."
                          }
                        />
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

          {/* ✅ % utilidad objetivo global (sobre costo) */}
          <TextField
            label="% utilidad objetivo (sobre costo)"
            size="small"
            type="number"
            value={utilidadPctObjetivo}
            onChange={(e) => setUtilidadPctObjetivo(e.target.value)}
            fullWidth
            inputProps={{ step: 0.1, min: 0 }} // ✅ sin max
            helperText="Ej: 60% => venta = costo * 1.60 | 130% => venta = costo * 2.30. Si lo dejas vacío, se usa solo costo + tipo día + alpha."
          />

          <Card sx={{ borderRadius: 2, background: "rgba(25,118,210,0.05)" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Totales (preview)
              </Typography>
              <Typography fontWeight={700}>
                Venta: {formatCLP(preview.total)} | Costo: {formatCLP(preview.costo)} | Utilidad:{" "}
                {formatCLP(preview.utilidad)}
              </Typography>
              {utilidadPctObjetivo !== "" && (
                <Typography variant="caption" color="text.secondary">
                  Factor aplicado (k): {Number(preview.k || 1).toFixed(4)}
                </Typography>
              )}
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
