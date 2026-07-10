"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Alert, Box, Dialog } from "@mui/material";

import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP, formatMoney } from "@/components/ventas/utils/money";

import CotizacionStepperHeader from "./CotizacionStepperHeader";
import CotizacionFooterTotals from "./CotizacionFooterTotals";

import StepClienteOferta from "./StepClienteOferta";
import StepTerminos from "./StepTerminos";
import StepGlosasTotales from "./StepGlosasTotales";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const roundMoney = (n, moneda) => {
  const val = Number(n || 0);
  if (moneda === "CLP") return Math.round(val);
  if (moneda === "UF") return Number(val.toFixed(4));
  if (moneda === "USD") return Number(val.toFixed(2));
  return Math.round(val);
};

function calcTotalVenta(v) {
  return (v?.detalles || []).reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

const clampPct = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n >= 100) return 99.99;
  return n;
};

// Distribuye MONTOS BRUTOS para cuadrar con subtotalBase (ventas)
function distributeGlosasBrutas(glosas, subtotalBase, moneda) {
  const t = roundMoney(subtotalBase, moneda);

  const manualSum = glosas.reduce(
    (acc, g) => acc + (g.manual ? roundMoney(g.monto || 0, moneda) : 0),
    0
  );

  if (manualSum > t) {
    return {
      glosas,
      error: `La suma manual (${formatMoney(manualSum, moneda)}) supera el subtotal base (${formatMoney(
        t,
        moneda
      )}).`,
    };
  }

  const autosIdx = glosas
    .map((g, i) => (!g.manual ? i : -1))
    .filter((i) => i !== -1);

  if (autosIdx.length === 0) {
    if (Math.abs(manualSum - t) > 0.01) {
      return {
        glosas,
        error: `Falta cuadrar el subtotal base: manual ${formatMoney(
          manualSum,
          moneda
        )} vs subtotal ${formatMoney(t, moneda)}.`,
      };
    }
    return {
      glosas: glosas.map((g) => ({ ...g, monto: roundMoney(g.monto || 0, moneda) })),
      error: "",
    };
  }

  const rem = t - manualSum;
  const base = rem / autosIdx.length;
  const baseRounded = roundMoney(base, moneda);
  const totalAutoCalculated = baseRounded * autosIdx.length;
  const ajuste = rem - totalAutoCalculated;

  const next = glosas.map((g) =>
    g.manual ? { ...g, monto: roundMoney(g.monto || 0, moneda) } : { ...g, monto: baseRounded }
  );

  const lastAuto = autosIdx[autosIdx.length - 1];
  next[lastAuto] = {
    ...next[lastAuto],
    monto: roundMoney(next[lastAuto].monto + ajuste, moneda),
  };

  return { glosas: next, error: "" };
}

/** Headers robustos */
function buildAuthHeaders(session, empresaIdOverride) {
  const token = session?.user?.accessToken || session?.accessToken || "";
  const empresaId =
    empresaIdOverride ??
    session?.user?.empresaId ??
    session?.user?.empresa_id ??
    null;

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (empresaId) headers["x-empresa-id"] = String(empresaId);

  return { headers, token, empresaId };
}

