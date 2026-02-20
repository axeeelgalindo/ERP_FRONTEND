"use client";

import { useMemo, useState } from "react";
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

import CotizacionPDFButton from "./CotizacionPDFButton";
import { fechaCL, formatCLP, nextEstados } from "@/components/cotizaciones/utils/utils";

function Badge({ children }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase">
      {children}
    </span>
  );
}

export default function CotizacionDrawerLight({
  open,
  cotizacion,
  onClose,
  onEdit,
  onUpdateEstado,
  showSnack,
}) {
  const c = cotizacion;

  // Items (glosas o items)
  const items = useMemo(() => {
    if (Array.isArray(c?.glosas)) return c.glosas;
    if (Array.isArray(c?.items)) return c.items;
    return [];
  }, [c]);

 

  const estado = (c?.estado || "COTIZACION").toUpperCase();
  const siguiente = nextEstados(estado)?.[0] || null;

  /* =========================
     Menú Cambiar Estado (MUI)
  ========================= */
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const openEstadoMenu = (e) => {
    e?.stopPropagation?.();
    setAnchorEl(e.currentTarget);
  };

  const closeEstadoMenu = () => setAnchorEl(null);

  // ✅ lock ID para que no se pierda si el padre actualiza/cierra
  const [cotizacionIdLocked, setCotizacionIdLocked] = useState(null);

  /* =========================
     Modal Aceptar (fechas)
  ========================= */
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

  /* =========================
     Modal Rechazar (motivo)
  ========================= */
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

  /* =========================
     Acciones del menú
  ========================= */
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

   if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
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
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                Subtotal (Neto)
              </p>
              <p className="text-lg font-bold">{formatCLP(c?.subtotal)}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                IVA (19%)
              </p>
              <p className="text-lg font-bold">{formatCLP(c?.iva)}</p>
            </div>

            <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-600/10">
              <p className="text-[10px] uppercase font-bold text-blue-600/70 mb-1">
                Total
              </p>
              <p className="text-lg font-bold text-blue-600">
                {formatCLP(c?.total)}
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
                <p className="text-sm text-slate-600 leading-relaxed">
                  {c.asunto}
                </p>
              </div>
            ) : null}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Ítems de la Cotización
              </h4>
              <span className="text-xs text-slate-400">
                {items.length} ítem(s)
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Descripción
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">
                      Tipo
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">
                      Monto
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.id ?? idx}>
                      <td className="px-4 py-4">
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
                        {formatCLP(it.monto ?? it.total ?? it.precioUnitario)}
                      </td>
                    </tr>
                  ))}

                  {!items.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                        Esta cotización no tiene ítems.
                      </td>
                    </tr>
                  ) : null}
                </tbody>

                {!!items.length ? (
                  <tfoot className="bg-slate-100/50 font-semibold border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={2}>
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-right">{formatCLP(c?.subtotal)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={2}>
                        IVA 19%
                      </td>
                      <td className="px-4 py-3 text-right">{formatCLP(c?.iva)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 text-left text-slate-500" colSpan={2}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">{formatCLP(c?.total)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>

          {/* Historial placeholder (lo mejoras después) */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              Historial de Estados
            </h4>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                  <div className="w-px h-full bg-slate-200 my-1"></div>
                </div>
                <div className="pb-4">
                  <p className="text-xs font-bold">Estado: {estado}</p>
                  <p className="text-[10px] text-slate-400">
                    {c?.creada_en ? fechaCL(c.creada_en) : "—"} • Por: Sistema
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">
                    (Pendiente) Próximos estados
                  </p>
                </div>
              </div>
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

          {/* ✅ ABRE MENÚ MUI */}
          <button
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
            onClick={openEstadoMenu}
            disabled={!c?.id}
          >
            Cambiar Estado
          </button>
        </div>
      </div>

      {/* =========================
          MUI MENU: Cambiar Estado
      ========================= */}
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
            <ListItemText
              primary="Cotización finalizada"
              secondary={`Estado: ${estado}`}
            />
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
          <ListItemText
            primary="Editar cotización"
            secondary="Editar datos de la cotización"
          />
        </MenuItem>
      </Menu>

      {/* ===== Modal Aceptada ===== */}
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
          <Button
            variant="contained"
            startIcon={<ThumbUpAltOutlinedIcon />}
            onClick={confirmAceptada}
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Modal Rechazar ===== */}
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
          <Button
            variant="contained"
            color="error"
            startIcon={<ThumbDownAltOutlinedIcon />}
            onClick={confirmRechazar}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
