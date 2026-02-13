"use client";

import { useEffect, useMemo, useState } from "react";
import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function useVentaForm({
  open,
  session,
  empresaIdFromToken,
  ventaId = null,
}) {
  const isEdit = !!ventaId;

  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [descripcionVenta, setDescripcionVenta] = useState("");
  const [ordenVentaId, setOrdenVentaId] = useState("");
  const [utilidadPctObjetivo, setUtilidadPctObjetivo] = useState("");

  const now = useMemo(() => new Date(), []);
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1));

  const [tipoItems, setTipoItems] = useState([]);
  const [tipoDias, setTipoDias] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [hhRegistros, setHhRegistros] = useState([]);
  const [compraItems, setCompraItems] = useState([]);

  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [catalogosErr, setCatalogosErr] = useState("");

  const [loadingVenta, setLoadingVenta] = useState(false);
  const [ventaCargada, setVentaCargada] = useState(false);

  const [periodoAuto, setPeriodoAuto] = useState({ loading: false, err: "" });

  const empleadoLabel = (emp) =>
    emp?.usuario?.nombre || emp?.nombre || emp?.rut || emp?.id || "Empleado";

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
    return (
      tipoItems.find((t) => String(t?.codigo || "").toUpperCase() === "HH") ||
      tipoItems.find((t) => String(t?.nombre || "").toUpperCase() === "HH") ||
      null
    );
  }, [tipoItems]);

  const normalizeAlphaPctUI = (v) => {
    if (v == null || v === "") return 10;
    const n = Number(v);
    if (!Number.isFinite(n)) return 10;
    if (n < 0) return 0;
    return n;
  };

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

  const isTipoDiaEnabled = () => true;

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

  const shiftYM = (anio, mes, delta) => {
    const d = new Date(Number(anio), Number(mes) - 1, 1);
    d.setMonth(d.getMonth() + delta);
    return { anio: String(d.getFullYear()), mes: String(d.getMonth() + 1) };
  };

  const autoPickHHPeriodo = async () => {
    if (!session?.user) return;
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
          dataOV?.error || dataOV?.message || "Error cargando ordenesVenta",
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

  useEffect(() => {
    if (!open) return;

    setFormErr("");
    setCatalogosErr("");

    if (!isEdit) resetForm();
    else setVentaCargada(false);

    fetchCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;
    if (isEdit) return;

    autoPickHHPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, isEdit]);

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

    return (
      hhRegistros.find((hh) => normalizeRut(getHHRut(hh)) === empRut) || null
    );
  };

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
        setUtilidadPctObjetivo(
          Number.isFinite(utilidadNum) ? String(utilidadNum) : "",
        );
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
      { ...emptyDet(), tipoItemId: tipoItemHH?.id || "" },
    ]);

  const removeDetalle = (idx) =>
    setDetalles((prev) => prev.filter((_, i) => i !== idx));

