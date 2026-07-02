"use client";

import { useEffect, useMemo, useState } from "react";
import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP, formatMoney } from "@/components/ventas/utils/money";

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

  // ✅ NUEVO: descuento general
  const [descuentoPct, setDescuentoPct] = useState("");
  const [moneda, setMoneda] = useState("CLP");

  // ✅ tipo día por costeo
  const [isFeriado, setIsFeriado] = useState(false);
  const [isUrgencia, setIsUrgencia] = useState(false);

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

  // ✅ periodos HH disponibles
  const [hhPeriodos, setHhPeriodos] = useState([]); // [{anio,mes,nombre}]
  const [hhPeriodoKey, setHhPeriodoKey] = useState(""); // "YYYY-M"
  const [loadingHHPeriodos, setLoadingHHPeriodos] = useState(false);
  const [hhPeriodosErr, setHhPeriodosErr] = useState("");

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

  // ✅ NUEVO: normalizador para descuento (permite "" como vacío en input)
  const normalizeDescPctUI = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n >= 100) return 99.99;
    return n;
  };

  const parseCLPToNumberString = (s) => {
    if (moneda === "CLP") {
      const digits = String(s ?? "").replace(/[^\d]/g, "");
      return digits ? String(Number(digits)) : "";
    } else {
      const clean = String(s ?? "")
        .replace(/[^0-9.,]/g, "")
        .replace(/,/g, ".");
      const parts = clean.split(".");
      if (parts.length > 2) {
        return parts[0] + "." + parts.slice(1).join("");
      }
      return clean;
    }
  };

  const toCLPDisplay = (sOrNumber) => {
    const n = Number(sOrNumber);
    if (!Number.isFinite(n)) return "";
    if (moneda === "CLP") {
      return formatMoney(n, "CLP");
    } else {
      return String(Number(n.toFixed(4)));
    }
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

    // ✅ NUEVO
    descuentoPct: 0,

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

    // ✅ NUEVO
    setDescuentoPct("");
    setMoneda("CLP");

    setIsFeriado(false);
    setIsUrgencia(false);

    setHhPeriodoKey("");
    setHhRegistros([]);

    setAnio(String(d.getFullYear()));
    setMes(String(d.getMonth() + 1));
    setDetalles([emptyDet()]);
    setFormErr("");
    setCatalogosErr("");
    setVentaCargada(false);

    setHhPeriodos([]);
    setHhPeriodosErr("");
    setLoadingHHPeriodos(false);
  };

  const shiftYM = (anio, mes, delta) => {
    const d = new Date(Number(anio), Number(mes) - 1, 1);
    d.setMonth(d.getMonth() + delta);
    return { anio: String(d.getFullYear()), mes: String(d.getMonth() + 1) };
  };

  // ===========================
  // ✅ cargar periodos HH disponibles
  // ===========================
  const loadHHPeriodos = async () => {
    if (!session?.user) return;

    try {
      setLoadingHHPeriodos(true);
      setHhPeriodosErr("");

      const headers = makeHeaders(session, empresaIdFromToken);

      let cur = {
        anio: String(now.getFullYear()),
        mes: String(now.getMonth() + 1),
      };
      cur = shiftYM(cur.anio, cur.mes, -1);

      const found = [];

      for (let i = 0; i < 24; i++) {
        const res = await fetch(
          `${API_URL}/hh/periodos?anio=${cur.anio}&mes=${cur.mes}`,
          { headers, cache: "no-store" },
        );
        const data = await safeJson(res);
        const arr = Array.isArray(data) ? data : [];

        if (res.ok && arr.length > 0) {
          found.push({
            anio: Number(cur.anio),
            mes: Number(cur.mes),
            nombre: `${String(cur.mes).padStart(2, "0")}/${cur.anio}`,
          });
        }

        cur = shiftYM(cur.anio, cur.mes, -1);
      }

      setHhPeriodos(found);

      if (!found.length) {
        setHhPeriodosErr("No se encontró HHEmpleado en los últimos 24 meses.");
      }
    } catch (e) {
      setHhPeriodosErr(e?.message || "Error cargando períodos HH.");
    } finally {
      setLoadingHHPeriodos(false);
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
        fetch(`${API_URL}/ventas/ordenes-venta`, { headers, cache: "no-store" }),
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
          dataTipoDias?.error || dataTipoDias?.message || "Error cargando tipoDias",
        );
      if (!resOV.ok)
        throw new Error(dataOV?.error || dataOV?.message || "Error cargando ordenesVenta");

      const ti = Array.isArray(dataTipoItems) ? dataTipoItems : [];
      setTipoItems(ti);
      setTipoDias(Array.isArray(dataTipoDias) ? dataTipoDias : []);
      setOrdenesVenta(Array.isArray(dataOV) ? dataOV : []);

      const [resEmpleados, resCompraDisp] = await Promise.all([
        fetch(`${API_URL}/ventas/empleados`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/compras/disponibles-venta`, { headers, cache: "no-store" }),
      ]);

      const [dataEmpleados, dataCompraDisp] = await Promise.all([
        safeJson(resEmpleados),
        safeJson(resCompraDisp),
      ]);

      if (!resEmpleados.ok)
        throw new Error(
          dataEmpleados?.error || dataEmpleados?.message || "Error cargando empleados",
        );

      if (!resCompraDisp.ok)
        throw new Error(
          dataCompraDisp?.error || dataCompraDisp?.message || "Error compras disponibles",
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
    setHhPeriodosErr("");

    if (!isEdit) resetForm();
    else setVentaCargada(false);

    fetchCatalogos();
    loadHHPeriodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    if (!hhPeriodoKey) {
      setHhRegistros([]);
      return;
    }

    const [a, m] = String(hhPeriodoKey).split("-");
    if (!a || !m) return;

    const aStr = String(Number(a));
    const mStr = String(Number(m));

    setAnio(aStr);
    setMes(mStr);

    (async () => {
      try {
        const headers = makeHeaders(session, empresaIdFromToken);
        const resHH = await fetch(
          `${API_URL}/hh/periodos?anio=${aStr}&mes=${mStr}`,
          { headers, cache: "no-store" },
        );
        const dataHH = await safeJson(resHH);
        if (!resHH.ok) throw new Error(dataHH?.error || "Error HHEmpleado");
        setHhRegistros(Array.isArray(dataHH) ? dataHH : []);
      } catch {
        setHhRegistros([]);
      }
    })();
  }, [hhPeriodoKey, open, session, empresaIdFromToken]);

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

      if (!res.ok) throw new Error(data?.error || data?.message || "Error cargando venta");

      setDescripcionVenta(data?.descripcion || "");
      setOrdenVentaId(data?.ordenVentaId || "");

      setIsFeriado(!!data?.isFeriado);
      setIsUrgencia(!!data?.isUrgencia);

      // ✅ NUEVO: descuento general
      if (data?.descuentoPct != null) {
        const dn = Number(data.descuentoPct);
        setDescuentoPct(Number.isFinite(dn) ? String(dn) : "");
      } else {
        setDescuentoPct("");
      }

      if (data?.moneda) {
        setMoneda(data.moneda);
      } else {
        setMoneda("CLP");
      }

      if (data?.utilidadObjetivoPct != null) {
        const utilidadNum = Number(data.utilidadObjetivoPct);
        setUtilidadPctObjetivo(Number.isFinite(utilidadNum) ? String(utilidadNum) : "");
      } else {
        setUtilidadPctObjetivo("");
      }

      const anyHH = (data?.detalles || []).find((d) => d?.modo === "HH" && d?.hhEmpleado);
      const editAnio = anyHH?.hhEmpleado?.anio ? String(anyHH.hhEmpleado.anio) : "";
      const editMes = anyHH?.hhEmpleado?.mes ? String(anyHH.hhEmpleado.mes) : "";

      if (editAnio && editMes) {
        setAnio(editAnio);
        setMes(editMes);
        setHhPeriodoKey(`${Number(editAnio)}-${Number(editMes)}`);
      }

      const hhTipoItem = tipoItems.find(
        (t) =>
          String(t?.codigo || "").toUpperCase() === "HH" ||
          String(t?.nombre || "").toUpperCase() === "HH",
      );

      const mapped = (data?.detalles || []).map((d) => {
        const modo = d?.modo || "HH";
        const descPctLine = d?.descuentoPct == null ? 0 : Number(d.descuentoPct);

        if (modo === "HH") {
          return {
            descripcion: d?.descripcion || "",
            modo: "HH",
            cantidad: (d?.cantidad !== null && d?.cantidad !== undefined && d?.cantidad !== "") ? Number(d.cantidad) : 1,
            tipoItemId: hhTipoItem?.id || "",
            tipoDiaId: d?.tipoDiaId || "",
            alphaPct: d?.alpha == null ? 10 : Number(d.alpha),

            // ✅ NUEVO
            descuentoPct: Number.isFinite(descPctLine) ? descPctLine : 0,

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
          cantidad: (d?.cantidad !== null && d?.cantidad !== undefined && d?.cantidad !== "") ? Number(d.cantidad) : 1,
          tipoItemId: d?.tipoItemId || "",
          tipoDiaId: d?.tipoDiaId || "",
          alphaPct: d?.alpha == null ? 10 : Number(d.alpha),

          // ✅ NUEVO
          descuentoPct: Number.isFinite(descPctLine) ? descPctLine : 0,

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
          if (det.modo === "HH" && !det.tipoItemId) return { ...det, tipoItemId: tipoItemHH.id };
          return det;
        }),
      );
    }
  }, [tipoItemHH, open]);

  const updateDetalle = (idx, patch) => {
    setDetalles((prev) => {
      const next = [...prev];
      let merged = { ...next[idx], ...patch };

      const enabled = isTipoDiaEnabled(merged);
      if (!enabled && merged.tipoDiaId) merged.tipoDiaId = "";

      // ✅ normaliza descuento si viene en patch
      if ("descuentoPct" in patch) {
        merged.descuentoPct =
          patch.descuentoPct === "" ? "" : normalizeDescPctUI(patch.descuentoPct);
      }

      // =========================================================
      // 🚀 LÓGICA DE CAPPING (Límite por Cotización)
      // =========================================================
      if (selectedOrdenVenta && (patch.cantidad !== undefined || patch.costoUnitarioManual !== undefined)) {
        // 1. Calculamos cuánto presupuesto hay para ESTA línea.
        // El presupuesto total es selectedOrdenVenta.total.
        // El gasto de las OTRAS líneas es: totalVenta - currentLineVenta.
        
        const currentLineVenta = preview.lines[idx]?.ventaTotal || 0;
        const totalVentaActual = preview.total || 0;
        const budgetOthers = totalVentaActual - currentLineVenta;
        const maxVentaForThisLine = Math.max(0, (selectedOrdenVenta.total || 0) - budgetOthers);

        // 2. Convertimos MaxVenta a MaxCosto o MaxCantidad.
        // VentaLine = CostoUnit * Cantidad * Alpha * k * DescG
        // Usamos los factores actuales de la línea.
        
        const alphaPct = normalizeAlphaPctUI(merged.alphaPct);
        const alphaMult = 1 + alphaPct / 100;
        const descG = normalizeDescPctUI(descuentoPct);
        const descGMult = 1 - descG / 100;
        const descI = normalizeDescPctUI(merged.descuentoPct);
        const descIMult = 1 - descI / 100;
        const k = preview.k || 1;

        const factor = alphaMult * k * descIMult * descGMult;

        if (factor > 0) {
          if (patch.cantidad !== undefined) {
             let costoUnit = 0;
             if (merged.modo === "HH") {
               const hh = findHHForEmpleado(merged.empleadoId);
               costoUnit = (hh?.costoHH || 0);
               const cif = getHHCIFValue(hh);
               const targetU = (utilidadPctObjetivo === "" || utilidadPctObjetivo == null) ? 0 : Number(utilidadPctObjetivo) / 100;
               if (costoUnit > 0) {
                 const requestedCant = Number(patch.cantidad) || 0;
                  const marginMult = (1 - targetU);
                  const maxVentaNetoValue = maxVentaForThisLine / (descIMult * descGMult);
                  const maxCant = (maxVentaNetoValue - cif) * marginMult / (costoUnit * alphaMult);

    hhPeriodos,
    hhPeriodoKey,
    setHhPeriodoKey,
    loadingHHPeriodos,
    hhPeriodosErr,

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

    // helpers
    selectedOrdenVenta,
    isOverQuoteLimit,
    remainingBudget,
    adjustToQuote,
  };
}