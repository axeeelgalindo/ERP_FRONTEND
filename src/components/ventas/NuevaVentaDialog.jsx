// src/components/ventas/NuevaVentaDialog.jsx
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
  ventaId = null, // ✅ EDIT si viene
}) {
  const isEdit = !!ventaId;

  // =========================
  // Form state
  // =========================
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [descripcionVenta, setDescripcionVenta] = useState("");
  const [ordenVentaId, setOrdenVentaId] = useState("");
  const [utilidadPctObjetivo, setUtilidadPctObjetivo] = useState("");

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

  // carga venta a editar
  const [loadingVenta, setLoadingVenta] = useState(false);
  const [ventaCargada, setVentaCargada] = useState(false);

  // auto periodo HH
  const [periodoAuto, setPeriodoAuto] = useState({ loading: false, err: "" });

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

  const tipoItemHH = useMemo(() => {
    const hh =
      tipoItems.find((t) => String(t?.codigo || "").toUpperCase() === "HH") ||
      tipoItems.find((t) => String(t?.nombre || "").toUpperCase() === "HH") ||
      null;
    return hh;
  }, [tipoItems]);

  const normalizeAlphaPctUI = (v) => {
    if (v == null || v === "") return 10;
    const n = Number(v);
    if (!Number.isFinite(n)) return 10;
    if (n < 0) return 0;
    return n;
  };

  // money helpers
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

  // Tipo día enable rule
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
    return true;
  };

  const emptyDet = () => ({
    descripcion: "",
    modo: "HH",
    cantidad: 1,
    tipoItemId: "",
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
    setVentaCargada(false);
    setPeriodoAuto({ loading: false, err: "" });
  };

  // =========================
  // auto periodo HH (mes anterior hacia atrás)
  // =========================
  const shiftYM = (anio, mes, delta) => {
    const d = new Date(Number(anio), Number(mes) - 1, 1);
    d.setMonth(d.getMonth() + delta);
    return { anio: String(d.getFullYear()), mes: String(d.getMonth() + 1) };
  };

  const autoPickHHPeriodo = async () => {
    if (!session?.user) return;

    // En EDIT: si la venta ya cargó y seteo anio/mes, no sobreescribir
    if (isEdit && ventaCargada) return;

    try {
      setPeriodoAuto({ loading: true, err: "" });

      const headers = makeHeaders(session, empresaIdFromToken);

      let cur = {
        anio: String(now.getFullYear()),
        mes: String(now.getMonth() + 1),
      };
      cur = shiftYM(cur.anio, cur.mes, -1);

      for (let i = 0; i < 24; i++) {
        const res = await fetch(
          `${API_URL}/ventas/hh-empleados?anio=${cur.anio}&mes=${cur.mes}`,
          { headers, cache: "no-store" },
        );
        const data = await safeJson(res);
        const arr = Array.isArray(data) ? data : [];

        if (res.ok && arr.length > 0) {
          setAnio(cur.anio);
          setMes(cur.mes);
          setHhRegistros(arr);
          setPeriodoAuto({ loading: false, err: "" });
          return;
        }

        cur = shiftYM(cur.anio, cur.mes, -1);
      }

      setPeriodoAuto({
        loading: false,
        err: "No se encontró HHEmpleado en los últimos 24 meses.",
      });
    } catch (e) {
      setPeriodoAuto({
        loading: false,
        err: e?.message || "Error buscando período HH.",
      });
    }
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
            "Error cargando tipoItems",
        );
      if (!resTipoDias.ok)
        throw new Error(
          dataTipoDias?.error ||
            dataTipoDias?.message ||
            "Error cargando tipoDias",
        );
      if (!resOV.ok)
        throw new Error(
          dataOV?.error || dataOV?.message || "Error cargando cotizaciones/OV",
        );

      const ti = Array.isArray(dataTipoItems) ? dataTipoItems : [];
      setTipoItems(ti);
      setTipoDias(Array.isArray(dataTipoDias) ? dataTipoDias : []);
      setOrdenesVenta(Array.isArray(dataOV) ? dataOV : []);

      const [resEmpleados, resCompraDisp] = await Promise.all([
        fetch(`${API_URL}/ventas/empleados`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/compras/disponibles-venta`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const [dataEmpleados, dataCompraDisp] = await Promise.all([
        safeJson(resEmpleados),
        safeJson(resCompraDisp),
      ]);

      if (!resEmpleados.ok)
        throw new Error(
          dataEmpleados?.error ||
            dataEmpleados?.message ||
            "Error cargando empleados",
        );
      if (!resCompraDisp.ok)
        throw new Error(
          dataCompraDisp?.error ||
            dataCompraDisp?.message ||
            "Error compras disponibles",
        );

      setEmpleados(Array.isArray(dataEmpleados) ? dataEmpleados : []);

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
          (c.items || []).map((it) => ({ ...it, compra: c })),
        );
        setCompraItems(itemsFlat);
      }

      // Si es creación, forzar tipoItemId HH en detalles HH
      const hh =
        ti.find((t) => String(t?.codigo || "").toUpperCase() === "HH") ||
        ti.find((t) => String(t?.nombre || "").toUpperCase() === "HH") ||
        null;

      if (!isEdit && hh?.id) {
        setDetalles((prev) =>
          prev.map((d) => (d.modo === "HH" ? { ...d, tipoItemId: hh.id } : d)),
        );
      }
    } catch (e) {
      setCatalogosErr(e?.message || "Error cargando catálogos");
    } finally {
      setLoadingCatalogos(false);
    }
  };

  // ✅ al abrir: si CREATE resetea; si EDIT no, porque vamos a cargar venta
  useEffect(() => {
    if (!open) return;

    setFormErr("");
    setCatalogosErr("");

    if (!isEdit) {
      resetForm();
    } else {
      setVentaCargada(false);
    }

    fetchCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ✅ auto período HH (solo CREATE y solo cuando abre)
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;
    if (isEdit) return;

    autoPickHHPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, isEdit]);

  // recargar HH cuando cambia período (en este modal solo cambia por autoPick o por edit)
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        const headers = makeHeaders(session, empresaIdFromToken);
        const resHH = await fetch(
          `${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`,
          { headers, cache: "no-store" },
        );
        const dataHH = await safeJson(resHH);
        if (!resHH.ok) throw new Error(dataHH?.error || "Error HHEmpleado");
        setHhRegistros(Array.isArray(dataHH) ? dataHH : []);
      } catch {
        // silencioso
      }
    })();
  }, [anio, mes, open, session, empresaIdFromToken]);

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

    return hhRegistros.find((hh) => normalizeRut(getHHRut(hh)) === empRut) || null;
  };

  // =========================
  // ✅ EDIT: cargar venta y poblar formulario
  // =========================
  const loadVentaToEdit = async () => {
    if (!isEdit || !ventaId || !session?.user || ventaCargada) return;

    try {
      setLoadingVenta(true);
      setFormErr("");

      const headers = makeHeaders(session, empresaIdFromToken);
      const res = await fetch(`${API_URL}/ventas/${ventaId}`, {
        headers,
        cache: "no-store",
      });
      const data = await safeJson(res);

      if (!res.ok)
        throw new Error(data?.error || data?.message || "Error cargando venta");

      setDescripcionVenta(data?.descripcion || "");
      setOrdenVentaId(data?.ordenVentaId || "");

      if (data?.utilidadObjetivoPct != null) {
        const utilidadNum = Number(data.utilidadObjetivoPct);
        setUtilidadPctObjetivo(Number.isFinite(utilidadNum) ? String(utilidadNum) : "");
      } else {
        setUtilidadPctObjetivo("");
      }

      const anyHH = (data?.detalles || []).find(
        (d) => d?.modo === "HH" && d?.hhEmpleado,
      );
      if (anyHH?.hhEmpleado?.anio) setAnio(String(anyHH.hhEmpleado.anio));
      if (anyHH?.hhEmpleado?.mes) setMes(String(anyHH.hhEmpleado.mes));

      const hhTipoItem = tipoItems.find(
        (t) =>
          String(t?.codigo || "").toUpperCase() === "HH" ||
          String(t?.nombre || "").toUpperCase() === "HH",
      );

      const mapped = (data?.detalles || []).map((d) => {
        const modo = d?.modo || "HH";

        if (modo === "HH") {
          return {
            descripcion: d?.descripcion || "",
            modo: "HH",
            cantidad: Number(d?.cantidad) || 1,
            tipoItemId: hhTipoItem?.id || "",
            tipoDiaId: d?.tipoDiaId || "",
            alphaPct: d?.alpha == null ? 10 : Number(d.alpha),
            empleadoId: d?.empleadoId || "",
            compraId: "",
            costoUnitarioManual: "",
          };
        }

        const manualPU = d?.compraId
          ? ""
          : d?.costoUnitario != null
            ? toCLPDisplay(Number(d.costoUnitario))
            : "";

        return {
          descripcion: d?.descripcion || "",
          modo: "COMPRA",
          cantidad: Number(d?.cantidad) || 1,
          tipoItemId: d?.tipoItemId || "",
          tipoDiaId: d?.tipoDiaId || "",
          alphaPct: d?.alpha == null ? 10 : Number(d.alpha),
          empleadoId: "",
          compraId: d?.compraId || "",
          costoUnitarioManual: manualPU,
        };
      });

      setDetalles(mapped.length ? mapped : [emptyDet()]);
      setVentaCargada(true);
    } catch (e) {
      setFormErr(e?.message || "Error cargando venta");
      console.error("Error cargando venta:", e);
    } finally {
      setLoadingVenta(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!isEdit) return;
    if (!ventaId) return;
    if (loadingCatalogos) return;
    if (ventaCargada) return;

    loadVentaToEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, ventaId, loadingCatalogos, tipoItems.length]);

  useEffect(() => {
    if (!open) return;

    if (tipoItemHH?.id) {
      setDetalles((prev) =>
        prev.map((det) => {
          if (det.modo === "HH" && !det.tipoItemId)
            return { ...det, tipoItemId: tipoItemHH.id };
          return det;
        }),
      );
    }
  }, [tipoItemHH, open]);

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

  // =========================
  // preview
  // =========================
  const preview = useMemo(() => {
    const lines = detalles.map((d) => {
      const cantidad = Number(d.cantidad) || 1;

      const alphaPct = normalizeAlphaPctUI(d.alphaPct);
      const alphaMult = 1 + alphaPct / 100;

      const tipoDia = tipoDias.find((t) => t.id === d.tipoDiaId) || null;
      const extraFijo = tipoDia ? Number(tipoDia.valor ?? 0) : 0;

      let costoSinAlpha = 0;

      if (d.modo === "HH") {
        const hh = findHHForEmpleado(d.empleadoId);
        const costoHH = hh?.costoHH != null ? Number(hh.costoHH) : 0;
        const cif = getHHCIFValue(hh);
        costoSinAlpha = costoHH * cantidad + cif;
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

        costoSinAlpha = costoUnit * cantidad;
      }

      const costoBase = costoSinAlpha + extraFijo;
      const costoConAlpha = costoBase * alphaMult;

      return { costoConAlpha };
    });

    const totalCosto = lines.reduce((acc, x) => acc + (x.costoConAlpha || 0), 0);

    const u = utilidadPctObjetivo === "" ? null : Number(utilidadPctObjetivo);
    const k = u != null && Number.isFinite(u) && u >= 0 ? 1 + u / 100 : 1;

    const linesFinal = lines.map((x) => {
      const ventaTotal = (x.costoConAlpha || 0) * k;
      const utilidad = ventaTotal - (x.costoConAlpha || 0);
      const pct = ventaTotal > 0 ? (utilidad / ventaTotal) * 100 : 0;
      return {
        costoTotal: x.costoConAlpha,
        ventaTotal,
        utilidad,
        pct,
      };
    });

    const totalVenta = totalCosto * k;
    const utilidad = totalVenta - totalCosto;

    return {
      k,
      total: totalVenta,
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

    if (utilidadPctObjetivo !== "") {
      const u = Number(utilidadPctObjetivo);
      if (!Number.isFinite(u) || u < 0) return "% utilidad objetivo inválido (>= 0).";
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
        if (!hh)
          return `Ítem #${i + 1}: Falta HH del período para este empleado (${mes}/${anio}).`;
      } else {
        if (!d.tipoItemId) return `Ítem #${i + 1}: Selecciona Tipo ítem.`;

        const manualClean = parseCLPToNumberString(d.costoUnitarioManual);
        const manualPU = manualClean ? Number(manualClean) : null;

        const tieneCompra = !!d.compraId;
        const tieneManual = manualPU != null && Number.isFinite(manualPU) && manualPU > 0;

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

        /**
         * ✅ FIX: TU BACKEND ACTUAL ESTÁ ACEPTANDO SOLO (COSTO | VENTA)
         * El error que vuelve lo confirma.
         * Para mantener el comportamiento de tu preview (markup sobre costo con alpha),
         * enviamos COSTO.
         *
         * Cuando tu backend ya acepte VENTA_ACTUAL, lo cambias de vuelta.
         */
        utilidadObjetivoBase: "COSTO",
        utilidadPctObjetivo: utilidadPctObjetivo === "" ? null : Number(utilidadPctObjetivo),

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
            tipoItemId: d.tipoItemId || null,
            tipoDiaId: d.tipoDiaId || null,
            alpha,
            empleadoId: null,
            hhEmpleadoId: null,
            compraId: d.compraId || null,
            costoUnitarioManual: d.compraId ? null : manualNumber,
          };
        }),
      };

      const url = isEdit ? `${API_URL}/ventas/${ventaId}` : `${API_URL}/ventas/add`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: makeHeaders(session, empresaIdFromToken),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        console.log("❌ save venta error", res.status, data, payload);
        throw new Error(
          data?.detalle || data?.error || data?.message || "Error al guardar venta",
        );
      }

      onClose?.();
      await onCreated?.();
    } catch (e) {
      setFormErr(e?.message || "Error al guardar venta");
      console.error("Error al guardar venta:", e);
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // UI
  // =========================
  const handleClose = () => {
    if (isEdit) setVentaCargada(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? `Editar costeo #${ventaId?.slice?.(0, 6) || ""}` : "Nueva venta"}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2 }}>
          {(loadingCatalogos || loadingVenta) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {loadingVenta ? "Cargando costeo..." : "Cargando catálogos..."}
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
          </Stack>
        </Box>

        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            p: 2,
          }}
        >
          <Stack spacing={1.25}>
            <TextField
              label="% utilidad objetivo (markup sobre costo con alpha)"
              size="small"
              type="number"
              value={utilidadPctObjetivo}
              onChange={(e) => setUtilidadPctObjetivo(e.target.value)}
              fullWidth
              inputProps={{ step: 0.1, min: 0 }}
            />

            <Card
              sx={{
                borderRadius: 2,
                background: "rgba(25,118,210,0.05)",
              }}
            >
              <CardContent sx={{ width: "100%" }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  className="text-center uppercase mb-3"
                >
                  Totales
                </Typography>

                <div className="w-full flex justify-between items-center">
                  <Typography fontWeight={700}>Venta: {formatCLP(preview.total)}</Typography>
                  <Typography fontWeight={700}>Costo: {formatCLP(preview.costo)}</Typography>
                  <Typography fontWeight={700}>Utilidad: {formatCLP(preview.utilidad)}</Typography>
                </div>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Ítems (detalleVenta)
            </Typography>

            {detalles.map((det, idx) => {
              const hhSelected = det.modo === "HH" ? findHHForEmpleado(det.empleadoId) : null;
              const hhSelectedCostoHH = hhSelected?.costoHH != null ? Number(hhSelected.costoHH) : 0;
              const hhSelectedCIF = getHHCIFValue(hhSelected);
              const faltaHH = det.modo === "HH" && det.empleadoId && !hhSelected;
              const tipoDiaEnabled = isTipoDiaEnabled(det);

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
                              det.tipoItemId && det.tipoItemId !== (tipoItemHH?.id || "")
                                ? det.tipoItemId
                                : "";

                            const ti = tipoItems.find((t) => t.id === nextTipoItemId) || null;
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
                          helperText="En modo HH el Tipo ítem se fuerza a HH."
                        />
                      ) : (
                        <TextField
                          select
                          label="Tipo ítem (categoría)"
                          size="small"
                          value={det.tipoItemId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const ti = tipoItems.find((t) => t.id === nextId) || null;
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
                            .filter((t) => String(t?.codigo || "").toUpperCase() !== "HH")
                            .filter((t) => String(t?.nombre || "").toUpperCase() !== "HH")
                            .map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.nombre}
                                {t.unidadItem?.nombre ? ` (${t.unidadItem.nombre})` : ""}
                              </MenuItem>
                            ))}
                        </TextField>
                      )}

                      <TextField
                        label="Cantidad"
                        size="small"
                        type="number"
                        value={det.cantidad}
                        onChange={(e) => updateDetalle(idx, { cantidad: Number(e.target.value) })}
                        fullWidth
                        inputProps={{ min: 1 }}
                      />

                      <TextField
                        select
                        label="Tipo día"
                        size="small"
                        value={det.tipoDiaId}
                        onChange={(e) => updateDetalle(idx, { tipoDiaId: e.target.value })}
                        fullWidth
                        disabled={!tipoDiaEnabled}
                      >
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
                            alphaPct: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                        fullWidth
                        inputProps={{ step: 1, min: 0 }}
                        helperText="Ej: 10 = +10% | 0 = sin ajuste"
                      />

                      {det.modo === "HH" ? (
                        <>
                          <TextField
                            select
                            label="Empleado"
                            size="small"
                            value={det.empleadoId}
                            onChange={(e) => updateDetalle(idx, { empleadoId: e.target.value })}
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
                                        hhSelectedCIF,
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
                                Falta HH del período para este empleado ({mes}/{anio}).
                              </Alert>
                            )}
                          </Box>
                        </>
                      ) : (
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
                      )}
                    </Box>

                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Preview ítem: costo {formatCLP(preview.lines[idx]?.costoTotal)} | venta{" "}
                        {formatCLP(preview.lines[idx]?.ventaTotal)} | utilidad{" "}
                        {formatCLP(preview.lines[idx]?.utilidad)}{" "}
                        {preview.lines[idx]?.pct != null ? `(${preview.lines[idx].pct.toFixed(1)}%)` : ""}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}

            <Button variant="outlined" startIcon={<AddIcon />} onClick={addDetalle}>
              Agregar ítem
            </Button>

            {formErr && <Alert severity="error">{formErr}</Alert>}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit" disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submitVenta}
          disabled={saving || loadingCatalogos || loadingVenta}
        >
          {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear venta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
