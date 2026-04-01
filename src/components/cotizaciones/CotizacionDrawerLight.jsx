// src/components/cotizaciones/CotizacionDrawerLight.jsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";
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
  const [viewUrl, setViewUrl] = useState(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Componente interno para previsualizar archivos
  const FilePreviewer = ({ url }) => {
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [xlsxData, setXlsxData] = useState(null);

    useEffect(() => {
      if (!url) return;
      
      const isDocx = url.toLowerCase().endsWith(".docx");
      const isXlsx = url.toLowerCase().endsWith(".xlsx");
      const isPdf = url.toLowerCase().endsWith(".pdf");
      const isImg = url.match(/\.(jpeg|jpg|gif|png)$/i);

      if (!isDocx && !isXlsx) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setXlsxData(null);

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error("No se pudo cargar el archivo");
          return res.blob();
        })
        .then(async (blob) => {
          if (isDocx && containerRef.current) {
            containerRef.current.innerHTML = "";
            await renderAsync(blob, containerRef.current, undefined, {
              className: "docx-viewer",
              inWrapper: false
            });
          } else if (isXlsx) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: "array" });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const html = XLSX.utils.sheet_to_html(worksheet);
              setXlsxData(html);
              setLoading(false);
            };
            reader.readAsArrayBuffer(blob);
            return; // El loading se quita en onload
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("Error al procesar el documento");
          setLoading(false);
        });
    }, [url]);

    if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <img src={url} alt="Documento" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} />
        </div>
      );
    }

    if (url.toLowerCase().endsWith(".pdf")) {
      return <iframe src={url} width="100%" height="100%" title="Visor PDF" style={{ border: "none" }} />;
    }

    return (
      <div className="relative w-full h-full overflow-auto bg-white p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 gap-3 flex-col">
            <CircularProgress size={32} />
            <p className="text-sm font-medium text-slate-500">Procesando vista previa...</p>
          </div>
        )}
        
        {error && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-500">
            <p>{error}</p>
            <Button size="small" variant="outlined" color="inherit" sx={{ mt: 2 }} href={url} target="_blank" download>
              Descargar archivo en su lugar
            </Button>
          </div>
        )}

        <div ref={containerRef} className="docx-preview-container" />
        
        {xlsxData && (
          <div 
            className="excel-preview-container overflow-auto"
            dangerouslySetInnerHTML={{ __html: xlsxData }}
            style={{ 
              maxWidth: "100%",
              fontSize: "12px",
              fontFamily: "Inter, system-ui, sans-serif"
            }}
          />
        )}

        {!loading && !error && !xlsxData && !url.match(/\.(docx|pdf|jpeg|jpg|gif|png)$/i) && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <VisibilityOutlinedIcon fontSize="large" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Previsualización no disponible</h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Este formato de archivo no puede procesarse en el navegador. Por favor, descárgalo para verlo.
            </p>
            <Button variant="contained" href={url} target="_blank" download>
              Descargar Archivo
            </Button>
          </div>
        )}
      </div>
    );
  };

  const handleDocUpload = async (e, docType) => {
    const file = e.target.files?.[0];
    if (!file || !c?.id) return;

    try {
      setUploadingDoc(docType);
      const fd = new FormData();
      fd.append("file", file);

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
      e.target.value = "";
    }
  };

  const DocButton = ({ docType, label, url }) => {
    const isUploading = uploadingDoc === docType;
    return (
      <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white shadow-sm">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          {url ? (
            <button
              onClick={() => setViewUrl(`${API_URL?.replace("/api", "")}/api${url}`)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              title="Ver documento"
            >
              <VisibilityOutlinedIcon fontSize="small" /> Ver
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium px-2">Sin doc</span>
          )}

          <label className={`relative p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer ${isUploading ? "text-slate-400" : "text-slate-600 hover:bg-slate-100"}`}>
            {isUploading ? <CircularProgress size={16} color="inherit" /> : <FileUploadOutlinedIcon fontSize="small" />}
            {isUploading ? "Subiendo" : "Subir"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleDocUpload(e, docType)}
              disabled={isUploading}
            />
          </label>
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

    // subtotal neto real (lo que guardas)
    const subtotalNeto = round0(c?.subtotal ?? (subtotalTrasGlosas - descGeneralMonto));
    const iva = round0(c?.iva ?? 0);
    const total = round0(c?.total ?? (subtotalNeto + iva));

    return {
      subtotalBruto,
      descGlosasMonto,
      descGeneralPct,
      descGeneralMonto,
      descuentoTotal,
      subtotalNeto,
      iva,
      total,
    };
  }, [items, c]);

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

          {/* Documentos Adjuntos */}
          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Documentos Adjuntos
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DocButton docType="oc" label="Orden de Compra (OC)" url={c?.doc_oc_url} />
              <DocButton docType="hes" label="Hoja de Ejecución (HES)" url={c?.doc_hes_url} />
              <DocButton docType="fac" label="Factura (FAC)" url={c?.doc_fac_url} />
              <DocButton docType="comprobante" label="Comprobante de Pago" url={c?.doc_comprobante_url} />
              <DocButton docType="gd" label="Guía de Despacho (GD)" url={c?.doc_gd_url} />
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

      {/* Modal Visor de Documentos */}
      <Dialog
        open={!!viewUrl}
        onClose={() => setViewUrl(null)}
        maxWidth="md"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 30 }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Visor de Documento</span>
          <Button onClick={() => setViewUrl(null)} color="inherit" size="small">
            Cerrar
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: "75vh", backgroundColor: "#f8fafc", overflow: "hidden" }}>
          {viewUrl && <FilePreviewer url={viewUrl} />}
        </DialogContent>
      </Dialog>
    </>
  );
}