"use client";

import { useMemo, useState, useEffect } from "react";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import CotizacionPDFButton from "@/components/cotizaciones/CotizacionPDFButton";
import NuevoPagoDialog from "@/components/cotizaciones/NuevoPagoDialog";
import { fechaCL, formatCLP, nextEstados } from "@/components/cotizaciones/utils/utils";
import { useSession } from "next-auth/react";

function Badge({ children }) {
  const e = String(children || "").toUpperCase();
  let label = e.replaceAll("_", " ");
  let cls = "bg-blue-100 text-blue-700";

  if (e === "COTIZACION") {
    label = "Borrador de Servicio";
    cls = "bg-amber-100 text-amber-700";
  } else if (e === "ACEPTADA") {
    label = "Proyecto Andando";
    cls = "bg-emerald-100 text-emerald-700 font-extrabold";
  } else if (e === "RECHAZADA") {
    label = "Servicio Cancelado";
    cls = "bg-rose-100 text-rose-700";
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${cls}`}>
      {label}
    </span>
  );
}

const round0 = (n) => Math.round(Number(n || 0));
const clampPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99.99, n));
};

const MESES = [
  { val: 1, label: "Enero" },
  { val: 2, label: "Febrero" },
  { val: 3, label: "Marzo" },
  { val: 4, label: "Abril" },
  { val: 5, label: "Mayo" },
  { val: 6, label: "Junio" },
  { val: 7, label: "Julio" },
  { val: 8, label: "Agosto" },
  { val: 9, label: "Septiembre" },
  { val: 10, label: "Octubre" },
  { val: 11, label: "Noviembre" },
  { val: 12, label: "Diciembre" },
];

const currentY = new Date().getFullYear();
const YEARS = [currentY - 1, currentY, currentY + 1];

export default function ServicioArriendoDrawer({
  open,
  servicio,
  allCotizaciones = [],
  onClose,
  onEdit,
  onUpdateEstado,
  onDelete,
  showSnack,
  onRefresh,
}) {
  const { data: session } = useSession();
  const c = servicio;

  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [facPrompt, setFacPrompt] = useState(null); // { file, docType }
  const [facPorcentaje, setFacPorcentaje] = useState(100);
  const [viewUrl, setViewUrl] = useState(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Proyecto asociado
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState("");
  const [savingProyecto, setSavingProyecto] = useState(false);

  // Generador de cotización mensual
  const [valorUF, setValorUF] = useState(37700);
  const [openGenerarModal, setOpenGenerarModal] = useState(false);
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [customAsunto, setCustomAsunto] = useState("");
  const [selectedPlanYear, setSelectedPlanYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (open && c) {
      const startStr = c?.fecha_inicio_plan || c?.proyecto?.fecha_inicio_plan;
      if (startStr) {
        try {
          const yr = new Date(startStr.slice(0, 10) + "T12:00:00").getFullYear();
          if (yr && !isNaN(yr)) {
            setSelectedPlanYear(yr);
            return;
          }
        } catch {}
      }
      setSelectedPlanYear(new Date().getFullYear());
    }
  }, [open, c]);

  // Cargar valor UF oficial del día desde nuestro backend
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const token = session?.user?.accessToken || session?.accessToken || "";
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_URL}/cotizaciones/uf-actual`, { headers });
        if (res.ok) {
          const data = await res.json();
          const val = data?.valor;
          if (val) setValorUF(Number(val));
        }
      } catch (e) {
        console.error("Error fetching UF from backend:", e);
      }
    })();
  }, [open, session, API_URL]);

  // Actualizar asunto sugerido
  useEffect(() => {
    if (!c || !openGenerarModal) return;
    const monthLabel = MESES.find((m) => m.val === genMonth)?.label.toUpperCase();
    const defaultAsunto = c.asunto
      ? `${c.asunto} - ${monthLabel} ${genYear}`
      : `Cobro Mensual - ${monthLabel} ${genYear}`;
    setCustomAsunto(defaultAsunto);
  }, [c, genMonth, genYear, openGenerarModal]);

  const handleGenerateMonthlyQuote = async () => {
    if (!c?.id) return;
    setGenerating(true);
    setGenErr("");
    try {
      const monthLabel = MESES.find((m) => m.val === genMonth)?.label.toUpperCase();
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const payload = {
        proyecto_id: c.proyecto_id || null,
        parent_id: c.id,
        cliente_id: c.cliente_id || c.cliente?.id,
        cliente_responsable_id: c.cliente_responsable_id || null,
        vendedor_id: session?.user?.id || c.vendedor_id || null,
        fecha_documento: new Date().toISOString().split("T")[0],
        descuento_pct: c.descuento_pct || 0,
        asunto: customAsunto,
        vigencia_dias: c.vigencia_dias || 15,
        terminos_condiciones: c.terminos_condiciones || null,
        acuerdo_pago: c.acuerdo_pago || null,
        ventaIds: [], // Standard quote with direct glosas!
        glosas: (c.glosas || []).map((g, i) => {
          const isUF = c.moneda === "UF";
          const precio = isUF ? Number(g.monto_uf || 0) : Number(g.precio_unitario || g.monto || 0);
          const totalGlosa = precio * Number(g.cantidad || 1);
          return {
            descripcion: g.descripcion,
            monto: totalGlosa,
            monto_uf: isUF ? Number(g.monto_uf || 0) : null,
            cantidad: g.cantidad,
            precio_unitario: precio,
            manual: true,
            orden: i,
          };
        }),
        es_suscripcion: false, // Force standard sales quote
        moneda: c.moneda || "CLP",
        ciclos_mensuales: 1, // Billed for 1 month
        valor_uf_manual: valorUF, // Use today's fetched UF
        ivaRate: c.iva && c.subtotal ? c.iva / c.subtotal : 0.19,
      };

      const res = await fetch(`${API_URL}/cotizaciones/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.detalle || "Error al generar cotización mensual");
      }

      showSnack?.("success", `Cotización de cobro #${data.numero} generada con éxito para ${monthLabel} ${genYear}`);
      setOpenGenerarModal(false);
      onRefresh?.();
    } catch (err) {
      setGenErr(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Cargar proyectos y sincronizar con el servicio actual
  useEffect(() => {
    if (!open || !session) return;
    setSelectedProyectoId(c?.proyecto_id || "");
    const token = session?.user?.accessToken || session?.accessToken || "";
    const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
    };
    fetch(`${API_URL}/proyectos`, { headers })
      .then(r => r.json())
      .then(data => setProyectos(Array.isArray(data) ? data : (data?.items || data?.data || [])))
      .catch(() => setProyectos([]));
  }, [open, c?.id, c?.proyecto_id, session]);

  const handleSaveProyecto = async (nuevoId) => {
    if (!c?.id) return;
    setSavingProyecto(true);
    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
      const res = await fetch(`${API_URL}/cotizaciones/update/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        },
        body: JSON.stringify({
          proyecto_id: nuevoId || null,
          cliente_id: c.cliente_id || c.cliente?.id,
          es_suscripcion: true,
          moneda: c.moneda,
          ciclos_mensuales: c.ciclos_mensuales,
          valor_uf_manual: c.valor_uf_documento,
          glosas: (c.glosas || []).map(g => ({
            descripcion: g.descripcion,
            monto: g.monto,
            monto_uf: g.monto_uf,
            cantidad: g.cantidad,
            precio_unitario: g.precio_unitario,
            manual: g.manual ?? true,
            orden: g.orden ?? 0,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Error al actualizar proyecto");
      }
      showSnack?.("success", nuevoId ? "Proyecto vinculado" : "Proyecto desvinculado");
      onRefresh?.();
    } catch (err) {
      showSnack?.("error", err.message);
    } finally {
      setSavingProyecto(false);
    }
  };

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const cleanUrl = url.startsWith("/api") ? url.slice(4) : url;
    const base = API_URL?.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
    const path = cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`;
    return `${base}${path}`;
  };

  const handleDocUpload = async (e, docType, metadata = {}) => {
    const file = e?.target?.files?.[0] || metadata.file;
    if (!file || !c?.id) return;

    if (docType === "fac" && metadata.porcentaje === undefined) {
      setFacPrompt({ file, docType });
      setFacPorcentaje(100);
      if (e?.target) e.target.value = "";
      return;
    }

    try {
      setUploadingDoc(docType);
      const fd = new FormData();
      fd.append("file", file);
      if (metadata.porcentaje !== undefined) {
        fd.append("porcentaje", metadata.porcentaje);
      }

      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const res = await fetch(`${API_URL}/cotizaciones/${c.id}/upload/${docType}`, {
        method: "POST",
        headers,
        body: fd
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al subir documento");
      }

      showSnack("success", "Documento subido correctamente");
      onRefresh?.();
    } catch (err) {
      showSnack("error", err.message);
    } finally {
      setUploadingDoc(null);
      setFacPrompt(null);
      if (e?.target) e.target.value = "";
    }
  };

  const handleDeleteAdjunto = async (adjuntoId) => {
    if (!confirm("¿Estás seguro de eliminar este documento?")) return;
    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const res = await fetch(`${API_URL}/cotizaciones/adjuntos/${adjuntoId}`, {
        method: "DELETE",
        headers
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al eliminar adjunto");
      }

      showSnack("success", "Adjunto eliminado");
      onRefresh?.();
    } catch (err) {
      showSnack("error", err.message);
    }
  };

  const [uploadingPagoId, setUploadingPagoId] = useState(null);

  const handlePagoUpload = async (e, pagoId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPagoId(pagoId);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const res = await fetch(`${API_URL}/cotizaciones/pagos/${pagoId}/upload/comprobante`, {
        method: "POST",
        headers,
        body: fd
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al subir comprobante");
      }

      showSnack("success", "Comprobante subido");
      onRefresh?.();
    } catch (err) {
      showSnack("error", err.message);
    } finally {
      setUploadingPagoId(null);
      if (e.target) e.target.value = "";
    }
  };

  const DocButton = ({ docType, label, url, multiple = false, adjuntos = [] }) => {
    const isUploading = uploadingDoc === docType;
    const items = multiple ? adjuntos.filter(a => a.tipo === docType) : (url ? [{ url, id: 'main', nombre: label }] : []);

    return (
      <div className="p-3 border border-slate-200 rounded-xl bg-white shadow-sm space-y-2">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
          <label className={`relative flex items-center gap-1 text-[10px] font-bold cursor-pointer px-2 py-1 rounded-md transition-colors ${isUploading ? "text-slate-400" : "text-blue-600 bg-blue-50 hover:bg-blue-100"}`}>
            {isUploading ? <CircularProgress size={12} color="inherit" /> : <FileUploadOutlinedIcon sx={{ fontSize: 14 }} />}
            {isUploading ? "Subiendo" : multiple ? "Agregar" : "Subir"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleDocUpload(e, docType)}
              disabled={isUploading}
            />
          </label>
        </div>

        <div className="space-y-1">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50 rounded-lg group transition-colors">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs text-slate-600 truncate font-medium" title={item.nombre || label}>
                    {multiple ? (item.nombre || `Doc ${idx + 1}`) : "Documento único"}
                  </span>
                  {multiple && item.tipo === "fac" && item.porcentaje > 0 && (
                    <span className="text-[10px] text-blue-600 font-bold">
                      Facturado: {item.porcentaje}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewUrl(getFullUrl(item.url))}
                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Ver"
                  >
                    <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                  </button>
                  {multiple && (
                    <button
                      onClick={() => handleDeleteAdjunto(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 text-center">
              <span className="text-[10px] text-slate-400 font-medium italic">Sin archivos adjuntos</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const glosas = useMemo(() => {
    if (Array.isArray(c?.glosas)) return c.glosas;
    return [];
  }, [c]);

  const relatedQuotes = useMemo(() => {
    if (!allCotizaciones) return [];
    return allCotizaciones.filter(
      (item) =>
        !item.es_suscripcion &&
        !item.eliminado &&
        (item.parent_id === c?.id || (c?.proyecto_id && item.proyecto_id === c.proyecto_id))
    );
  }, [c?.id, c?.proyecto_id, allCotizaciones]);

  const combinedPayments = useMemo(() => {
    const list = [];
    
    // Direct contract payments
    if (Array.isArray(c?.pagos)) {
      c.pagos.forEach(p => {
        list.push({
          id: `direct-${p.id}`,
          fecha: p.fecha || p.creada_en,
          type: "payment",
          source: "direct",
          desc: p.descripcion || "Pago directo contrato",
          monto: p.monto,
          comprobante_url: p.comprobante_url,
        });
      });
    }

    // Monthly quote events (Invoices & Payments)
    if (Array.isArray(relatedQuotes)) {
      relatedQuotes.forEach(q => {
        // 1. Invoice event (Facturado) if state is FACTURADA, POR_FACTURAR, or PAGADA
        if (q.estado === "FACTURADA" || q.estado === "POR_FACTURAR" || q.estado === "PAGADA") {
          list.push({
            id: `invoice-${q.id}`,
            fecha: q.fecha_facturada || q.fecha_documento || q.creada_en,
            type: "invoice",
            source: "quote",
            desc: `Factura emitida (Cotiz. #${q.numero} - ${q.asunto || ""})`,
            monto: q.total,
            comprobante_url: q.doc_fac_url || null,
            quoteId: q.id,
          });
        }

        // 2. Payment event
        if (q.estado === "PAGADA") {
          list.push({
            id: `payment-full-${q.id}`,
            fecha: q.fecha_pagada || q.actualizado_en || q.creada_en,
            type: "payment",
            source: "quote",
            desc: `Pago mensualidad (Cotiz. #${q.numero} - ${q.asunto || ""})`,
            monto: q.total,
            comprobante_url: q.doc_comprobante_url || null,
            quoteId: q.id,
          });
        } else if (Array.isArray(q.pagos)) {
          q.pagos.forEach(p => {
            list.push({
              id: `quote-payment-${p.id}`,
              fecha: p.fecha || p.fecha_pago || p.creada_en,
              type: "payment",
              source: "quote",
              desc: `Pago mensualidad (Cotiz. #${q.numero}) - ${p.descripcion || "Pago registrado"}`,
              monto: p.monto,
              comprobante_url: p.comprobante_url,
              quoteId: q.id,
            });
          });
        }
      });
    }

    // Sort by date desc
    return list.sort((a, b) => {
      const dateA = new Date(a.fecha);
      const dateB = new Date(b.fecha);
      return dateB - dateA;
    });
  }, [c?.pagos, relatedQuotes]);

  // Totales de la suscripción (tarifas mensuales y total contrato)
  const totals = useMemo(() => {
    const glosasList = Array.isArray(glosas) ? glosas : [];

    const subtotalBruto = round0(
      glosasList.reduce((a, g) => a + round0(g?.monto ?? 0), 0)
    );

    const subtotalBrutoUF = glosasList.reduce((a, g) => a + Number(g?.monto_uf ?? 0), 0);

    const descGlosasMonto = round0(
      glosasList.reduce((a, g) => {
        const bruto = round0(g?.monto ?? 0);
        const pct = clampPct(g?.descuento_pct ?? 0);
        return a + bruto * (pct / 100);
      }, 0)
    );

    const subtotalTrasGlosas = round0(subtotalBruto - descGlosasMonto);
    const descGeneralPct = clampPct(c?.descuento_pct ?? 0);
    const descGeneralMonto = round0(subtotalTrasGlosas * (descGeneralPct / 100));
    const descuentoTotal = round0(descGlosasMonto + descGeneralMonto);

    const subtotalNeto = round0(c?.subtotal ?? (subtotalTrasGlosas - descGeneralMonto));
    const iva = round0(c?.iva ?? 0);
    const total = round0(c?.total ?? (subtotalNeto + iva));

    const totalPagado = combinedPayments.filter(p => p.type === "payment").reduce((a, p) => a + Number(p.monto || 0), 0);
    const restanteAPagar = Math.max(0, total * (c?.ciclos_mensuales || 12) - totalPagado);
    const porcentajePagado = (total * (c?.ciclos_mensuales || 12)) > 0
      ? (totalPagado / (total * (c?.ciclos_mensuales || 12))) * 100
      : 0;

    const porcentajeFacturado = Array.isArray(c?.adjuntos)
      ? c.adjuntos.filter(a => a.tipo === "fac").reduce((acc, a) => acc + (a.porcentaje || 0), 0)
      : 0;

    const ivaRate = subtotalNeto > 0 ? (iva / subtotalNeto) : 0.19;
    const totalUF = subtotalBrutoUF * (1 + (iva > 0 ? ivaRate : 0));

    return {
      subtotalBruto,
      subtotalBrutoUF,
      descGlosasMonto,
      subtotalTrasGlosas,
      descGeneralPct,
      descGeneralMonto,
      subtotalNeto,
      iva,
      total,
      totalPagado,
      restanteAPagar,
      porcentajePagado,
      porcentajeFacturado,
      descuentoTotal,
      ivaRate,
      totalUF,
    };
  }, [c, glosas, combinedPayments]);

  const planDates = useMemo(() => {
    const startStr = c?.fecha_inicio_plan || c?.proyecto?.fecha_inicio_plan || c?.fecha_documento || c?.creada_en;
    const getFallbackEndStr = (sStr) => {
      if (!sStr) return null;
      try {
        const d = new Date(sStr.slice(0, 10) + "T12:00:00");
        d.setMonth(d.getMonth() + Number(c?.ciclos_mensuales || 12));
        return d.toISOString().slice(0, 10);
      } catch {
        return sStr;
      }
    };
    const endStr = c?.fecha_fin_plan || c?.proyecto?.fecha_fin_plan || getFallbackEndStr(startStr);
    return { startStr, endStr };
  }, [c?.fecha_inicio_plan, c?.fecha_fin_plan, c?.proyecto?.fecha_inicio_plan, c?.proyecto?.fecha_fin_plan, c?.fecha_documento, c?.creada_en, c?.ciclos_mensuales]);

  const contractMonths = useMemo(() => {
    const { startStr, endStr } = planDates;
    const start = startStr ? new Date(startStr.slice(0, 10) + "T12:00:00") : null;
    const end = endStr ? new Date(endStr.slice(0, 10) + "T12:00:00") : null;
    if (!start || !end) return [];

    const months = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const limit = new Date(end.getFullYear(), end.getMonth(), 1);

    let count = 0;
    while (current <= limit && count < 120) {
      const year = current.getFullYear();
      const monthVal = current.getMonth() + 1;
      const label = MESES.find(m => m.val === monthVal)?.label || "";
      months.push({ year, monthVal, label });
      current.setMonth(current.getMonth() + 1);
      count++;
    }
    return months;
  }, [planDates]);

  const monthMatch = (quote, year, monthVal) => {
    const asuntoLower = String(quote.asunto || "").toLowerCase();
    const hasAnyMonthInAsunto = MESES.some(m => asuntoLower.includes(m.label.toLowerCase()));
    if (hasAnyMonthInAsunto) {
      const label = MESES.find(m => m.val === monthVal)?.label.toLowerCase();
      return label && asuntoLower.includes(label) && asuntoLower.includes(String(year));
    }
    const d = quote.fecha_documento ? new Date(quote.fecha_documento) : new Date(quote.creada_en);
    return d.getFullYear() === year && (d.getMonth() + 1) === monthVal;
  };

  const estado = (c?.estado || "COTIZACION").toUpperCase();
  const siguiente = estado === "COTIZACION" ? "ACEPTADA" : null;

  const [openAcciones, setOpenAcciones] = useState(false);

  const openEstadoMenu = (e) => {
    e?.stopPropagation?.();
    setOpenAcciones(true);
  };
  const closeEstadoMenu = () => setOpenAcciones(false);

  const [cotizacionIdLocked, setCotizacionIdLocked] = useState(null);

  // Modal Aceptar
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [openAceptada, setOpenAceptada] = useState(false);
  const [inicioPlan, setInicioPlan] = useState(todayStr);
  const [finPlan, setFinPlan] = useState(todayStr);
  const [errAceptada, setErrAceptada] = useState("");

  const calculateEndDate = (startDateStr, monthsCount) => {
    if (!startDateStr || !monthsCount) return "";
    const d = new Date(startDateStr + "T12:00:00");
    d.setMonth(d.getMonth() + Number(monthsCount));
    return d.toISOString().slice(0, 10);
  };

  const handleInicioPlanChange = (val) => {
    setInicioPlan(val);
    const newEnd = calculateEndDate(val, c?.ciclos_mensuales || 12);
    setFinPlan(newEnd);
  };

  const openAceptarModal = () => {
    if (!c?.id) return;
    setCotizacionIdLocked(c.id);
    setErrAceptada("");
    setInicioPlan(todayStr);
    const initialEnd = calculateEndDate(todayStr, c?.ciclos_mensuales || 12);
    setFinPlan(initialEnd);
    closeEstadoMenu();
    setTimeout(() => setOpenAceptada(true), 0);
  };

  const confirmAceptada = () => {
    const id = cotizacionIdLocked || c?.id;
    if (!id) return;

    if (!inicioPlan || !finPlan) {
      setErrAceptada("Debes ingresar ambas fechas.");
      return;
    }
    if (finPlan < inicioPlan) {
      setErrAceptada("La fecha fin no puede ser menor que la fecha inicio.");
      return;
    }

    setErrAceptada("");
    setOpenAceptada(false);

    onUpdateEstado?.(id, "ACEPTADA", {
      fecha_inicio_plan: inicioPlan,
      fecha_fin_plan: finPlan,
    });

    setCotizacionIdLocked(null);
  };

  // Modal Renovar
  const [openRenovar, setOpenRenovar] = useState(false);
  const [mesesRenovacion, setMesesRenovacion] = useState(6);
  const [renovando, setRenovando] = useState(false);
  const [errRenovacion, setErrRenovacion] = useState("");

  const handleRenewService = async () => {
    if (!c?.id) return;
    setRenovando(true);
    setErrRenovacion("");
    try {
      const baseEnd = c?.fecha_fin_plan || c?.proyecto?.fecha_fin_plan || new Date().toISOString();
      const d = new Date(baseEnd.slice(0, 10) + "T12:00:00");
      d.setMonth(d.getMonth() + Number(mesesRenovacion));
      const newEndDateStr = d.toISOString().slice(0, 10);
      const newCiclos = Number(c?.ciclos_mensuales || 12) + Number(mesesRenovacion);

      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const res = await fetch(`${API_URL}/cotizaciones/update/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        },
        body: JSON.stringify({
          cliente_id: c.cliente_id || c.cliente?.id,
          cliente_responsable_id: c.cliente_responsable_id || c.cliente_responsable?.id || null,
          asunto: c.asunto || null,
          terminos_condiciones: c.terminos_condiciones || null,
          acuerdo_pago: c.acuerdo_pago || null,
          descuento_pct: c.descuento_pct || 0,
          es_suscripcion: true,
          moneda: c.moneda,
          ciclos_mensuales: newCiclos,
          fecha_inicio_plan: c.fecha_inicio_plan ? c.fecha_inicio_plan.slice(0, 10) : (c.proyecto?.fecha_inicio_plan ? c.proyecto.fecha_inicio_plan.slice(0, 10) : undefined),
          fecha_fin_plan: newEndDateStr,
          valor_uf_manual: c.valor_uf_documento,
          sin_iva: c.sin_iva,
          glosas: (c.glosas || []).map(g => ({
            descripcion: g.descripcion,
            monto: g.monto,
            monto_uf: g.monto_uf,
            cantidad: g.cantidad,
            precio_unitario: g.precio_unitario,
            manual: g.manual ?? true,
            orden: g.orden ?? 0,
            descuento_pct: g.descuento_pct ?? 0,
            comentario: g.comentario ?? null,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al renovar servicio");
      }

      showSnack?.("success", `Servicio renovado con éxito por ${mesesRenovacion} meses más (Total: ${newCiclos} meses)`);
      setOpenRenovar(false);
      onRefresh?.();
    } catch (err) {
      setErrRenovacion(err.message);
    } finally {
      setRenovando(false);
    }
  };

  const getNewEndDatePreview = () => {
    const base = c?.fecha_fin_plan || c?.proyecto?.fecha_fin_plan;
    if (!base) return "—";
    try {
      const d = new Date(base.slice(0, 10) + "T12:00:00");
      d.setMonth(d.getMonth() + Number(mesesRenovacion));
      return fechaCL(d.toISOString());
    } catch {
      return "—";
    }
  };

  // Modal Rechazar
  const [openRechazar, setOpenRechazar] = useState(false);
  const [openNuevoPago, setOpenNuevoPago] = useState(false);

  const [motivo, setMotivo] = useState("");
  const [errRechazo, setErrRechazo] = useState("");

  const openRechazarModal = () => {
    if (!c?.id) return;
    setCotizacionIdLocked(c.id);
    setErrRechazo("");
    setMotivo("");
    closeEstadoMenu();
    setTimeout(() => setOpenRechazar(true), 0);
  };

  const confirmRechazar = () => {
    const id = cotizacionIdLocked || c?.id;
    if (!id) return;

    const clean = motivo.trim();

    if (clean && clean.length < 3) {
      setErrRechazo("Si ingresas motivo, que sea más descriptivo (mín. 3).");
      return;
    }
    if (clean.length > 500) {
      setErrRechazo("Máximo 500 caracteres.");
      return;
    }

    setErrRechazo("");
    setOpenRechazar(false);

    onUpdateEstado?.(id, "RECHAZADA", { motivo_rechazo: clean || null });

    setCotizacionIdLocked(null);
  };

  const goNext = () => {
    if (!c?.id || !siguiente) return;
    if (siguiente === "ACEPTADA") return openAceptarModal();
    closeEstadoMenu();
    onUpdateEstado?.(c.id, siguiente);
  };

  const handleEdit = () => {
    const id = cotizacionIdLocked || c?.id;
    if (!id) return;
    closeEstadoMenu();
    onEdit?.(id);
  };

  // Modal Eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const openDeleteModal = () => {
    setOpenDelete(true);
  };

  const confirmDelete = () => {
    if (!c?.id) return;
    onDelete?.(c.id);
    setOpenDelete(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-full md:w-[650px] bg-white z-50 shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <button
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors hover:cursor-pointer"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold">
                  Servicio/Arriendo #{c?.numero ? (c.numero >= 1000000 ? c.numero - 1000000 : c.numero) : "—"}
                </h3>
                <Badge>{estado}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fecha Inicio: {c?.fecha_documento ? fechaCL(c.fecha_documento) : fechaCL(c?.creada_en)}
              </p>
            </div>
          </div>

          
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Ficha Resumen Recurrente */}
          <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-500 mb-1 tracking-wider">Duración de Contrato</p>
              <p className="text-2xl font-black text-slate-800">{c?.ciclos_mensuales ?? 12} Meses</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-500 mb-1 tracking-wider">Tarifa Mensual</p>
              <p className="text-2xl font-black text-blue-800">
                {c?.moneda === "UF"
                  ? `${(totals.iva > 0 ? totals.totalUF : totals.subtotalBrutoUF).toFixed(2)} UF`
                  : formatCLP(totals.total)}
                {totals.iva > 0 && <span className="text-[10px] text-slate-400 font-normal ml-1">incl.</span>}
              </p>
              {c?.moneda === "UF" && (
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Equiv: {formatCLP(totals.total)} CLP (UF ref: {formatCLP(c?.valor_uf_documento ?? 37700)})
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-500 mb-1 tracking-wider">Total Contrato (Est.)</p>
              <p className="text-2xl font-black text-emerald-800">{formatCLP(totals.total * (c?.ciclos_mensuales ?? 12))}</p>
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                Subtotal Mensual
              </p>
              <p className="text-lg font-bold">{formatCLP(totals.subtotalNeto)}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                IVA Mensual ({totals.iva > 0 ? Math.round(totals.ivaRate * 100) : 0}%)
              </p>
              <p className="text-lg font-bold">{formatCLP(totals.iva)}</p>
            </div>

            <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-600/10">
              <p className="text-[10px] uppercase font-bold text-blue-600/70 mb-1">
                Total Mensual (CLP)
              </p>
              <p className="text-lg font-bold text-blue-600">
                {formatCLP(totals.total)}
              </p>
            </div>
          </div>

          {/* Facturación & Cobro Mensual */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase">Cobro mensual</p>
              <p className="text-[11px] text-slate-500">Genera una cotización de venta estándar para registrar el cobro de este mes.</p>
            </div>
            <button
              onClick={() => setOpenGenerarModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 uppercase bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined  text-base leading-none">receipt_long</span>
              Cotización Mensual
            </button>
          </div>

          {/* Datos */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Cliente
              </label>
              <p className="font-semibold text-slate-900">
                {c?.cliente?.nombre || "—"}
              </p>
              {c?.cliente?.rut ? (
                <p className="text-xs text-slate-500">RUT: {c.cliente.rut}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Vendedor Asignado
              </label>
              <p className="font-semibold text-slate-900">
                {c?.vendedor?.nombre || c?.vendedor?.correo || "—"}
              </p>
            </div>

            {c?.asunto ? (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Glosa General / Servicio
                </label>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.asunto}</p>
              </div>
            ) : null}

            {/* Proyecto asociado */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Proyecto Asociado <span className="text-slate-300 normal-case font-normal">(opcional)</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedProyectoId}
                  onChange={(e) => {
                    setSelectedProyectoId(e.target.value);
                    handleSaveProyecto(e.target.value);
                  }}
                  disabled={savingProyecto}
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-wait"
                >
                  <option value="">— Sin proyecto asociado —</option>
                  {proyectos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.id}
                    </option>
                  ))}
                </select>
                {savingProyecto && (
                  <CircularProgress size={16} />
                )}
              </div>
            </div>
          </div>

          {/* Glosas / Items de tarifa */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Detalle de Tarifas
              </h4>
              <span className="text-xs text-slate-400">{glosas.length} tarifa(s)</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">Descripción Tarifa</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cant.</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Tarifa Unit. (Neto)</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Monto Mensual (Neto)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {glosas.map((it, idx) => {
                    const cant = Number(it.cantidad || 1);
                    return (
                      <tr key={it.id ?? idx}>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800">{it.descripcion || "—"}</p>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600">
                          {cant}
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          {c?.moneda === "UF"
                            ? `${Number(it.monto_uf).toFixed(2)} UF`
                            : formatCLP(it.precio_unitario || it.monto)}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-slate-900">
                          {c?.moneda === "UF"
                            ? `${(Number(it.monto_uf) * cant).toFixed(2)} UF (~${formatCLP(it.monto)} CLP)`
                            : formatCLP(it.monto)}
                        </td>
                      </tr>
                    );
                  })}

                  {!glosas.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                        Este contrato no tiene glosas de tarifas.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Planificación de Facturación Mensual */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Planificación de Facturación Mensual
              </h4>
              
              {/* Selector de Año con flechas modernas */}
              {(c?.fecha_inicio_plan && c?.fecha_fin_plan) || (c?.proyecto?.fecha_inicio_plan && c?.proyecto?.fecha_fin_plan) ? (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setSelectedPlanYear(y => y - 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-700 font-extrabold transition-all border border-transparent hover:border-slate-200 cursor-pointer text-xs"
                  >
                    ◀
                  </button>
                  <span className="text-sm font-black text-slate-800 px-3 tracking-wide">{selectedPlanYear}</span>
                  <button
                    onClick={() => setSelectedPlanYear(y => y + 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-700 font-extrabold transition-all border border-transparent hover:border-slate-200 cursor-pointer text-xs"
                  >
                    ▶
                  </button>
                </div>
              ) : null}
            </div>
            
            {(c?.fecha_inicio_plan && c?.fecha_fin_plan) || (c?.proyecto?.fecha_inicio_plan && c?.proyecto?.fecha_fin_plan) ? (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 shadow-sm p-4">
                {/* Leyenda de Estados */}
                <div className="flex flex-wrap gap-4 text-[11px] font-bold text-slate-500 mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Pagado
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Facturado / Emitido
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Borrador
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Pendiente
                  </div>
                </div>

                {/* Grid de los 12 meses */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {MESES.map((m) => {
                    const monthVal = m.val;
                    const label = m.label;
                    
                    // Comprobar si está en el periodo
                    const isWithin = (() => {
                      const { startStr, endStr } = planDates;
                      if (!startStr || !endStr) return false;
                      const start = new Date(startStr.slice(0, 10) + "T12:00:00");
                      const end = new Date(endStr.slice(0, 10) + "T12:00:00");
                      const startYM = start.getFullYear() * 12 + start.getMonth();
                      const endYM = end.getFullYear() * 12 + end.getMonth();
                      const currentYM = selectedPlanYear * 12 + (monthVal - 1);
                      return currentYM >= startYM && currentYM <= endYM;
                    })();

                    // Encontrar cotización relacionada
                    const match = isWithin ? relatedQuotes.find(q => monthMatch(q, selectedPlanYear, monthVal)) : null;

                    // Clases del contenedor según estado
                    let cellCls = "bg-white border border-slate-200 text-slate-600";
                    let dotCls = "bg-slate-300";
                    let statusLabel = "Pendiente";
                    let isClickable = isWithin && !match;

                    if (!isWithin) {
                      cellCls = "bg-slate-50/50 border-slate-200/50 text-slate-300 opacity-40 pointer-events-none";
                      dotCls = "bg-transparent";
                      statusLabel = "";
                    } else if (match) {
                      if (match.estado === "PAGADA") {
                        cellCls = "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 text-emerald-800";
                        dotCls = "bg-emerald-500";
                        statusLabel = "Pagado";
                      } else if (match.estado === "FACTURADA" || match.estado === "POR_FACTURAR") {
                        cellCls = "bg-blue-50/40 border-blue-200 hover:border-blue-300 text-blue-800";
                        dotCls = "bg-blue-500";
                        statusLabel = "Facturado";
                      } else if (match.estado === "COTIZACION") {
                        cellCls = "bg-amber-50/40 border-amber-200 hover:border-amber-300 text-amber-800";
                        dotCls = "bg-amber-500";
                        statusLabel = "Borrador";
                      }
                    } else {
                      // Pendiente dentro de periodo
                      cellCls = "bg-white hover:bg-blue-50/30 border-slate-200 hover:border-blue-400 text-slate-700 hover:shadow-sm cursor-pointer";
                      dotCls = "bg-slate-300 group-hover:bg-blue-400";
                    }

                    const handleMonthClick = () => {
                      if (!isClickable) return;
                      setGenMonth(monthVal);
                      setGenYear(selectedPlanYear);
                      // Asunto se inicializará por el useEffect
                      setOpenGenerarModal(true);
                    };

                    return (
                      <div
                        key={monthVal}
                        onClick={handleMonthClick}
                        className={`p-3 rounded-xl border flex flex-col justify-between min-h-[85px] transition-all group select-none ${cellCls}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-extrabold uppercase tracking-wide">{label}</span>
                          {isWithin && (
                            <span className={`w-2.5 h-2.5 rounded-full ${dotCls}`}></span>
                          )}
                        </div>

                        <div className="mt-2.5">
                          {match ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider block">
                                {statusLabel}
                              </span>
                              <span className="text-[9px] font-bold font-mono opacity-80 block truncate">
                                Cotiz. #{match.numero}
                              </span>
                            </div>
                          ) : isWithin ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70 group-hover:text-blue-600 transition-colors">
                                {statusLabel}
                              </span>
                              <span className="text-[9px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-all block">
                                ➕ Generar cobro
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-5 border border-slate-200 border-dashed rounded-xl text-center bg-slate-50">
                <span className="text-slate-500 text-sm italic">
                  Activa el contrato (cambia el estado a ACEPTADA) para registrar el periodo de facturación mensual.
                </span>
              </div>
            )}
          </div>

          {/* Historial de Pagos Facturados */}
          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Control de Pagos
              </h4>
              <button
                onClick={() => setOpenNuevoPago(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Registrar pago recibido
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Pagado del Contrato:</span>
                  <span className={`text-xs font-bold ${totals.porcentajePagado >= 100 ? "text-green-600" : "text-orange-600"}`}>
                    {totals.porcentajePagado.toFixed(1)}%
                  </span>
                </div>
              </div>

              {combinedPayments.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Fecha</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Detalle</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Comprobante/Documento</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {combinedPayments.map((pago) => (
                      <tr key={pago.id} className={pago.type === "invoice" ? "bg-slate-50/30" : ""}>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {fechaCL(pago.fecha)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                          {pago.desc}
                        </td>
                        <td className="px-4 py-3">
                          {pago.comprobante_url ? (
                            <button
                              onClick={() => setViewUrl(getFullUrl(pago.comprobante_url))}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1 hover:cursor-pointer"
                            >
                              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} /> Ver archivo
                            </button>
                          ) : pago.type === "invoice" ? (
                            <span className="text-xs text-slate-400 italic">Factura digital</span>
                          ) : pago.source === "direct" ? (
                            <label className={`flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors ${uploadingPagoId === pago.id ? "text-slate-400" : "text-slate-500 hover:text-blue-600"}`}>
                              {uploadingPagoId === pago.id ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <FileUploadOutlinedIcon sx={{ fontSize: 16 }} />
                              )}
                              {uploadingPagoId === pago.id ? "Subiendo..." : "Subir comprobante"}
                              <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  onChange={(e) => handlePagoUpload(e, pago.id)}
                                  disabled={uploadingPagoId === pago.id}
                                />
                            </label>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Registrado en cotización</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pago.type === "invoice" ? (
                            <div className="font-semibold text-slate-500">Facturado: {formatCLP(pago.monto)}</div>
                          ) : (
                            <div className="font-bold text-green-600">Pagado: {formatCLP(pago.monto)}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/50 font-semibold border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-right text-slate-500" colSpan={3}>
                        Total Pagado hasta la fecha
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 text-base">
                        {formatCLP(totals.totalPagado)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 text-right text-slate-500" colSpan={3}>
                        Restante por Facturar/Cobrar
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 text-base">
                        {formatCLP(totals.restanteAPagar)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center flex flex-col items-center gap-2">
                  <span className="text-slate-500 text-sm">No hay pagos registrados para este servicio/arriendo.</span>
                  <span className="font-semibold text-rose-600 text-sm">Restante contrato: {formatCLP(totals.total * (c?.ciclos_mensuales || 12))}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer botones */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
          <button
            className="p-2 rounded-lg border border-slate-300 bg-slate-200 hover:bg-slate-300 hover:cursor-pointer font-semibold flex items-center justify-center gap-2 text-slate-700"
            onClick={handleEdit}
          >
            <EditIcon fontSize="small" />
            Editar Contrato
          </button>

          {estado === "COTIZACION" ? (
            <button
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-extrabold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:cursor-pointer"
              onClick={openAceptarModal}
              disabled={!c?.id}
            >
              🚀 Activar servicio
            </button>
          ) : estado === "ACEPTADA" ? (
            <button
              className="px-4 py-2.5 border border-rose-300 text-rose-600 text-sm font-bold rounded-xl hover:bg-rose-50 transition-colors hover:cursor-pointer"
              onClick={openRechazarModal}
              disabled={!c?.id}
            >
              🚫 Cancelar Servicio
            </button>
          ) : (
            <button
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
              onClick={openEstadoMenu}
              disabled={!c?.id}
            >
              Cambiar Estado
            </button>
          )}

          {estado === "ACEPTADA" && (
            <button
              className="col-span-2 py-2.5 bg-indigo-600 text-white text-sm font-extrabold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:cursor-pointer"
              onClick={() => setOpenRenovar(true)}
              disabled={!c?.id}
            >
              🔄 Renovar Servicio / Contrato
            </button>
          )}

          <button
            className="col-span-2 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
            onClick={openDeleteModal}
            disabled={!c?.id}
          >
            <DeleteOutlineIcon fontSize="small" />
            Eliminar Contrato
          </button>
        </div>
      </div>

      {/* MENU Estado */}
      <Dialog
        open={openAcciones}
        onClose={closeEstadoMenu}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1.5,
          },
        }}
        sx={{ zIndex: (t) => t.zIndex.modal + 10 }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Acciones del Contrato</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Selecciona la acción que deseas realizar para el contrato #{c?.numero ? (c.numero >= 1000000 ? c.numero - 1000000 : c.numero) : ""}
              </p>
            </div>
            <button
              onClick={closeEstadoMenu}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 font-semibold"
            >
              ✕
            </button>
          </div>
        </DialogTitle>

        <DialogContent sx={{ py: 2 }}>
          <div className="space-y-3.5">
            {siguiente ? (
              <button
                onClick={() => {
                  closeEstadoMenu();
                  goNext();
                }}
                className="w-full text-left p-3.5 border border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl transition-all group flex items-start gap-3"
              >
                <div className="p-2 bg-blue-50 group-hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-xl leading-none">arrow_forward</span>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Avanzar Proceso</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    Cambiar estado a: <span className="text-blue-600">{siguiente === "ACEPTADA" ? "Proyecto Andando" : siguiente.replaceAll("_", " ")}</span>
                  </p>
                </div>
              </button>
            ) : null}

            {estado === "COTIZACION" || estado === "ACEPTADA" ? (
              <button
                onClick={openRechazarModal}
                className="w-full text-left p-3.5 border border-slate-100 hover:border-rose-500 hover:bg-rose-50/30 rounded-xl transition-all group flex items-start gap-3"
              >
                <div className="p-2 bg-rose-50 group-hover:bg-rose-100 text-rose-600 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-xl leading-none">thumb_down</span>
                </div>
                <div>
                  <span className="text-xs text-rose-500 font-bold uppercase tracking-wider">
                    {estado === "ACEPTADA" ? "Dar de baja / Cancelar" : "Rechazar / Cancelar"}
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {estado === "ACEPTADA" ? "Marcar este servicio como cancelado" : "Marcar este contrato como Rechazado"}
                  </p>
                </div>
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Aceptar */}
      <Dialog
        open={openAceptada}
        onClose={() => setOpenAceptada(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
          }
        }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
          {/* Header con Icono */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 leading-tight">Activar Servicio</h3>
              <p className="text-xs text-slate-500 mt-0.5">Comienza la prestación y facturación del contrato</p>
            </div>
          </div>

          {errAceptada && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold rounded-xl">
              ⚠️ {errAceptada}
            </div>
          )}

          {/* Tarjeta de Resumen */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Contrato</span>
              <span className="text-sm font-bold text-slate-700">#{c?.numero ? (c.numero >= 1000000 ? c.numero - 1000000 : c.numero) : "—"}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Duración</span>
              <span className="text-sm font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                {c?.ciclos_mensuales || 12} meses
              </span>
            </div>
          </div>

          {/* Formulario */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5 ml-1">Fecha de Inicio</label>
              <TextField
                size="small"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={inicioPlan}
                onChange={(e) => handleInicioPlanChange(e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    backgroundColor: "white",
                  }
                }}
              />
            </div>

            {/* Fecha Fin Calculada */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">Fecha de Fin (Calculada)</span>
                <span className="text-base font-black text-emerald-800">
                  {finPlan ? fechaCL(new Date(finPlan + "T12:00:00").toISOString()) : "—"}
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-100/60 flex items-center justify-center text-emerald-700">
                📅
              </div>
            </div>
          </div>
        </DialogContent>

        <div className="p-4 pt-2 flex justify-end gap-2.5">
          <button
            onClick={() => setOpenAceptada(false)}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors hover:cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={confirmAceptada}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20 hover:cursor-pointer flex items-center gap-1.5"
          >
            Activar servicio
          </button>
        </div>
      </Dialog>

      {/* Modal Renovar */}
      <Dialog
        open={openRenovar}
        onClose={() => setOpenRenovar(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Renovar Servicio / Contrato</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 1 }}>
          {errRenovacion && <div className="text-xs text-rose-600 font-semibold">{errRenovacion}</div>}
          <p className="text-xs text-slate-500">
            Ingresa la cantidad de meses adicionales para la renovación. El historial de cobros no se perderá y se extenderá el periodo del contrato.
          </p>
          <TextField
            size="small"
            type="number"
            label="Meses de Renovación"
            inputProps={{ min: 1 }}
            value={mesesRenovacion}
            onChange={(e) => setMesesRenovacion(Math.max(1, Number(e.target.value)))}
            fullWidth
          />
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Duración actual:</span>
              <span className="font-bold">{c?.ciclos_mensuales || 12} meses</span>
            </div>
            <div className="flex justify-between font-bold text-indigo-600">
              <span>Nueva duración total:</span>
              <span>{(c?.ciclos_mensuales || 12) + Number(mesesRenovacion)} meses ({Math.round(((c?.ciclos_mensuales || 12) + Number(mesesRenovacion)) / 12 * 10) / 10} años)</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
              <span>Fin de contrato actual:</span>
              <span className="font-semibold">{c?.fecha_fin_plan ? fechaCL(c.fecha_fin_plan) : "No definida"}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600">
              <span>Nuevo fin de contrato:</span>
              <span>{getNewEndDatePreview()}</span>
            </div>
          </div>
        </DialogContent>
        <div className="p-4 flex justify-end gap-2">
          <Button size="small" onClick={() => setOpenRenovar(false)}>Cancelar</Button>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={handleRenewService}
            disabled={renovando}
            sx={{ fontWeight: 'bold' }}
          >
            {renovando ? <CircularProgress size={16} color="inherit" /> : "Confirmar Renovación"}
          </Button>
        </div>
      </Dialog>

      {/* Modal Rechazar */}
      <Dialog
        open={openRechazar}
        onClose={() => setOpenRechazar(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Rechazar / Cancelar Contrato</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 1 }}>
          {errRechazo && <div className="text-xs text-rose-600 font-semibold">{errRechazo}</div>}
          <p className="text-xs text-slate-500">
            Indica opcionalmente el motivo del rechazo del servicio.
          </p>
          <TextField
            size="small"
            label="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </DialogContent>
        <div className="p-4 flex justify-end gap-2">
          <Button size="small" onClick={() => setOpenRechazar(false)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error" onClick={confirmRechazar}>Confirmar Rechazo</Button>
        </div>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>¿Eliminar este Contrato?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-600">
            Esta acción es irreversible y eliminará el registro de Servicio / Arriendo de la base de datos.
          </p>
        </DialogContent>
        <div className="p-4 flex justify-end gap-2">
          <Button size="small" onClick={() => setOpenDelete(false)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error" onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Dialog>

      {/* Modal Nuevo Pago */}
      <NuevoPagoDialog
        open={openNuevoPago}
        onClose={() => setOpenNuevoPago(false)}
        cotizacion={c}
        onRefresh={onRefresh}
      />

      {/* Modal Generar Cotización Mensual */}
      <Dialog
        open={openGenerarModal}
        onClose={() => !generating && setOpenGenerarModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
          }
        }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
          {/* Header con Icono */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 leading-tight">Generar cotización mensual</h3>
              <p className="text-xs text-slate-500 mt-0.5">Crea una cotización estándar de cobro para el periodo seleccionado</p>
            </div>
          </div>

          {genErr && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold rounded-xl">
              ⚠️ {genErr}
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-4">
            {/* Grid Mes y Año */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 ml-1">Mes de Cobro</label>
                <TextField
                  select
                  size="small"
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                  fullWidth
                  SelectProps={{ native: true }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: "white",
                    }
                  }}
                >
                  {MESES.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label}
                    </option>
                  ))}
                </TextField>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 ml-1">Año de Cobro</label>
                <TextField
                  select
                  size="small"
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  fullWidth
                  SelectProps={{ native: true }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: "white",
                    }
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </TextField>
              </div>
            </div>

            {/* Asunto Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5 ml-1">Asunto </label>
              <TextField
                size="small"
                value={customAsunto}
                onChange={(e) => setCustomAsunto(e.target.value)}
                fullWidth
                required
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    backgroundColor: "white",
                  }
                }}
              />
            </div>

            {/* Tarjeta UF si aplica */}
            {c?.moneda === "UF" && (
              <div className="p-3.5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-600 block mb-0.5">UF de Referencia (Hoy)</span>
                  <span className="text-base font-black text-blue-800">
                    {formatCLP(valorUF)}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-100/60 flex items-center justify-center text-blue-700 font-bold text-xs">
                  UF
                </div>
              </div>
            )}
          </div>
        </DialogContent>

        <div className="p-4 pt-2 flex justify-end gap-2.5">
          <button
            onClick={() => setOpenGenerarModal(false)}
            disabled={generating}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors hover:cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerateMonthlyQuote}
            disabled={generating}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20 hover:cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? (
              <>
                <CircularProgress size={16} color="inherit" />
                <span>Generando...</span>
              </>
            ) : (
              <span>Generar Cotización</span>
            )}
          </button>
        </div>
      </Dialog>

      {/* Preview de archivos */}
      <FilePreviewModal
        url={viewUrl}
        open={!!viewUrl}
        onClose={() => setViewUrl(null)}
      />
    </>
  );
}