const preview = useMemo(() => {
  // 1) calcular costoConAlpha por ítem (esto es COSTO, no utilidad)
  const linesBase = detalles.map((d) => {
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
      const manualPU = getManualPUNumber(d);
      const costoUnit = Number.isFinite(manualPU) ? manualPU : 0;
      costoSinAlpha = costoUnit * cantidad;
    }

    const costoBase = costoSinAlpha + extraFijo;
    const costoConAlpha = costoBase * alphaMult;

    // en tu backend, antes del % objetivo: venta = costo
    const ventaActual = costoConAlpha;

    return {
      costoTotal: costoConAlpha,
      ventaActual,
      cantidad,
    };
  });

  const totalCosto = linesBase.reduce((acc, x) => acc + (x.costoTotal || 0), 0);
  const totalVentaActual = linesBase.reduce(
    (acc, x) => acc + (x.ventaActual || 0),
    0
  );

  // 2) aplicar MARGEN sobre venta (igual que backend)
  const uPct = utilidadPctObjetivo === "" ? null : Number(utilidadPctObjetivo);

  // Igual que tu backend: base por defecto VENTA_ACTUAL
  const base = "VENTA_ACTUAL"; // si después haces selector, cámbialo aquí

  let k = 1;

  if (uPct != null && Number.isFinite(uPct) && uPct >= 0) {
    const u = uPct / 100;
    const denom = 1 - u;

    // backend: baseMonto = (base === VENTA_ACTUAL) ? totalVentaActual : totalCosto
    const baseMonto = base === "VENTA_ACTUAL" ? totalVentaActual : totalCosto;

    // ventaObjetivo = baseMonto / (1 - u)
    const ventaObjetivo = denom > 0 ? baseMonto / denom : null;

    // k = ventaObjetivo / totalVentaActual
    if (
      ventaObjetivo != null &&
      Number.isFinite(ventaObjetivo) &&
      ventaObjetivo > 0 &&
      totalVentaActual > 0
    ) {
      k = ventaObjetivo / totalVentaActual;
    }
  }

  // 3) aplicar k a cada línea (ventaFinal) y recalcular utilidad/pct
  const linesFinal = linesBase.map((x) => {
    const costoTotal = Number(x.costoTotal || 0);
    const ventaTotal = Number(x.ventaActual || 0) * (Number.isFinite(k) ? k : 1);
    const utilidad = ventaTotal - costoTotal;
    const pct = ventaTotal > 0 ? (utilidad / ventaTotal) * 100 : 0;
    return { costoTotal, ventaTotal, utilidad, pct };
  });

  const totalVenta = totalVentaActual * (Number.isFinite(k) ? k : 1);
  const utilidad = totalVenta - totalCosto;

  return {
    k,
    total: totalVenta, // venta final
    costo: totalCosto,
    utilidad,
    lines: linesFinal,
  };
}, [
  detalles,
  tipoDias,
  hhRegistros,
  empleados,
  tipoItemHH,
  utilidadPctObjetivo,
]);


  const validateForm = () => {
    if (!detalles.length) return "Debes agregar al menos un ítem.";

    if (utilidadPctObjetivo !== "") {
      const u = Number(utilidadPctObjetivo);
      if (!Number.isFinite(u) || u < 0) {
        return "% utilidad objetivo inválido (>= 0).";
      }
      if (u >= 100) {
        return "% utilidad objetivo inválido (< 100).";
      }
    }

    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      if (!d.descripcion?.trim()) return `Ítem #${i + 1}: Falta descripción.`;

      const cant = Number(d.cantidad);
      if (!cant || cant <= 0) return `Ítem #${i + 1}: Cantidad inválida.`;

      const alphaPct = normalizeAlphaPctUI(d.alphaPct);
      if (!Number.isFinite(alphaPct) || alphaPct < 0)
        return `Ítem #${i + 1}: Ajuste % (alpha) inválido.`;

      if (d.modo === "HH") {
        if (!d.empleadoId) return `Ítem #${i + 1}: Selecciona empleado.`;
        const hh = findHHForEmpleado(d.empleadoId);
        if (!hh)
          return `Ítem #${i + 1}: Falta HH del período para este empleado (${mes}/${anio}).`;
      } else {
        if (!d.tipoItemId) return `Ítem #${i + 1}: Selecciona Tipo ítem.`;

        const manualClean = parseCLPToNumberString(d.costoUnitarioManual);
        const manualPU = manualClean ? Number(manualClean) : null;

        const tieneManual =
          manualPU != null && Number.isFinite(manualPU) && manualPU > 0;

        if (!tieneManual)
          return `Ítem #${i + 1}: En COMPRA debes ingresar un Precio Unitario manual.`;
      }
    }

    return "";
  };

  const submitVenta = async ({ onClose, onCreated }) => {
    const msg = validateForm();
    if (msg) {
      setFormErr(msg);
      return false;
    }

    try {
      setSaving(true);
      setFormErr("");

      const payload = {
        ordenVentaId: ordenVentaId || null,
        descripcion: descripcionVenta || null,
        utilidadObjetivoBase: "VENTA_ACTUAL",
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
            tipoItemId: d.tipoItemId || null,
            tipoDiaId: d.tipoDiaId || null,
            alpha,
            empleadoId: null,
            hhEmpleadoId: null,
            compraId: null,
            costoUnitarioManual: manualNumber,
          };
        }),
      };

      const url = isEdit
        ? `${API_URL}/ventas/${ventaId}`
        : `${API_URL}/ventas/add`;
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
          data?.detalle ||
            data?.error ||
            data?.message ||
            "Error al guardar venta",
        );
      }

      onClose?.();
      await onCreated?.();
      return true;
    } catch (e) {
      setFormErr(e?.message || "Error al guardar venta");
      console.error("Error al guardar venta:", e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    isEdit,

    saving,
    formErr,
    setFormErr,

    descripcionVenta,
    setDescripcionVenta,
    ordenVentaId,
    setOrdenVentaId,
    utilidadPctObjetivo,
    setUtilidadPctObjetivo,

    anio,
    setAnio,
    mes,
    setMes,

    tipoItems,
    tipoDias,
    ordenesVenta,
    empleados,
    hhRegistros,
    compraItems,

    loadingCatalogos,
    catalogosErr,
    loadingVenta,

    periodoAuto,

    tipoItemHH,

    empleadoLabel,
    parseCLPToNumberString,
    toCLPDisplay,

    isTipoItemAllowedTipoDia,
    isTipoDiaEnabled,

    getHHCIFValue,
    findHHForEmpleado,

    detalles,
    updateDetalle,
    addDetalle,
    removeDetalle,

    preview,
    resetForm,

    submitVenta,
    setVentaCargada,
  };
}