function normalizeVigenciaDias(v) {
  if (v === undefined || v === null || v === "") return 15;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

export default function CotizacionFromVentasDialog({
  open,
  onClose,
  session: sessionProp,
  empresaIdFromToken,
  onCreated,
  ventas = [],
  preselectedVentaIds = [],
  ivaRate = 0.19,
}) {
  const { data: sessionHook } = useSession();
  const session = sessionProp?.user ? sessionProp : sessionHook;

  const [step, setStep] = useState(1);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");

  const [responsables, setResponsables] = useState([]);
  const [loadingResp, setLoadingResp] = useState(false);
  const [responsableId, setResponsableId] = useState("");

  const [asunto, setAsunto] = useState("");
  const [terminos, setTerminos] = useState("");
  const [acuerdoPago, setAcuerdoPago] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(15);

  const [ventaIds, setVentaIds] = useState([]);

  // Proyecto opcional
  const [proyectoId, setProyectoId] = useState("");
  const [proyectos, setProyectos] = useState([]);

  // ✅ descuento general cotización
  const [descuentoPct, setDescuentoPct] = useState("");

  const [sinIva, setSinIva] = useState(false);

  const emptyGlosa = () => ({
    descripcion: "",
    cantidad: 1,
    precio_unitario: "", // string vacio para UI
    monto: 0, // BRUTO = cantidad * precio_unitario
    manual: false,
    orden: 0,
    descuento_pct: 0, // descuento por glosa
    comentario: "",
  });

  const [glosas, setGlosas] = useState([emptyGlosa()]);
  const [glosaErr, setGlosaErr] = useState("");

  const [moneda, setMoneda] = useState("CLP");

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setErr("");
    setClienteId("");
    setResponsables([]);
    setResponsableId("");
    setAsunto("");
    setTerminos("");
    setAcuerdoPago("");
    setVigenciaDias(15);
    setSinIva(false);
    setMoneda("CLP");

    setVentaIds(preselectedVentaIds?.length ? preselectedVentaIds : []);
    setDescuentoPct("");
    setProyectoId("");

    setGlosas([emptyGlosa()]);
    setGlosaErr("");
  }, [open, preselectedVentaIds]);

  const ventasDisponibles = useMemo(
    () => (Array.isArray(ventas) ? ventas : []),
    [ventas]
  );

  // Auto-detect currency from first selected Venta
  useEffect(() => {
    if (!open) return;
    if (ventaIds.length > 0 && ventasDisponibles.length > 0) {
      const firstSelected = ventasDisponibles.find(v => String(v.id) === String(ventaIds[0]));
      if (firstSelected?.moneda) {
        setMoneda(firstSelected.moneda);
      }
    }
  }, [ventaIds, ventasDisponibles, open]);

  // ✅ subtotal BASE desde ventas (sin descuentos)
  const subtotalBase = useMemo(() => {
    if (!ventasDisponibles.length || !ventaIds.length) return 0;
    const setIds = new Set(ventaIds.map(String));
    return roundMoney(
      ventasDisponibles
        .filter((v) => setIds.has(String(v.id)))
        .reduce((acc, v) => acc + calcTotalVenta(v), 0),
      moneda
    );
  }, [ventasDisponibles, ventaIds, moneda]);

  // ✅ subtotal neto de glosas aplicando descuento por glosa
  const subtotalNetoGlosas = useMemo(() => {
    return roundMoney(
      (glosas || []).reduce((acc, g) => {
        const bruto = roundMoney(g.monto || 0, moneda);
        const d = clampPct(g.descuento_pct);
        const neto = bruto * (1 - d / 100);
        return acc + neto;
      }, 0),
      moneda
    );
  }, [glosas, moneda]);

  // ✅ aplicar descuento general al subtotal neto glosas
  const subtotalFinal = useMemo(() => {
    const dG = clampPct(descuentoPct);
    return roundMoney(subtotalNetoGlosas * (1 - dG / 100), moneda);
  }, [subtotalNetoGlosas, descuentoPct, moneda]);

  const iva = useMemo(
    () => sinIva ? 0 : roundMoney(subtotalFinal * Number(ivaRate || 0), moneda),
    [subtotalFinal, ivaRate, sinIva, moneda]
  );

  const totalFinal = useMemo(
    () => roundMoney(subtotalFinal + iva, moneda),
    [subtotalFinal, iva, moneda]
  );

  // ✅ suma BRUTA glosas (debe cuadrar con subtotalBase)
  const sumGlosasBrutas = useMemo(
    () => roundMoney(glosas.reduce((acc, g) => acc + roundMoney(g.monto || 0, moneda), 0), moneda),
    [glosas, moneda]
  );

  const okCuadra = !glosaErr && subtotalBase > 0 && Math.abs(sumGlosasBrutas - subtotalBase) <= 0.01;

  // =========================================================
  // ✅ REGLA: NO SE PUEDE DESCUENTO GENERAL + DESCUENTO GLOSA
  // =========================================================
  const hasGeneralDiscount = useMemo(() => {
    const n = Number(descuentoPct);
    return Number.isFinite(n) && n > 0;
  }, [descuentoPct]);

  const hasGlosaDiscount = useMemo(() => {
    return (glosas || []).some((g) => Number(g?.descuento_pct || 0) > 0);
  }, [glosas]);

  const conflict = hasGeneralDiscount && hasGlosaDiscount;

  const conflictMsg =
    "No puedes usar descuento general y descuento por glosa al mismo tiempo. " +
    "Deja solo uno (general o por glosas).";

  // Si hay descuento general, resetea descuentos por glosa
  useEffect(() => {
    if (!hasGeneralDiscount) return;
    setGlosas((prev) =>
      prev.map((g) => ({
        ...g,
        descuento_pct: 0,
      }))
    );
  }, [hasGeneralDiscount]);

  // Si hay descuento por glosa, resetea descuento general
  useEffect(() => {
    if (!hasGlosaDiscount) return;
    if (descuentoPct !== "" && Number(descuentoPct) > 0) {
      setDescuentoPct("");
    }
  }, [hasGlosaDiscount, descuentoPct]);

  // Auto-distribuir glosas BRUTAS para cuadrar con subtotalBase
  useEffect(() => {
    if (!open) return;
    setGlosas((prev) => {
      const { glosas: dist, error } = distributeGlosasBrutas(prev, subtotalBase, moneda);
      setGlosaErr(error);
      return dist;
    });
  }, [subtotalBase, open, moneda]);

  const setGlosa = (idx, patch) => {
    setGlosas((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], ...patch, orden: idx };

      // Si cambian cantidad
      if (patch.cantidad !== undefined) {
        const raw = patch.cantidad;
        if (String(raw).trim() === "") {
          updated.cantidad = "";
        } else {
          let c = parseInt(raw, 10);
          if (!Number.isFinite(c) || c < 1) c = 1;
          updated.cantidad = c;
        }
        if (updated.manual) {
          const actualC = Number(updated.cantidad) || 1;
          updated.monto = roundMoney(actualC * (Number(updated.precio_unitario) || 0), moneda);
        }
      }

      // Si cambian precio_unitario
      if (patch.precio_unitario !== undefined) {
        const raw = patch.precio_unitario;
        const hasValue = String(raw ?? "").trim() !== "";
        updated.manual = hasValue;
        updated.precio_unitario = hasValue ? roundMoney(raw, moneda) : "";
        if (hasValue) {
          const actualC = Number(updated.cantidad) || 1;
          updated.monto = roundMoney(actualC * updated.precio_unitario, moneda);
        } else {
          updated.monto = 0;
        }
      }

      // descuento por glosa
      if (patch.descuento_pct !== undefined) {
        updated.descuento_pct = clampPct(patch.descuento_pct);
      }

      next[idx] = updated;

      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase, moneda);
      setGlosaErr(error);
      return dist;
    });
  };

  const addGlosa = () => {
    setGlosas((prev) => {
      const next = [...prev, emptyGlosa()].map((g, i) => ({ ...g, orden: i }));
      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase, moneda);
      setGlosaErr(error);
      return dist;
    });
  };

  const removeGlosa = (idx) => {
    setGlosas((prev) => {
      const base = prev.filter((_, i) => i !== idx);
      const next = (base.length ? base : [emptyGlosa()]).map((g, i) => ({
        ...g,
        orden: i,
      }));
      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase, moneda);
      setGlosaErr(error);
      return dist;
    });
  };

  const handleImportFromCosteos = () => {
    if (!ventasDisponibles.length || !ventaIds.length) return;
    const setIds = new Set(ventaIds.map(String));
    const selectedVentas = ventasDisponibles.filter((v) => setIds.has(String(v.id)));
    
    const allDetalles = selectedVentas.flatMap((v) => v.detalles || []);
    if (allDetalles.length === 0) return;

    const importedGlosas = allDetalles.map((d, i) => {
      const cant = Number(d.cantidad) || 1;
      const totalItem = roundMoney(Number(d.total ?? d.ventaTotal) || 0, moneda);
      const pu = roundMoney(totalItem / cant, moneda);
      return {
        descripcion: d.descripcion || "",
        cantidad: cant,
        precio_unitario: pu,
        monto: totalItem,
        manual: true,
        orden: i,
        descuento_pct: 0,
      };
    });

    const sum = importedGlosas.reduce((acc, g) => acc + g.monto, 0);
    const diff = subtotalBase - sum;
    if (Math.abs(diff) > 0.01 && importedGlosas.length > 0) {
      const lastIdx = importedGlosas.length - 1;
      importedGlosas[lastIdx].monto = roundMoney(importedGlosas[lastIdx].monto + diff, moneda);
      const cant = importedGlosas[lastIdx].cantidad || 1;
      importedGlosas[lastIdx].precio_unitario = roundMoney(importedGlosas[lastIdx].monto / cant, moneda);
    }

    setGlosas(importedGlosas);
    const { error } = distributeGlosasBrutas(importedGlosas, subtotalBase, moneda);
    setGlosaErr(error);
  };

  // =========================
  // cargar clientes
  // =========================
  useEffect(() => {
    if (!open) return;

    const { headers, token, empresaId } = buildAuthHeaders(session, empresaIdFromToken);

    if (!session?.user) {
      setErr("No hay sesión (session.user) disponible.");
      return;
    }
    if (!token) {
      setErr("Falta accessToken en sesión (Authorization).");
      return;
    }
    if (!empresaId) {
      setErr("Falta empresaId para header x-empresa-id.");
      return;
    }

    (async () => {
      try {
        setErr("");
        const urlCli = new URL(`${API_URL}/clientes`);
        urlCli.searchParams.set("pageSize", "10000");

        const resCli = await fetch(urlCli, { headers, cache: "no-store" });
        const jsonCli = await safeJson(resCli);

        if (!resCli.ok) {
          throw new Error(
            jsonCli?.detalle ||
              jsonCli?.error ||
              jsonCli?.message ||
              "Error al cargar clientes"
          );
        }

        const cliList = Array.isArray(jsonCli?.data)
          ? jsonCli.data
          : Array.isArray(jsonCli?.items)
          ? jsonCli.items
          : Array.isArray(jsonCli)
          ? jsonCli
          : [];

        setClientes(cliList);
      } catch (e) {
        setErr(e?.message || "Error cargando clientes");
      }
    })();
  }, [open, session, empresaIdFromToken]);

  // =========================
  // cargar proyectos
  // =========================
  useEffect(() => {
    if (!open) return;
    const { headers } = buildAuthHeaders(session, empresaIdFromToken);
    fetch(`${API_URL}/proyectos`, { headers })
      .then(r => r.json())
      .then(data => setProyectos(Array.isArray(data) ? data : (data?.items || data?.data || [])))
      .catch(() => setProyectos([]));
  }, [open, session, empresaIdFromToken]);

  // =========================
  // cargar responsables
  // =========================
  useEffect(() => {
    if (!open) return;

    setResponsables([]);
    setResponsableId("");

    if (!clienteId) return;

    const { headers, token, empresaId } = buildAuthHeaders(session, empresaIdFromToken);
    if (!session?.user || !token || !empresaId) return;

    (async () => {
      try {
        setLoadingResp(true);
        setErr("");

        const res = await fetch(`${API_URL}/clientes/${clienteId}/responsables`, {
          headers,
          cache: "no-store",
        });

        const json = await safeJson(res);
        if (!res.ok) {
          throw new Error(
            json?.detalle || json?.error || json?.message || "Error al cargar responsables"
          );
        }

        const list = Array.isArray(json) ? json : [];
        setResponsables(list);

        const principal = list.find((r) => r.es_principal);
        setResponsableId(String(principal?.id || list?.[0]?.id || ""));
      } catch (e) {
        setErr(e?.message || "Error cargando responsables");
        setResponsables([]);
        setResponsableId("");
      } finally {
        setLoadingResp(false);
      }
    })();
  }, [clienteId, open, session, empresaIdFromToken]);

  const validateStep1 = () => {
    const { token, empresaId } = buildAuthHeaders(session, empresaIdFromToken);
    if (!session?.user) return "Sesión inválida";
    if (!token) return "Falta accessToken en sesión (Authorization).";
    if (!empresaId) return "Falta empresaId para header x-empresa-id.";
    if (!clienteId) return "Debes seleccionar un cliente.";
    // if (!responsableId) return "Debes seleccionar un responsable del cliente.";
    if (!ventaIds.length) return "Debes seleccionar al menos 1 venta.";
    if (!subtotalBase || subtotalBase <= 0)
      return "El subtotal base es 0. Revisa ventas seleccionadas.";

    const vd = normalizeVigenciaDias(vigenciaDias);
    if (!Number.isFinite(vd) || vd < 1 || vd > 365)
      return "Vigencia debe estar entre 1 y 365 días.";

    if (descuentoPct !== "") {
      const d = Number(descuentoPct);
      if (!Number.isFinite(d) || d < 0) return "Descuento inválido (>= 0).";
      if (d >= 100) return "Descuento inválido (< 100).";
    }

    return "";
  };

  const validateStep3 = () => {
    for (let i = 0; i < glosas.length; i++) {
      if (!String(glosas[i].descripcion || "").trim())
        return `Glosa #${i + 1}: Falta descripción.`;
      const d = clampPct(glosas[i].descuento_pct);
      if (d < 0 || d >= 100)
        return `Glosa #${i + 1}: Descuento % inválido (<100).`;
    }
    if (glosaErr) return glosaErr;
    if (Math.abs(sumGlosasBrutas - subtotalBase) > 0.01) {
      return `Las glosas BRUTAS suman ${formatMoney(
        sumGlosasBrutas,
        moneda
      )} y el subtotal base es ${formatMoney(subtotalBase, moneda)}.`;
    }
    return "";
  };

  const next = () => {
    setErr("");
    if (step === 1) {
      const msg = validateStep1();
      if (msg) return setErr(msg);
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const prev = () => {
    setErr("");
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    try {
      setSaving(true);
      setErr("");

      const msg1 = validateStep1();
      if (msg1) throw new Error(msg1);

      const msg3 = validateStep3();
      if (msg3) throw new Error(msg3);

      // ✅ por si acaso (aunque ya auto-resetea), bloquea submit si conflicto
      if (conflict) throw new Error(conflictMsg);

      const { headers } = buildAuthHeaders(session, empresaIdFromToken);

      const payload = {
        cliente_id: clienteId,
        cliente_responsable_id: responsableId || null,
        proyecto_id: proyectoId || null,

        asunto: asunto || null,
        vigencia_dias: normalizeVigenciaDias(vigenciaDias),
        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,
        ivaRate: Number(ivaRate || 0),

        // ✅ descuento general (backend espera descuento_pct)
        descuento_pct: descuentoPct === "" ? 0 : Number(descuentoPct),

        ventaIds,
        glosas: glosas.map((g, i) => {
          const c = Number(g.cantidad) || 1;
          return {
            descripcion: String(g.descripcion || "").trim(),
            cantidad: c,
            precio_unitario: g.manual ? Number(g.precio_unitario || 0) : roundMoney((g.monto || 0) / c, moneda),
            monto: roundMoney(g.monto || 0, moneda), // BRUTO
            manual: !!g.manual,
            orden: i,
            descuento_pct: clampPct(g.descuento_pct),
            comentario: g.comentario || null,
          };
        }),
        sin_iva: sinIva,
        moneda,
      };

      const res = await fetch(`${API_URL}/cotizaciones/add`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.detalle || data?.error || data?.message || "Error creando cotización"
        );
      }

      onClose?.();
      await onCreated?.();
    } catch (e) {
      setErr(e?.message || "Error creando cotización");
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
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,.10)",
          border: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <CotizacionStepperHeader step={step} onClose={onClose} />

      <Box
        sx={{
          px: { xs: 3, md: 5 },
          py: 3,
          maxHeight: "62vh",
          overflowY: "auto",
          bgcolor: "background.paper",
        }}
      >
        {err ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        ) : null}

        {/* ✅ Si quieres también mostrar alerta global acá */}
        {conflict ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {conflictMsg}
          </Alert>
        ) : null}

        {step === 1 ? (
          <StepClienteOferta
            clientes={clientes}
            clienteId={clienteId}
            setClienteId={setClienteId}
            responsables={responsables}
            loadingResp={loadingResp}
            responsableId={responsableId}
            setResponsableId={setResponsableId}
            asunto={asunto}
            setAsunto={setAsunto}
            vigenciaDias={vigenciaDias}
            setVigenciaDias={setVigenciaDias}
            descuentoPct={descuentoPct}
            setDescuentoPct={setDescuentoPct}
            proyectos={proyectos}
            proyectoId={proyectoId}
            setProyectoId={setProyectoId}
            ventasDisponibles={ventasDisponibles}
            ventaIds={ventaIds}
            setVentaIds={setVentaIds}
            preselectedVentaIds={preselectedVentaIds}
            hasGlosaDiscount={hasGlosaDiscount}
            conflict={conflict}
            conflictMsg={conflictMsg}
            sinIva={sinIva}
            setSinIva={setSinIva}
            moneda={moneda}
            setMoneda={setMoneda}
          />
        ) : null}

        {step === 2 ? (
          <StepTerminos
            terminos={terminos}
            setTerminos={setTerminos}
            acuerdoPago={acuerdoPago}
            setAcuerdoPago={setAcuerdoPago}
          />
        ) : null}

        {step === 3 ? (
          <StepGlosasTotales
            glosas={glosas}
            setGlosa={setGlosa}
            addGlosa={addGlosa}
            removeGlosa={removeGlosa}
            glosaErr={glosaErr}
            okCuadra={okCuadra}
            subtotalNeto={subtotalBase} // base BRUTO
            // ✅ flags para bloquear/alertar
            hasGeneralDiscount={hasGeneralDiscount}
            conflict={conflict}
            conflictMsg={conflictMsg}
            onImportFromCosteos={handleImportFromCosteos}
            moneda={moneda}
          />
        ) : null}
      </Box>

      <CotizacionFooterTotals
        step={step}
        onPrev={prev}
        onNext={next}
        onCreate={submit}
        saving={saving}
        subtotalNetoLabel={formatMoney(subtotalFinal, moneda)}
        ivaLabel={formatMoney(iva, moneda)}
        totalLabel={formatMoney(totalFinal, moneda)}
      />
    </Dialog>
  );
}