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
    0,
  );
}

function distributeGlosas(glosas, subtotalNeto) {
  const t = round0(subtotalNeto);

  const manualSum = glosas.reduce(
    (acc, g) => acc + (g.manual ? round0(g.monto || 0) : 0),
    0,
  );

  if (manualSum > t) {
    return {
      glosas,
      error: `La suma manual (${formatCLP(manualSum)}) supera el subtotal (${formatCLP(t)}).`,
    };
  }

  const autosIdx = glosas
    .map((g, i) => (!g.manual ? i : -1))
    .filter((i) => i !== -1);

  if (autosIdx.length === 0) {
    if (manualSum !== t) {
      return {
        glosas,
        error: `Falta cuadrar el subtotal: manual ${formatCLP(manualSum)} vs subtotal ${formatCLP(t)}.`,
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
    g.manual ? { ...g, monto: round0(g.monto || 0) } : { ...g, monto: base },
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
  const [asunto, setAsunto] = useState("");
  const [terminos, setTerminos] = useState("");
  const [acuerdoPago, setAcuerdoPago] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(15);
  const [ventaIds, setVentaIds] = useState([]);

  const emptyGlosa = () => ({
    descripcion: "",
    monto: 0,
    manual: false,
    orden: 0,
  });
  const [glosas, setGlosas] = useState([emptyGlosa()]);
  const [glosaErr, setGlosaErr] = useState("");

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setErr("");
    setClienteId("");
    setAsunto("");
    setTerminos("");
    setAcuerdoPago("");
    setVigenciaDias(15);

    setVentaIds(preselectedVentaIds?.length ? preselectedVentaIds : []);
    setGlosas([emptyGlosa()]);
    setGlosaErr("");
  }, [open, preselectedVentaIds]);

  const ventasDisponibles = useMemo(
    () => (Array.isArray(ventas) ? ventas : []),
    [ventas],
  );

  const subtotalNeto = useMemo(() => {
    if (!ventasDisponibles.length || !ventaIds.length) return 0;
    const setIds = new Set(ventaIds.map(String));
    return round0(
      ventasDisponibles
        .filter((v) => setIds.has(String(v.id)))
        .reduce((acc, v) => acc + calcTotalVenta(v), 0),
    );
  }, [ventasDisponibles, ventaIds]);

  const iva = useMemo(
    () => round0(subtotalNeto * Number(ivaRate || 0)),
    [subtotalNeto, ivaRate],
  );
  const totalFinal = useMemo(
    () => round0(subtotalNeto + iva),
    [subtotalNeto, iva],
  );

  const sumGlosas = useMemo(
    () => glosas.reduce((acc, g) => acc + round0(g.monto || 0), 0),
    [glosas],
  );

  const okCuadra = !glosaErr && subtotalNeto > 0 && sumGlosas === subtotalNeto;

  useEffect(() => {
    if (!open) return;
    setGlosas((prev) => {
      const { glosas: dist, error } = distributeGlosas(prev, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  }, [subtotalNeto, open]);

  const setGlosa = (idx, patch) => {
    setGlosas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, orden: idx };

      if (patch.monto !== undefined) {
        const raw = patch.monto;
        const hasValue = String(raw ?? "").trim() !== "";
        next[idx].manual = hasValue;
        next[idx].monto = hasValue ? round0(raw) : 0;
      }

      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  };

  const addGlosa = () => {
    setGlosas((prev) => {
      const next = [...prev, emptyGlosa()].map((g, i) => ({ ...g, orden: i }));
      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
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
      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  };

  // cargar clientes
  useEffect(() => {
    if (!open) return;

    const { headers, token, empresaId } = buildAuthHeaders(
      session,
      empresaIdFromToken,
    );

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
              "Error al cargar clientes",
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

  const validateStep1 = () => {
    const { token, empresaId } = buildAuthHeaders(session, empresaIdFromToken);
    if (!session?.user) return "Sesión inválida";
    if (!token) return "Falta accessToken en sesión (Authorization).";
    if (!empresaId) return "Falta empresaId para header x-empresa-id.";
    if (!clienteId) return "Debes seleccionar un cliente.";
    if (!ventaIds.length) return "Debes seleccionar al menos 1 venta.";
    if (!subtotalNeto || subtotalNeto <= 0)
      return "El subtotal neto es 0. Revisa ventas seleccionadas.";

    const vd = normalizeVigenciaDias(vigenciaDias);
    if (!Number.isFinite(vd) || vd < 1 || vd > 365)
      return "Vigencia debe estar entre 1 y 365 días.";

    return "";
  };

  const validateStep3 = () => {
    for (let i = 0; i < glosas.length; i++) {
      if (!String(glosas[i].descripcion || "").trim())
        return `Glosa #${i + 1}: Falta descripción.`;
    }
    if (glosaErr) return glosaErr;
    if (sumGlosas !== subtotalNeto) {
      return `Las glosas suman ${formatCLP(sumGlosas)} y el subtotal es ${formatCLP(subtotalNeto)}.`;
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

      // validar todo
      const msg1 = validateStep1();
      if (msg1) throw new Error(msg1);

      const msg3 = validateStep3();
      if (msg3) throw new Error(msg3);

      const { headers } = buildAuthHeaders(session, empresaIdFromToken);

      const payload = {
        cliente_id: clienteId,
        asunto: asunto || null,
        vigencia_dias: normalizeVigenciaDias(vigenciaDias),
        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,
        ivaRate: Number(ivaRate || 0),
        ventaIds,
        glosas: glosas.map((g, i) => ({
          descripcion: String(g.descripcion || "").trim(),
          monto: round0(g.monto || 0),
          manual: !!g.manual,
          orden: i,
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
          data?.detalle ||
            data?.error ||
            data?.message ||
            "Error creando cotización",
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

      {/* Body */}
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

        {step === 1 ? (
          <StepClienteOferta
            clientes={clientes}
            clienteId={clienteId}
            setClienteId={setClienteId}
            asunto={asunto}
            setAsunto={setAsunto}
            vigenciaDias={vigenciaDias}
            setVigenciaDias={setVigenciaDias}
            ventasDisponibles={ventasDisponibles}
            ventaIds={ventaIds}
            setVentaIds={setVentaIds}
            preselectedVentaIds={preselectedVentaIds}
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
            subtotalNeto={subtotalNeto} // ✅ ESTA LÍNEA
          />
        ) : null}
      </Box>

      {/* Footer fijo */}
      <CotizacionFooterTotals
        step={step}
        onPrev={prev}
        onNext={next}
        onCreate={submit}
        saving={saving}
        subtotalNetoLabel={formatCLP(subtotalNeto)}
        ivaLabel={formatCLP(iva)}
        totalLabel={formatCLP(totalFinal)}
      />
    </Dialog>
  );
}
