// src/components/cotizaciones/CotizacionDrawerLight.jsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import {
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { useSession } from "next-auth/react";
import CircularProgress from "@mui/material/CircularProgress";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import CotizacionPDFButton from "./CotizacionPDFButton";
import NuevoPagoDialog from "./NuevoPagoDialog";
import { fechaCL, formatCLP, nextEstados } from "@/components/cotizaciones/utils/utils";

function Badge({ children }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase">
      {children}
    </span>
  );
}

const round0 = (n) => Math.round(Number(n || 0));
const clampPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99.99, n));
};

export default function CotizacionDrawerLight({
  open,
  cotizacion,
  onClose,
  onEdit,
  onUpdateEstado,
  onDelete,
  showSnack,
  onRefresh,
}) {
  const { data: session } = useSession();
  const c = cotizacion;

  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [facPrompt, setFacPrompt] = useState(null); // { file, docType }
  const [facPorcentaje, setFacPorcentaje] = useState(100);
  const [viewUrl, setViewUrl] = useState(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Proyecto asociado
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState("");
  const [savingProyecto, setSavingProyecto] = useState(false);

  // Cargar proyectos y sincronizar con la cotizacion actual
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
          // Preserve existing values so the backend doesn't recalculate or fail validations
          cliente_id: c.cliente_id || c.cliente?.id,
          ventaIds: (c.ventas || []).map(v => v.id),
          glosas: (c.glosas || []).map(g => ({
            descripcion: g.descripcion,
            monto: g.monto,
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
    // Evitar duplicar /api si el backend ya lo incluye
    const cleanUrl = url.startsWith("/api") ? url.slice(4) : url;
    const base = API_URL?.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
    const path = cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`;
    return `${base}${path}`;
  };


  const handleDocUpload = async (e, docType, metadata = {}) => {
    const file = e?.target?.files?.[0] || metadata.file;
    if (!file || !c?.id) return;

    // Si es FAC y no tenemos porcentaje aún, pedimos prompt
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


  const items = useMemo(() => {
    if (Array.isArray(c?.glosas)) return c.glosas;
    if (Array.isArray(c?.items)) return c.items;
    return [];
  }, [c]);

  // =========================
  // ✅ Totales con descuento (para mostrar)
  // =========================
  const totals = useMemo(() => {
    const glosas = Array.isArray(items) ? items : [];

    const subtotalBruto = round0(
      glosas.reduce((a, g) => a + round0(g?.monto ?? g?.bruto ?? 0), 0)
    );

    const descGlosasMonto = round0(
      glosas.reduce((a, g) => {
        const bruto = round0(g?.monto ?? g?.bruto ?? 0);
        const pct = clampPct(g?.descuento_pct ?? g?.descuentoPct ?? 0);
        return a + bruto * (pct / 100);
      }, 0)
    );

    const subtotalTrasGlosas = round0(subtotalBruto - descGlosasMonto);

    const descGeneralPct = clampPct(c?.descuento_pct ?? 0);
    const descGeneralMonto =
      c?.descuento_monto != null
        ? round0(c.descuento_monto)
        : round0(subtotalTrasGlosas * (descGeneralPct / 100));

    const descuentoTotal = round0(descGlosasMonto + descGeneralMonto);

    const subtotalNeto = round0(c?.subtotal ?? (subtotalTrasGlosas - descGeneralMonto));
    const iva = round0(c?.iva ?? 0);
    const total = round0(c?.total ?? (subtotalNeto + iva));

    const totalPagado = Array.isArray(c?.pagos) ? c.pagos.reduce((a, p) => a + Number(p.monto || 0), 0) : 0;
    const restanteAPagar = Math.max(0, total - totalPagado);
    const porcentajePagado = total > 0 ? (totalPagado / total) * 100 : 0;

    const porcentajeFacturado = Array.isArray(c?.adjuntos) 
      ? c.adjuntos.filter(a => a.tipo === "fac").reduce((acc, a) => acc + (a.porcentaje || 0), 0)
      : 0;

    return {
      subtotalBruto,
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
    };
  }, [c, items]);

  const estado = (c?.estado || "COTIZACION").toUpperCase();
  const siguiente = nextEstados(estado)?.[0] || null;

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const openEstadoMenu = (e) => {
    e?.stopPropagation?.();
    setAnchorEl(e.currentTarget);
  };
  const closeEstadoMenu = () => setAnchorEl(null);

  const [cotizacionIdLocked, setCotizacionIdLocked] = useState(null);

  // Modal Aceptar
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [openAceptada, setOpenAceptada] = useState(false);
  const [inicioPlan, setInicioPlan] = useState(todayStr);
  const [finPlan, setFinPlan] = useState(todayStr);
  const [errAceptada, setErrAceptada] = useState("");

  const openAceptarModal = () => {
    if (!c?.id) return;
    setCotizacionIdLocked(c.id);
    setErrAceptada("");
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

  // Modal Rechazar
  const [openRechazar, setOpenRechazar] = useState(false);
  const [openNuevoPago, setOpenNuevoPago] = useState(false);

  const [motivo, setMotivo] = useState("");
  const [errRechazo, setErrRechazo] = useState("");
  const puedeRechazar = estado === "COTIZACION";

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
                  Cotización #{c?.numero ?? "—"}
                </h3>
                <Badge>{estado}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Creada: {c?.creada_en ? fechaCL(c.creada_en) : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CotizacionPDFButton cotizacion={c} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Totales */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                Subtotal (Bruto)
              </p>
              <p className="text-lg font-bold">{formatCLP(totals.subtotalBruto)}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                Descuento
              </p>
              <p className="text-lg font-bold">{formatCLP(totals.descuentoTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Glosas: {formatCLP(totals.descGlosasMonto)} · General: {formatCLP(totals.descGeneralMonto)}
                {totals.descGeneralPct > 0 ? ` (${totals.descGeneralPct}%)` : ""}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                Subtotal (Neto)
              </p>
              <p className="text-lg font-bold">{formatCLP(totals.subtotalNeto)}</p>
            </div>

            <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-600/10">
              <p className="text-[10px] uppercase font-bold text-blue-600/70 mb-1">
                Total
              </p>
              <p className="text-lg font-bold text-blue-600">
                {formatCLP(totals.total)}
              </p>
              <p className="text-[11px] text-blue-600/70 mt-1">
                IVA: {formatCLP(totals.iva)}
              </p>
            </div>
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
                Vendedor
              </label>
              <p className="font-semibold text-slate-900">
                {c?.vendedor?.nombre ||
                  c?.vendedor?.correo ||
                  (c?.vendedor_id ? `ID: ${c.vendedor_id}` : "—")}
              </p>
              {c?.vendedor?.correo ? (
                <p className="text-xs text-slate-500">{c.vendedor.correo}</p>
              ) : null}
            </div>

            {c?.asunto ? (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Asunto
                </label>
                <p className="text-sm text-slate-600 leading-relaxed">{c.asunto}</p>
              </div>
            ) : null}

            {/* Proyecto asociado — selector inline opcional */}
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

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Ítems de la Cotización
              </h4>
              <span className="text-xs text-slate-400">{items.length} ítem(s)</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600" colSpan={2}>
                      Descripción
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">
                      Tipo
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">
                      Descuento
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">
                      Neto
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const bruto = round0(it?.monto ?? it?.total ?? it?.precioUnitario ?? 0);
                    const pct = clampPct(it?.descuento_pct ?? 0);
                    const desc = round0(bruto * (pct / 100));
                    const neto = round0(bruto - desc);

                    return (
                      <tr key={it.id ?? idx}>
                        <td className="px-4 py-4" colSpan={2}>
                          <p className="font-medium">
                            {it.descripcion || it.Item || it?.producto?.nombre || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                            {it.manual ? "MANUAL" : it.tipo || "AUTO"}
                          </span>
                        </td>



                        <td className="px-4 py-4 text-right font-medium">
                          {formatCLP(desc)} {pct > 0 ? <span className="text-xs text-slate-400">({pct}%)</span> : null}
                        </td>

                        <td className="px-4 py-4 text-right font-bold">
                          {formatCLP(neto)}
                        </td>
                      </tr>
                    );
                  })}

                  {!items.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                        Esta cotización no tiene ítems.
                      </td>
                    </tr>
                  ) : null}
                </tbody>

                {!!items.length ? (
                  <tfoot className="bg-slate-100/50 font-semibold border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={4}>
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-right">{formatCLP(totals.subtotalBruto)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={4}>
                        Descuento
                      </td>
                      <td className="px-4 py-3 text-right">-{formatCLP(totals.descuentoTotal)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={4}>
                        Subtotal Neto
                      </td>
                      <td className="px-4 py-3 text-right">+{formatCLP(totals.subtotalNeto)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={4}>
                        IVA 19%
                      </td>
                      <td className="px-4 py-3 text-right">+ {formatCLP(totals.iva)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={4}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">{formatCLP(totals.total)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>

          {/* Historial de Pagos */}
          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Historial de Pagos
              </h4>
              <button
                onClick={() => setOpenNuevoPago(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Agregar pago
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Facturado:</span>
                  <span className={`text-xs font-bold ${totals.porcentajeFacturado >= 100 ? "text-green-600" : "text-blue-600"}`}>
                    {totals.porcentajeFacturado.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Pagado:</span>
                  <span className={`text-xs font-bold ${totals.porcentajePagado >= 100 ? "text-green-600" : "text-orange-600"}`}>
                    {totals.porcentajePagado.toFixed(1)}%
                  </span>
                </div>
              </div>

              {Array.isArray(c?.pagos) && c.pagos.length > 0 ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Fecha</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Comprobante</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Monto Pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {fechaCL(pago.fecha)}
                        </td>
                        <td className="px-4 py-3">
                          {pago.comprobante_url ? (
                            <button
                              onClick={() => setViewUrl(getFullUrl(pago.comprobante_url))}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1 hover:cursor-pointer"
                              title={pago.comprobante_nombre || "Ver comprobante"}
                            >
                              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} /> Ver
                            </button>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-green-600">{formatCLP(pago.monto)}</div>
                          {totals.total > 0 && (
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {((pago.monto / totals.total) * 100).toFixed(1)}%
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/50 font-semibold border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-right text-slate-500" colSpan={2}>
                        Total Pagado
                        <span className="text-[10px] uppercase block mt-0.5 text-slate-400 font-bold">
                          {totals.porcentajePagado.toFixed(1)}% de la cotización
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 text-base">
                        {formatCLP(totals.totalPagado)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 text-right text-slate-500" colSpan={2}>
                        Restante a Pagar
                        <span className="text-[10px] uppercase block mt-0.5 text-slate-400 font-bold">
                          del total de {formatCLP(totals.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 text-base">
                        {formatCLP(totals.restanteAPagar)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center flex flex-col items-center gap-2">
                <span className="text-slate-500 text-sm">No hay pagos registrados para esta cotización.</span>
                <span className="font-semibold text-rose-600 text-sm">Restante a pagar: {formatCLP(totals.total)}</span>
              </div>
            )}
          </div>
        </div>

          {/* Documentos Adjuntos */}
          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Documentos Adjuntos
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DocButton docType="oc" label="Orden de Compra (OC)" url={c?.doc_oc_url} />
              <DocButton docType="hes" label="Hoj. Ejecución (HES)" multiple adjuntos={c?.adjuntos} />
              <DocButton docType="fac" label="Facturas (FAC)" multiple adjuntos={c?.adjuntos} />
              <DocButton docType="comprobante" label="Comprobantes Pago" multiple adjuntos={c?.adjuntos} />
              <DocButton docType="gd" label="Guías de Despacho" multiple adjuntos={c?.adjuntos} />
            </div>
          </div>
        </div>

        {/* Footer botones */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
          <button
            className="p-2 rounded-lg border border-slate-300 bg-slate-200 hover:bg-slate-300 hover:cursor-pointer font-semibold"
            title="Editar"
            onClick={() => c?.id && onEdit?.(c.id)}
          >
            Editar ✎
          </button>

          <button
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
            onClick={openEstadoMenu}
            disabled={!c?.id}
          >
            Cambiar Estado
          </button>

          <button
            className="col-span-2 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
            onClick={openDeleteModal}
            disabled={!c?.id}
          >
            <DeleteOutlineIcon fontSize="small" />
            Eliminar Cotización
          </button>
        </div>
      </div>

      {/* MENU */}
      <Menu
        anchorEl={anchorEl}
        open={openMenu && !openAceptada && !openRechazar}
        onClose={closeEstadoMenu}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 280 } }}
      >
        {siguiente ? (
          <MenuItem onClick={goNext}>
            <ListItemIcon>
              <ArrowForwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                siguiente === "ACEPTADA"
                  ? "Aceptar cotización"
                  : `Avanzar a ${siguiente.replaceAll("_", " ")}`
              }
              secondary={
                siguiente === "ACEPTADA"
                  ? "Define fechas planificadas y crea el proyecto"
                  : "Cambia el estado al siguiente paso"
              }
            />
          </MenuItem>
        ) : (
          <MenuItem disabled>
            <ListItemIcon>
              <CheckCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Cotización finalizada" secondary={`Estado: ${estado}`} />
          </MenuItem>
        )}

        {puedeRechazar && (
          <MenuItem onClick={openRechazarModal}>
            <ListItemIcon>
              <ThumbDownAltOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Rechazar cotización"
              secondary="Marca como RECHAZADA (con motivo opcional)"
            />
          </MenuItem>
        )}

        <Divider />

        <MenuItem onClick={handleEdit} disabled={!c?.id}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Editar cotización" secondary="Editar datos de la cotización" />
        </MenuItem>
      </Menu>

      {/* Modal Aceptada */}
      <Dialog
        open={openAceptada}
        onClose={() => {
          setOpenAceptada(false);
          setCotizacionIdLocked(null);
        }}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 20 }}
      >
        <DialogTitle>Aceptar cotización</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Fecha inicio planificada"
              type="date"
              value={inicioPlan}
              onChange={(e) => setInicioPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fecha fin planificada"
              type="date"
              value={finPlan}
              onChange={(e) => setFinPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            {errAceptada ? (
              <div style={{ color: "#d32f2f", fontSize: 13 }}>{errAceptada}</div>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenAceptada(false);
              setCotizacionIdLocked(null);
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" startIcon={<ThumbUpAltOutlinedIcon />} onClick={confirmAceptada}>
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Rechazar */}
      <Dialog
        open={openRechazar}
        onClose={() => {
          setOpenRechazar(false);
          setCotizacionIdLocked(null);
        }}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 20 }}
      >
        <DialogTitle>Rechazar cotización</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Motivo (opcional)"
              placeholder="Ej: presupuesto fuera de alcance, fechas no calzan, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            {errRechazo ? (
              <div style={{ color: "#d32f2f", fontSize: 13 }}>{errRechazo}</div>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenRechazar(false);
              setCotizacionIdLocked(null);
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" color="error" startIcon={<ThumbDownAltOutlinedIcon />} onClick={confirmRechazar}>
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 20 }}
      >
        <DialogTitle sx={{ color: 'error.main', display: 'flex', itemsCenter: 'center', gap: 1 }}>
          <DeleteOutlineIcon color="error" />
          ¿Eliminar cotización?
        </DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-500">
            Esta acción marcará la cotización #{c?.numero} como eliminada.
            Esta acción no se puede deshacer fácilmente desde la interfaz.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Sí, eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Prompt % Facturado */}
      <Dialog open={!!facPrompt} onClose={() => setFacPrompt(null)} maxWidth="xs" fullWidth sx={{ zIndex: (t) => t.zIndex.modal + 20 }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: "bold" }}>% Facturado</DialogTitle>
        <DialogContent>
          <p className="text-xs text-slate-500 mb-4">
            Indica qué porcentaje de la cotización representa esta factura.
          </p>
          <TextField
            fullWidth
            type="number"
            label="Porcentaje (%)"
            value={facPorcentaje}
            onChange={(e) => setFacPorcentaje(e.target.value)}
            inputProps={{ min: 0, max: 100 }}
            autoFocus
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFacPrompt(null)} color="inherit">Cancelar</Button>
          <Button 
            onClick={() => handleDocUpload(null, facPrompt.docType, { file: facPrompt.file, porcentaje: facPorcentaje })}
            variant="contained" 
            disabled={!facPorcentaje || facPorcentaje <= 0}
          >
            Confirmar y Subir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Visor de Documentos (compartido) */}
      <FilePreviewModal 
        open={!!viewUrl} 
        url={viewUrl} 
        onClose={() => setViewUrl(null)} 
        title="Visor de Documento"
      />

      {/* Modal Registrar Pago */}
      <NuevoPagoDialog
        open={openNuevoPago}
        onClose={() => setOpenNuevoPago(false)}
        session={session}
        cotizacionId={c?.id}
        restanteAPagar={totals.restanteAPagar}
        totalCotizacion={totals.total}
        onCreated={() => {
          setOpenNuevoPago(false);
          onRefresh?.();
        }}
        showSnack={showSnack}
      />
    </>
  );
}