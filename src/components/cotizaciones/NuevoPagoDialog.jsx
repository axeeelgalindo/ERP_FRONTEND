import { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  CircularProgress,
  InputAdornment,
  Switch,
  FormControlLabel
} from "@mui/material";

export default function NuevoPagoDialog({ open, onClose, session, cotizacionId, restanteAPagar, totalCotizacion, onCreated, showSnack }) {
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [isFactoring, setIsFactoring] = useState(false);
  const [factoringPct, setFactoringPct] = useState("");
  const [factoringMonto, setFactoringMonto] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fileInputRef = useRef(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const handleMontoChange = (val) => {
    let num = Number(val);
    if (restanteAPagar !== undefined && num > restanteAPagar) {
      val = String(restanteAPagar);
      num = restanteAPagar;
    }
    setMonto(val);
    if (val !== "" && !isNaN(num) && totalCotizacion > 0) {
      const p = (num / totalCotizacion) * 100;
      setPorcentaje(String(parseFloat(p.toFixed(2)))); // limit decimal precision
    } else {
      setPorcentaje("");
    }

    if (isFactoring && factoringPct !== "" && !isNaN(num) && num > 0) {
      const desc = Math.round((Number(factoringPct) / 100) * num);
      setFactoringMonto(String(desc));
    }
  };

  const handlePorcentajeChange = (val) => {
    let p = Number(val);
    const maxP = totalCotizacion > 0 ? (restanteAPagar / totalCotizacion) * 100 : 100;
    if (restanteAPagar !== undefined && p > maxP) {
      p = maxP;
      val = String(parseFloat(p.toFixed(2)));
    }
    setPorcentaje(val);
    if (val !== "" && !isNaN(p) && totalCotizacion > 0) {
      const m = Math.round((p / 100) * totalCotizacion);
      setMonto(String(m));
      if (isFactoring && factoringPct !== "") {
        const desc = Math.round((Number(factoringPct) / 100) * m);
        setFactoringMonto(String(desc));
      }
    } else {
      setMonto("");
    }
  };

  const handleFactoringPctChange = (val) => {
    setFactoringPct(val);
    const p = Number(val);
    const mNum = Number(monto);
    if (val !== "" && !isNaN(p) && !isNaN(mNum) && mNum > 0) {
      const desc = Math.round((p / 100) * mNum);
      setFactoringMonto(String(desc));
    } else {
      setFactoringMonto("");
    }
  };

  const handleFactoringMontoChange = (val) => {
    let num = Number(val);
    const mNum = Number(monto);
    if (mNum > 0 && num > mNum) {
      num = mNum;
      val = String(mNum);
    }
    setFactoringMonto(val);
    if (val !== "" && !isNaN(num) && !isNaN(mNum) && mNum > 0) {
      const p = (num / mNum) * 100;
      setFactoringPct(String(parseFloat(p.toFixed(2))));
    } else {
      setFactoringPct("");
    }
  };

  const handleToggleFactoring = (e) => {
    const checked = e.target.checked;
    setIsFactoring(checked);
    if (!checked) {
      setFactoringPct("");
      setFactoringMonto("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!monto || Number(monto) <= 0) {
      setErr("El monto debe ser mayor a 0");
      return;
    }
    if (restanteAPagar !== undefined && Number(monto) > restanteAPagar) {
      setErr(`El monto no puede superar el restante a pagar ($${restanteAPagar.toLocaleString("es-CL")})`);
      return;
    }

    if (isFactoring && factoringMonto && Number(factoringMonto) > Number(monto)) {
      setErr("El descuento de factoring no puede superar el monto del pago");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;
      
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      // 1. Crear el pago
      const res = await fetch(`${API_URL}/cotizaciones/${cotizacionId}/pagos`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          monto: Number(monto), 
          fecha,
          is_factoring: isFactoring,
          factoring_descuento_pct: isFactoring && factoringPct !== "" ? Number(factoringPct) : null,
          factoring_descuento_monto: isFactoring && factoringMonto !== "" ? Number(factoringMonto) : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al registrar el pago");

      const pagoId = data.id;

      // 2. Subir comprobante si existe
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        
        const uploadHeaders = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        };

        const uploadRes = await fetch(`${API_URL}/cotizaciones/pagos/${pagoId}/upload/comprobante`, {
          method: "POST",
          headers: uploadHeaders,
          body: fd
        });

        if (!uploadRes.ok) {
          showSnack("warning", "El pago se creó pero hubo un error al subir el comprobante");
        } else {
          showSnack("success", "Pago registrado y comprobante subido");
        }
      } else {
        showSnack("success", "Pago registrado correctamente");
      }

      onCreated();
      handleClose();

    } catch (e) {
      setErr(e.message || "Error al procesar la solicitud");
      showSnack("error", e.message || "Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMonto("");
    setPorcentaje("");
    setFecha(new Date().toISOString().slice(0, 10));
    setIsFactoring(false);
    setFactoringPct("");
    setFactoringMonto("");
    setFile(null);
    setErr("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar Nuevo Pago</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={3}>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Monto Pagado"
                type="number"
                value={monto}
                onChange={(e) => handleMontoChange(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputProps: { min: 0, step: 1 }
                }}
                required
                fullWidth
              />
              <TextField
                label="Porcentaje (%)"
                type="number"
                value={porcentaje}
                onChange={(e) => handlePorcentajeChange(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  inputProps: { min: 0, step: "any" }
                }}
                required
                fullWidth
              />
            </div>
            
            <TextField
              label="Fecha de Pago"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <FormControlLabel
                control={
                  <Switch
                    checked={isFactoring}
                    onChange={handleToggleFactoring}
                    color="primary"
                  />
                }
                label={
                  <span className="text-sm font-semibold text-slate-800">
                    ¿Pago realizado a través de Factoring?
                  </span>
                }
              />

              {isFactoring && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4">
                    <TextField
                      label="% Descuento Factoring"
                      type="number"
                      value={factoringPct}
                      onChange={(e) => handleFactoringPctChange(e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        inputProps: { min: 0, max: 100, step: "any" }
                      }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Monto Descuento ($)"
                      type="number"
                      value={factoringMonto}
                      onChange={(e) => handleFactoringMontoChange(e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        inputProps: { min: 0, step: 1 }
                      }}
                      fullWidth
                      size="small"
                    />
                  </div>

                  {Number(monto) > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded p-2.5 text-xs text-amber-950 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Abono a Factura:</span>
                        <span className="font-semibold">${Number(monto).toLocaleString("es-CL")}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Descuento Factoring:</span>
                        <span className="font-semibold">-${Number(factoringMonto || 0).toLocaleString("es-CL")}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800 border-t border-amber-200/80 pt-1 mt-1 text-sm">
                        <span>Ingreso Real Líquido:</span>
                        <span>${Math.max(0, Number(monto || 0) - Number(factoringMonto || 0)).toLocaleString("es-CL")}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Comprobante de Pago (Opcional)
              </label>
              <div className="flex items-center gap-3">
                <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
                  Seleccionar Archivo
                </Button>
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <span className="text-sm text-slate-500">
                  {file ? file.name : "Ningún archivo seleccionado"}
                </span>
              </div>
            </div>

            {err && (
              <div className="text-red-600 text-sm font-medium">
                {err}
              </div>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
            Registrar Pago
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
