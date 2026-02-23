"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Alert, Box, Dialog } from "@mui/material";

import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

import CotizacionStepperHeader from "./CotizacionStepperHeader";
import CotizacionFooterTotals from "./CotizacionFooterTotals";

import StepClienteOferta from "./StepClienteOferta";
import StepTerminos from "./StepTerminos";
import StepGlosasTotales from "./StepGlosasTotales";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const round0 = (n) => Math.round(Number(n || 0));

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
function distributeGlosasBrutas(glosas, subtotalBase) {
  const t = round0(subtotalBase);

  const manualSum = glosas.reduce(
    (acc, g) => acc + (g.manual ? round0(g.monto || 0) : 0),
    0
  );

  if (manualSum > t) {
    return {
      glosas,
      error: `La suma manual (${formatCLP(manualSum)}) supera el subtotal base (${formatCLP(
        t
      )}).`,
    };
  }

  const autosIdx = glosas
    .map((g, i) => (!g.manual ? i : -1))
    .filter((i) => i !== -1);

  if (autosIdx.length === 0) {
    if (manualSum !== t) {
      return {
        glosas,
        error: `Falta cuadrar el subtotal base: manual ${formatCLP(
          manualSum
        )} vs subtotal ${formatCLP(t)}.`,
      };
    }
    return {
      glosas: glosas.map((g) => ({ ...g, monto: round0(g.monto || 0) })),
      error: "",
    };
  }

  const rem = t - manualSum;
  const base = Math.floor(rem / autosIdx.length);
  const ajuste = rem - base * autosIdx.length;

  const next = glosas.map((g) =>
    g.manual ? { ...g, monto: round0(g.monto || 0) } : { ...g, monto: base }
  );

  const lastAuto = autosIdx[autosIdx.length - 1];
  next[lastAuto] = {
    ...next[lastAuto],
    monto: round0(next[lastAuto].monto + ajuste),
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

  // ✅ descuento general cotización
  const [descuentoPct, setDescuentoPct] = useState("");

  const emptyGlosa = () => ({
    descripcion: "",
    monto: 0, // BRUTO
    manual: false,
    orden: 0,
    descuento_pct: 0, // descuento por glosa
  });

  const [glosas, setGlosas] = useState([emptyGlosa()]);
  const [glosaErr, setGlosaErr] = useState("");

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

    setVentaIds(preselectedVentaIds?.length ? preselectedVentaIds : []);
    setDescuentoPct("");

    setGlosas([emptyGlosa()]);
    setGlosaErr("");
  }, [open, preselectedVentaIds]);

  const ventasDisponibles = useMemo(
    () => (Array.isArray(ventas) ? ventas : []),
    [ventas]
  );

  // ✅ subtotal BASE desde ventas (sin descuentos)
  const subtotalBase = useMemo(() => {
    if (!ventasDisponibles.length || !ventaIds.length) return 0;
    const setIds = new Set(ventaIds.map(String));
    return round0(
      ventasDisponibles
        .filter((v) => setIds.has(String(v.id)))
        .reduce((acc, v) => acc + calcTotalVenta(v), 0)
    );
  }, [ventasDisponibles, ventaIds]);

  // ✅ subtotal neto de glosas aplicando descuento por glosa
  const subtotalNetoGlosas = useMemo(() => {
    return round0(
      (glosas || []).reduce((acc, g) => {
        const bruto = round0(g.monto || 0);
        const d = clampPct(g.descuento_pct);
        const neto = round0(bruto * (1 - d / 100));
        return acc + neto;
      }, 0)
    );
  }, [glosas]);

  // ✅ aplicar descuento general al subtotal neto glosas
  const subtotalFinal = useMemo(() => {
    const dG = clampPct(descuentoPct);
    return round0(subtotalNetoGlosas * (1 - dG / 100));
  }, [subtotalNetoGlosas, descuentoPct]);

  const iva = useMemo(
    () => round0(subtotalFinal * Number(ivaRate || 0)),
    [subtotalFinal, ivaRate]
  );

  const totalFinal = useMemo(
    () => round0(subtotalFinal + iva),
    [subtotalFinal, iva]
  );

  // ✅ suma BRUTA glosas (debe cuadrar con subtotalBase)
  const sumGlosasBrutas = useMemo(
    () => round0(glosas.reduce((acc, g) => acc + round0(g.monto || 0), 0)),
    [glosas]
  );

  const okCuadra = !glosaErr && subtotalBase > 0 && sumGlosasBrutas === subtotalBase;

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
      const { glosas: dist, error } = distributeGlosasBrutas(prev, subtotalBase);
      setGlosaErr(error);
      return dist;
    });
  }, [subtotalBase, open]);

  const setGlosa = (idx, patch) => {
    setGlosas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, orden: idx };

      // monto bruto => marca manual
      if (patch.monto !== undefined) {
        const raw = patch.monto;
        const hasValue = String(raw ?? "").trim() !== "";
        next[idx].manual = hasValue;
        next[idx].monto = hasValue ? round0(raw) : 0;
      }

      // descuento por glosa
      if (patch.descuento_pct !== undefined) {
        next[idx].descuento_pct = clampPct(patch.descuento_pct);
      }

      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase);
      setGlosaErr(error);
      return dist;
    });
  };

  const addGlosa = () => {
    setGlosas((prev) => {
      const next = [...prev, emptyGlosa()].map((g, i) => ({ ...g, orden: i }));
      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase);
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
      const { glosas: dist, error } = distributeGlosasBrutas(next, subtotalBase);
      setGlosaErr(error);
      return dist;
    });
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
        urlCli.searchParams.set("pageSize", "100");

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
    if (sumGlosasBrutas !== subtotalBase) {
      return `Las glosas BRUTAS suman ${formatCLP(
        sumGlosasBrutas
      )} y el subtotal base es ${formatCLP(subtotalBase)}.`;
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

        asunto: asunto || null,
        vigencia_dias: normalizeVigenciaDias(vigenciaDias),
        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,
        ivaRate: Number(ivaRate || 0),

        // ✅ descuento general (backend espera descuento_pct)
        descuento_pct: descuentoPct === "" ? 0 : Number(descuentoPct),

        ventaIds,
        glosas: glosas.map((g, i) => ({
          descripcion: String(g.descripcion || "").trim(),
          monto: round0(g.monto || 0), // BRUTO
          manual: !!g.manual,
          orden: i,
          descuento_pct: clampPct(g.descuento_pct),
        })),
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
            ventasDisponibles={ventasDisponibles}
            ventaIds={ventaIds}
            setVentaIds={setVentaIds}
            preselectedVentaIds={preselectedVentaIds}
            // ✅ flags para bloquear/alertar
            hasGlosaDiscount={hasGlosaDiscount}
            conflict={conflict}
            conflictMsg={conflictMsg}
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
          />
        ) : null}
      </Box>

      <CotizacionFooterTotals
        step={step}
        onPrev={prev}
        onNext={next}
        onCreate={submit}
        saving={saving}
        subtotalNetoLabel={formatCLP(subtotalFinal)}
        ivaLabel={formatCLP(iva)}
        totalLabel={formatCLP(totalFinal)}
      />
    </Dialog>
  );
}