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
  InputAdornment
} from "@mui/material";

export default function NuevoPagoDialog({ open, onClose, session, cotizacionId, restanteAPagar, totalCotizacion, onCreated, showSnack }) {
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
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
    } else {
      setMonto("");
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
        body: JSON.stringify({ monto: Number(monto), fecha }),
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
