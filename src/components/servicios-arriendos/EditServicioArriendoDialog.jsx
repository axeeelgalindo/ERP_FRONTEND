"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";

import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const round0 = (n) => Math.round(Number(n || 0));

const emptyGlosa = () => ({
  descripcion: "",
  monto: 0,
  monto_uf: "",
  cantidad: 1,
  precio_unitario: 0,
  manual: true,
  orden: 0,
});

export default function EditServicioArriendoDialog({
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
  const [currentStep, setCurrentStep] = useState(1);

  // campos editables
  const [clienteId, setClienteId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(15);
  const [terminos, setTerminos] = useState("");
  const [acuerdoPago, setAcuerdoPago] = useState("");
  const [glosas, setGlosas] = useState([emptyGlosa()]);

  const [vendedorId, setVendedorId] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [proyectoId, setProyectoId] = useState("");
  const [proyectos, setProyectos] = useState([]);

  // campos para suscripciones
  const [moneda, setMoneda] = useState("UF"); // Por defecto UF para arriendos/servicios
  const [ciclosMensuales, setCiclosMensuales] = useState(12);
  const [valorUFManual, setValorUFManual] = useState("");
  const [valorUF, setValorUF] = useState(37700);
  const [ufFetchError, setUfFetchError] = useState(false);

  // configuración de IVA
  const [tipoIva, setTipoIva] = useState("afecto_mas_iva"); // afecto_mas_iva, afecto_iva_incluido, exento
  const [tasaIva, setTasaIva] = useState(19);

  const [glosasTouched, setGlosasTouched] = useState(false);

  // ========= cargar valor UF =========
  useEffect(() => {
    if (!open) return;
    setUfFetchError(false);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/uf`);
        if (res.ok) {
          const resData = await res.json();
          const val = resData?.data?.[0]?.valor;
          if (val) {
            setValorUF(Number(val));
            setUfFetchError(false);
          } else {
            setUfFetchError(true);
          }
        } else {
          setUfFetchError(true);
        }
      } catch (e) {
        console.error("Error fetching UF in client:", e);
        setUfFetchError(true);
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
        if (res.ok) {
          setUsuarios(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Error loading users:", e);
      }
    })();

    (async () => {
      try {
        const res = await fetch(`${API_URL}/proyectos`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });
        const data = await safeJson(res);
        if (res.ok) {
          setProyectos(Array.isArray(data) ? data : data?.data || []);
        }
      } catch (e) {
        console.error("Error loading projects:", e);
      }
    })();
  }, [open, session]);

  // ========= inicializar o cargar datos existentes =========
  useEffect(() => {
    if (!open) {
      setCot(null);
      setCurrentStep(1);
      return;
    }

    setErr("");
    setGlosasTouched(false);

    if (!cotizacionId) {
      // Modo creación
      setClienteId("");
      setResponsableId("");
      setAsunto("");
      setVigenciaDias(15);
      setTerminos("");
      setAcuerdoPago("");
      setVendedorId("");
      setFechaDocumento(new Date().toISOString().split("T")[0]);
      setDescuentoPct("");
      setProyectoId("");
      setMoneda("UF");
      setCiclosMensuales(12);
      setValorUFManual("");
      setTipoIva("afecto_mas_iva");
      setTasaIva(19);
      setGlosas([emptyGlosa()]);
      return;
    }

    // Modo edición
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/cotizaciones/${cotizacionId}`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Error al obtener cotización");

        setCot(data);
        setClienteId(data?.cliente_id ? String(data.cliente_id) : "");
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

        setMoneda(data?.moneda || "UF");
        setCiclosMensuales(Number(data?.ciclos_mensuales ?? 12));
        setValorUFManual(data?.valor_uf_documento ? String(data.valor_uf_documento) : "");

        // Inferir tipo e tasa de IVA desde los montos
        let inferredTipo = "afecto_mas_iva";
        let inferredTasa = 19;
        if (data?.iva === 0) {
          inferredTipo = "exento";
          inferredTasa = 0;
        } else if (data?.subtotal > 0) {
          inferredTasa = Math.round((data.iva / data.subtotal) * 100);
        }
        setTipoIva(inferredTipo);
        setTasaIva(inferredTasa);

        const gs = Array.isArray(data?.glosas) ? data.glosas : [];
        const mappedGlosas = gs.map((g) => ({
          descripcion: g.descripcion || "",
          monto: g.monto || 0,
          monto_uf: g.monto_uf !== null && g.monto_uf !== undefined ? Number(g.monto_uf) : "",
          manual: g.manual ?? true,
          cantidad: Number(g.cantidad || 1),
          precio_unitario: Number(g.precio_unitario || g.monto || 0),
        }));

        setGlosas(mappedGlosas.length ? mappedGlosas : [emptyGlosa()]);
      } catch (e) {
        setErr(e?.message || "Error cargando servicio/arriendo");
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
  }, [clienteId, open, responsables, responsableId]);

  // ========= Cálculo de IVA, Netos y Totales en tiempo de ejecución =========
  const rate = useMemo(() => {
    return tipoIva === "exento" ? 0 : Number(tasaIva || 19) / 100;
  }, [tipoIva, tasaIva]);

  const calculatedGlosas = useMemo(() => {
    return glosas.map((g) => {
      let netMontoUf = null;
      let grossMontoUf = null;
      let netPrecioUnitario = 0;
      let grossPrecioUnitario = 0;
      let netMonto = 0;
      let grossMonto = 0;

      const qty = Number(g.cantidad || 1);

      if (moneda === "UF") {
        const valUf = Number(g.monto_uf || 0);
        if (tipoIva === "afecto_iva_incluido") {
          grossMontoUf = valUf;
          netMontoUf = valUf / (1 + rate);
        } else if (tipoIva === "afecto_mas_iva") {
          netMontoUf = valUf;
          grossMontoUf = valUf * (1 + rate);
        } else {
          netMontoUf = valUf;
          grossMontoUf = valUf;
        }
        netPrecioUnitario = Math.round(netMontoUf * activeUF);
        grossPrecioUnitario = Math.round(grossMontoUf * activeUF);
        netMonto = netPrecioUnitario * qty;
        grossMonto = grossPrecioUnitario * qty;
      } else {
        const valClp = Number(g.precio_unitario || g.monto || 0);
        if (tipoIva === "afecto_iva_incluido") {
          grossPrecioUnitario = valClp;
          netPrecioUnitario = Math.round(valClp / (1 + rate));
        } else if (tipoIva === "afecto_mas_iva") {
          netPrecioUnitario = valClp;
          grossPrecioUnitario = Math.round(valClp * (1 + rate));
        } else {
          netPrecioUnitario = valClp;
          grossPrecioUnitario = valClp;
        }
        netMonto = netPrecioUnitario * qty;
        grossMonto = grossPrecioUnitario * qty;
      }

      return {
        ...g,
        netMontoUf,
        grossMontoUf,
        netPrecioUnitario,
        grossPrecioUnitario,
        netMonto,
        grossMonto,
      };
    });
  }, [glosas, moneda, tipoIva, tasaIva, activeUF, rate]);

  const subtotalNeto = useMemo(() => {
    return round0(
      calculatedGlosas.reduce((acc, g) => acc + round0(g.netMonto || 0), 0)
    );
  }, [calculatedGlosas]);

  const subtotalNetoUF = useMemo(() => {
    if (moneda !== "UF") return 0;
    return calculatedGlosas.reduce((acc, g) => acc + Number(g.netMontoUf || 0), 0);
  }, [calculatedGlosas, moneda]);

  const ivaMonto = useMemo(() => {
    return round0(subtotalNeto * rate);
  }, [subtotalNeto, rate]);

  const ivaUF = useMemo(() => {
    if (moneda !== "UF") return 0;
    return subtotalNetoUF * rate;
  }, [subtotalNetoUF, rate]);

  const totalMensual = useMemo(() => {
    return round0(subtotalNeto + ivaMonto);
  }, [subtotalNeto, ivaMonto]);

  const totalMensualUF = useMemo(() => {
    if (moneda !== "UF") return 0;
    return subtotalNetoUF * (1 + rate);
  }, [subtotalNetoUF, rate]);

  // ========= Validación glosas =========
  const glosasOk = useMemo(() => {
    const normalized = calculatedGlosas.filter((g) => String(g.descripcion).trim().length > 0);

    if (normalized.length === 0) return false;
    if (normalized.some((g) => g.netMonto < 0)) return false;

    if (moneda === "UF") {
      if (normalized.some((g) => !g.monto_uf || Number(g.monto_uf) <= 0)) return false;
    } else {
      if (normalized.some((g) => !g.precio_unitario || Number(g.precio_unitario) <= 0)) return false;
    }

    return true;
  }, [calculatedGlosas, moneda]);

  // ========= Cambio de Tipo de IVA con conversión =========
  const handleTipoIvaChange = (newTipo) => {
    const prevRate = tipoIva === "exento" ? 0 : Number(tasaIva) / 100;
    const nextRate = newTipo === "exento" ? 0 : Number(tasaIva) / 100;

    setTipoIva(newTipo);

    setGlosas((prev) =>
      prev.map((g) => {
        const next = { ...g };
        if (moneda === "UF") {
          const valUf = Number(g.monto_uf || 0);
          if (valUf > 0) {
            let originalNetUf = valUf;
            if (tipoIva === "afecto_iva_incluido") {
              originalNetUf = valUf / (1 + prevRate);
            }
            let newShowUf = originalNetUf;
            if (newTipo === "afecto_iva_incluido") {
              newShowUf = originalNetUf * (1 + nextRate);
            }
            next.monto_uf = Number(newShowUf.toFixed(2));
          }
        } else {
          const valClp = Number(g.precio_unitario || g.monto || 0);
          if (valClp > 0) {
            let originalNetClp = valClp;
            if (tipoIva === "afecto_iva_incluido") {
              originalNetClp = valClp / (1 + prevRate);
            }
            let newShowClp = originalNetClp;
            if (newTipo === "afecto_iva_incluido") {
              newShowClp = originalNetClp * (1 + nextRate);
            }
            next.precio_unitario = Math.round(newShowClp);
            next.monto = Math.round(newShowClp * next.cantidad);
          }
        }
        return next;
      })
    );
  };

  // ========= handlers glosas =========
  const setGlosa = (idx, patch) => {
    setGlosasTouched(true);
    setGlosas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, orden: idx };
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

      // glosas finales (enviadas como Netas al backend)
      let glosasFinal = calculatedGlosas
        .map((g) => ({
          descripcion: String(g?.descripcion || "").trim().slice(0, 250),
          monto: round0(g?.netMonto || 0),
          monto_uf: g?.netMontoUf !== null ? Number(g.netMontoUf) : null,
          cantidad: Number(g?.cantidad || 1),
          precio_unitario: Number(g?.netPrecioUnitario || 0),
          manual: true,
        }))
        .filter((g) => g.descripcion.length > 0);

      if (glosasFinal.length === 0) {
        throw new Error("Debes agregar al menos una glosa con descripción.");
      }

      const suma = glosasFinal.reduce((a, g) => a + g.monto, 0);
      if (suma <= 0) {
        throw new Error("Las glosas deben sumar un monto mayor a 0.");
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

        ventaIds: [], // Siempre vacío para suscripciones

        glosas: glosasFinal.map((g, i) => ({
          descripcion: g.descripcion,
          monto: g.monto,
          monto_uf: g.monto_uf,
          cantidad: g.cantidad,
          precio_unitario: g.precio_unitario,
          manual: true,
          orden: i,
        })),

        // Campos específicos de suscripción
        es_suscripcion: true, // Forzado a true siempre
        moneda: moneda,
        ciclos_mensuales: Number(ciclosMensuales || 12),
        valor_uf_manual: valorUFManual ? Number(valorUFManual) : null,
        ivaRate: tipoIva === "exento" ? 0 : Number(tasaIva || 19) / 100,
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
          data?.error || data?.detalle || "Error guardando servicio/arriendo"
        );
      }

      onClose?.();
      await onUpdated?.(data);
    } catch (e) {
      setErr(e?.message || "Error guardando servicio/arriendo");
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!clienteId || !asunto) {
        setErr("Por favor completa los campos obligatorios: Cliente y Asunto.");
        return;
      }
      setErr("");
    }
    setCurrentStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevStep = () => {
    setErr("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: "12px", 
          overflow: "hidden", 
          maxWidth: "1024px",
          margin: 2
        },
      }}
    >
      <div className="bg-[#f8fafc] w-full flex flex-col max-h-[90vh] overflow-hidden font-sans">
        {/* Header */}
        <header className="px-8 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-6">
            <img 
              alt="Logo Blue Ingeniería" 
              className="h-10 object-contain" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUDYVzrT2ZdASyjdxzPY6wOiLbC2UF2Of3UTCnVGIRHRiMHnwvq3bK8UXbMcuS0-7cqO2Dy9KDJV2JqLlP8EzJakN9CKOWBKJUbnDT3IdRajpd1GQ4icYIDnAHewBU9M8nV14D6O_UUV_jlF5fjZBP0BlKj0JBSWqhs4_8dvDB-9Cmn6964ZGpm3NNUKcECpK6f17F9-PwUu2Fq2PsJ0KG-XhGPdfTz2SBgiGOZ5ZHKZ44CLhateSAmzmaR1l6VYkwKg"
            />
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
            <div>
              <h1 className="font-bold text-lg text-[#00274e]">
                {cotizacionId ? "Editar Servicio / Arriendo" : "Nuevo Servicio / Arriendo"}
              </h1>
              <p className="text-sm text-slate-500">
                {cotizacionId ? `Documento ID: ${cotizacionId}` : "Gestión Técnica de Precisión"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={saving} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Step Indicators Bar */}
        <div className="px-8 py-6 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between max-w-2xl mx-auto relative">
            {/* Step 1 */}
            <div 
              onClick={() => {
                if (clienteId && asunto) setCurrentStep(1);
              }}
              className="flex flex-col items-center gap-2 z-10 cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                currentStep === 1 
                  ? "bg-[#00274e] text-white border-[#00274e] shadow-[0_0_0_4px_rgba(0,39,78,0.1)]" 
                  : currentStep > 1 
                  ? "bg-[#00658b] text-white border-[#00658b]" 
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {currentStep > 1 ? "✓" : "1"}
              </div>
              <span className={`font-bold text-xs uppercase tracking-wider text-[10px] ${currentStep === 1 ? "text-[#00274e]" : "text-slate-400"}`}>
                Cliente
              </span>
            </div>

            <div className="flex-1 relative flex items-center h-10">
              <div className={`h-0.5 w-full mx-4 transition-colors duration-300 ${currentStep > 1 ? "bg-[#00658b]" : "bg-slate-200"}`}></div>
            </div>

            {/* Step 2 */}
            <div 
              onClick={() => {
                if (clienteId && asunto) setCurrentStep(2);
              }}
              className="flex flex-col items-center gap-2 z-10 cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                currentStep === 2 
                  ? "bg-[#00274e] text-white border-[#00274e] shadow-[0_0_0_4px_rgba(0,39,78,0.1)]" 
                  : currentStep > 2 
                  ? "bg-[#00658b] text-white border-[#00658b]" 
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {currentStep > 2 ? "✓" : "2"}
              </div>
              <span className={`font-bold text-xs uppercase tracking-wider text-[10px] ${currentStep === 2 ? "text-[#00274e]" : "text-slate-400"}`}>
                Condiciones
              </span>
            </div>

            <div className="flex-1 relative flex items-center h-10">
              <div className={`h-0.5 w-full mx-4 transition-colors duration-300 ${currentStep > 2 ? "bg-[#00658b]" : "bg-slate-200"}`}></div>
            </div>

            {/* Step 3 */}
            <div 
              onClick={() => {
                if (clienteId && asunto) setCurrentStep(3);
              }}
              className="flex flex-col items-center gap-2 z-10 cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                currentStep === 3 
                  ? "bg-[#00274e] text-white border-[#00274e] shadow-[0_0_0_4px_rgba(0,39,78,0.1)]" 
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                3
              </div>
              <span className={`font-bold text-xs uppercase tracking-wider text-[10px] ${currentStep === 3 ? "text-[#00274e]" : "text-slate-400"}`}>
                Tarifas
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] flex flex-col">
          {err && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{err}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 my-auto">
              <div className="w-10 h-10 border-4 border-[#00658b] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-slate-500">Cargando datos...</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* STEP 1: Cliente y Proyecto */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] my-auto">
                  <section className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg border border-slate-200 border-l-4 border-l-[#00274e] shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#00274e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <h2 className="font-bold text-xs uppercase tracking-widest text-[#00658b]">
                        Identificación del Cliente
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Cliente *</label>
                        <select 
                          value={clienteId}
                          onChange={(e) => setClienteId(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] focus:border-[#00658b] outline-none transition-all"
                          required
                        >
                          <option value="">Seleccionar Cliente</option>
                          {(clientes || []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre || c.razonSocial || c.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Vendedor Asignado</label>
                        <select 
                          value={vendedorId}
                          onChange={(e) => setVendedorId(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] focus:border-[#00658b] outline-none transition-all"
                        >
                          <option value="">Mantener Original</option>
                          {(usuarios || []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Asociar a Proyecto (Opcional)</label>
                        <select 
                          value={proyectoId}
                          onChange={(e) => setProyectoId(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] focus:border-[#00658b] outline-none transition-all"
                        >
                          <option value="">Opcional: vincula este contrato a un proyecto existente</option>
                          {(proyectos || []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre || p.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Responsable</label>
                        <select 
                          value={responsableId}
                          onChange={(e) => setResponsableId(e.target.value)}
                          disabled={!clienteId}
                          className={`w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] focus:border-[#00658b] outline-none transition-all ${
                            !clienteId ? "opacity-60 cursor-not-allowed text-slate-400" : ""
                          }`}
                        >
                          <option value="">
                            {!clienteId
                              ? "Selecciona un cliente primero"
                              : responsables.length
                              ? "Seleccionar responsable..."
                              : "Sin responsables"}
                          </option>
                          {responsables.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre} {r.cargo ? `— ${r.cargo}` : ""} {r.correo ? `(${r.correo})` : ""} {r.es_principal ? " ⭐" : ""}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-[#003e70] italic px-1">
                          Nota: Requiere selección de cliente activo
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Asunto / Glosa General *</label>
                        <input 
                          type="text"
                          placeholder="Ej: Mantención Preventiva Edificio Central"
                          value={asunto}
                          onChange={(e) => setAsunto(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] focus:border-[#00658b] outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* STEP 2: Condiciones */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] my-auto">
                  <section className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg border border-slate-200 border-l-4 border-l-[#00658b] shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#00658b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2 className="font-bold text-xs uppercase tracking-widest text-[#00658b]">
                        Condiciones Comerciales
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Vigencia (días)</label>
                        <input 
                          type="number"
                          value={vigenciaDias}
                          onChange={(e) => setVigenciaDias(e.target.value)}
                          min="1"
                          max="365"
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Fecha Contrato</label>
                        <input 
                          type="date"
                          value={fechaDocumento}
                          onChange={(e) => setFechaDocumento(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Descuento (%)</label>
                        <input 
                          type="number"
                          placeholder="0"
                          value={descuentoPct}
                          onChange={(e) => setDescuentoPct(e.target.value)}
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        />
                      </div>
                    </div>

                    {/* Recessed Data Block */}
                    <div className="bg-[#f1f4f6] p-5 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Moneda Base</label>
                        <select 
                          value={moneda}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMoneda(val);
                            if (val === "CLP") {
                              setGlosas((prev) => prev.map((g) => ({ ...g, monto_uf: "" })));
                            } else {
                              setGlosas((prev) => prev.map((g) => ({ ...g, monto_uf: g.monto ? (g.monto / activeUF).toFixed(2) : "" })));
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        >
                          <option value="UF">UF (Unidad de Fomento)</option>
                          <option value="CLP">CLP (Peso Chileno)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Duración (Meses)</label>
                        <input 
                          type="number"
                          value={ciclosMensuales}
                          onChange={(e) => setCiclosMensuales(Number(e.target.value))}
                          min="1"
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        />
                        <p className="text-[11px] text-slate-500 px-1 italic">Cantidad de meses a facturar</p>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">
                          {ufFetchError ? "Valor UF (Ingresar Manual)" : `Valor UF (Hoy: ${formatCLP(valorUF)})`}
                        </label>
                        <input 
                          type="number"
                          placeholder={ufFetchError ? "Ingrese valor UF" : `Ref: ${valorUF}`}
                          value={valorUFManual}
                          onChange={(e) => setValorUFManual(e.target.value)}
                          className={`w-full bg-white border rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 outline-none transition-all ${
                            ufFetchError 
                              ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                              : "border-slate-200 focus:ring-[#00658b] focus:border-[#00658b]"
                          }`}
                        />
                        <p className={`text-[11px] px-1 italic ${ufFetchError ? "text-red-600 font-medium" : "text-slate-500"}`}>
                          {ufFetchError 
                            ? "No se pudo obtener la UF automáticamente. Ingrese el valor manual." 
                            : "Dejar vacío para usar UF oficial del día"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Tipo de IVA</label>
                        <select 
                          value={tipoIva}
                          onChange={(e) => handleTipoIvaChange(e.target.value)}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none"
                        >
                          <option value="afecto_mas_iva">Afecto (+ IVA)</option>
                          <option value="afecto_iva_incluido">Afecto (IVA Incluido)</option>
                          <option value="exento">Exento (Sin IVA)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Tasa de IVA (%)</label>
                        <input 
                          type="number"
                          value={tasaIva}
                          onChange={(e) => setTasaIva(Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          disabled={tipoIva === "exento"}
                          className="w-full bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* STEP 3: Tarifas y Legales */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] my-auto">
                  <section className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg border border-slate-200 border-l-4 border-l-[#003e70] shadow-sm space-y-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#003e70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <h2 className="font-bold text-xs uppercase tracking-widest text-[#00658b]">
                          Detalle de Tarifas (Glosas)
                        </h2>
                      </div>
                      <button 
                        type="button"
                        onClick={addGlosa}
                        className="flex items-center gap-2 text-[#00658b] hover:text-[#00274e] transition-colors font-bold text-xs uppercase tracking-wider"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        AGREGAR TARIFA
                      </button>
                    </div>

                    {/* Spec Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#ebeef0] text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="p-3 border-b border-slate-200 w-1/2">Descripción Servicio *</th>
                            <th className="p-3 border-b border-slate-200 text-center w-20">Cant.</th>
                            <th className="p-3 border-b border-slate-200 text-right w-32">
                              {moneda === "UF"
                                ? tipoIva === "afecto_iva_incluido"
                                  ? "Tarifa UF (IVA Incl.)"
                                  : tipoIva === "afecto_mas_iva"
                                  ? "Tarifa UF (Neto)"
                                  : "Tarifa UF"
                                : tipoIva === "afecto_iva_incluido"
                                ? "Tarifa CLP (IVA Incl.)"
                                : tipoIva === "afecto_mas_iva"
                                ? "Tarifa CLP (Neto)"
                                : "Tarifa CLP"}
                            </th>
                            <th className="p-3 border-b border-slate-200 text-right w-40">
                              {tipoIva === "exento" ? "Total CLP" : "Total CLP (IVA Incl.)"}
                            </th>
                            <th className="p-3 border-b border-slate-200 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {glosas.map((g, idx) => {
                            const cg = calculatedGlosas[idx] || {};
                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3">
                                  <input 
                                    type="text"
                                    placeholder={`Descripción Servicio #${idx + 1}`}
                                    value={g.descripcion}
                                    onChange={(e) => setGlosa(idx, { descripcion: e.target.value })}
                                    className="w-full bg-transparent border-b border-transparent focus:border-[#00658b] focus:ring-0 text-sm text-slate-900 p-1 outline-none"
                                    required
                                  />
                                </td>
                                <td className="p-3">
                                  <input 
                                    type="number"
                                    value={g.cantidad ?? 1}
                                    onChange={(e) => setGlosa(idx, { cantidad: Math.max(1, Number(e.target.value)) })}
                                    min="1"
                                    className="w-full bg-[#f1f4f6] border border-slate-200 rounded px-2 py-1 font-mono text-sm text-center"
                                  />
                                </td>
                                <td className="p-3">
                                  {moneda === "UF" ? (
                                    <input 
                                      type="number"
                                      placeholder="0.00"
                                      value={g.monto_uf ?? ""}
                                      onChange={(e) => setGlosa(idx, { monto_uf: e.target.value })}
                                      step="0.01"
                                      min="0"
                                      className="w-full bg-[#f1f4f6] border border-slate-200 rounded px-2 py-1 font-mono text-sm text-right"
                                    />
                                  ) : (
                                    <input 
                                      type="number"
                                      placeholder="0"
                                      value={g.precio_unitario ?? g.monto}
                                      onChange={(e) => setGlosa(idx, { precio_unitario: e.target.value })}
                                      className="w-full bg-[#f1f4f6] border border-slate-200 rounded px-2 py-1 font-mono text-sm text-right"
                                    />
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <span className="font-mono text-sm text-slate-500">
                                    {formatCLP(cg.grossMonto || 0)}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => removeGlosa(idx)}
                                    disabled={glosas.length === 1}
                                    className="text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                                  >
                                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      <svg className={`w-4 h-4 ${glosasOk ? "text-green-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className={`text-xs font-semibold italic ${glosasOk ? "text-green-600" : "text-red-600"}`}>
                        {moneda === "UF" ? (
                          <>
                            {glosasOk
                              ? `✅ Tarifa Mensual: ${Number(subtotalNetoUF).toFixed(2)} UF (+ IVA: ${Number(ivaUF).toFixed(2)} UF) = ${Number(totalMensualUF).toFixed(2)} UF (~${formatCLP(totalMensual)} CLP total con IVA) mensual por ${ciclosMensuales} meses.`
                              : "Revisa que las tarifas en UF sean mayores a 0."}
                          </>
                        ) : (
                          <>
                            {glosasOk
                              ? `✅ Tarifa Mensual: ${formatCLP(subtotalNeto)} CLP (+ IVA: ${formatCLP(ivaMonto)}) = ${formatCLP(totalMensual)} CLP total mensual por ${ciclosMensuales} meses.`
                              : "Revisa que el monto total mensual sea mayor a 0."}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Términos y condiciones</label>
                        <textarea 
                          value={terminos}
                          onChange={(e) => setTerminos(e.target.value)}
                          placeholder="Ingrese los términos legales del contrato..."
                          className="w-full min-h-[120px] bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="font-bold text-xs uppercase tracking-wider text-slate-500">Acuerdo de pago</label>
                        <textarea 
                          value={acuerdoPago}
                          onChange={(e) => setAcuerdoPago(e.target.value)}
                          placeholder="Ej: Pago a 30 días contra recepción de factura..."
                          className="w-full min-h-[120px] bg-[#f1f4f6] border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#00658b] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer Actions */}
        <footer className="px-8 py-5 bg-[#f1f4f6] border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10">
          <div>
            <button 
              type="button"
              onClick={onClose} 
              disabled={saving}
              className="px-6 py-2.5 font-bold text-xs uppercase tracking-wider text-[#00658b] hover:bg-slate-200 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              CANCELAR
            </button>
          </div>

          <div className="flex gap-4">
            {currentStep > 1 && (
              <button 
                type="button"
                onClick={handlePrevStep}
                disabled={saving}
                className="px-6 py-2.5 font-bold text-xs uppercase tracking-wider text-[#00658b] border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                ATRÁS
              </button>
            )}

            {currentStep < 3 ? (
              <button 
                type="button"
                onClick={handleNextStep}
                className="px-8 py-2.5 font-bold text-xs uppercase tracking-wider bg-[#00274e] text-white rounded-lg shadow-md hover:bg-[#001c3a] transition-all flex items-center gap-2 group active:scale-95"
              >
                SIGUIENTE
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <button 
                type="button"
                onClick={submit}
                disabled={saving || loading || !glosasOk || !clienteId || !asunto}
                className="px-8 py-2.5 font-bold text-xs uppercase tracking-wider bg-[#00274e] text-white rounded-lg shadow-md hover:bg-[#001c3a] transition-all flex items-center gap-2 group active:scale-95 disabled:opacity-40"
              >
                {saving ? (
                  <>
                    GUARDANDO...
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </>
                ) : (
                  <>
                    {cotizacionId ? "GUARDAR CAMBIOS" : "CREAR SERVICIO / ARRIENDO"}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </Dialog>
  );
}
