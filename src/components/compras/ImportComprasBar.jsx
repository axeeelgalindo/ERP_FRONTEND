"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";

// MUI
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

// Icons
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FilePresentIcon from "@mui/icons-material/FilePresent";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

export default function ImportComprasBar({
  importing,
  importErr,
  importResult,
  onImport,
  onClearResult,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // toast
  const [toast, setToast] = useState({
    open: false,
    severity: "info",
    title: "",
    msg: "",
  });

  const fileLabel = useMemo(() => {
    if (!file) return "Seleccionar CSV";
    return file.name;
  }, [file]);

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const f = e.dataTransfer?.files?.[0] || null;
    if (!f) return;
    if (!String(f.name || "").toLowerCase().endsWith(".csv")) {
      setToast({
        open: true,
        severity: "error",
        title: "Archivo inválido",
        msg: "Debes subir un archivo .csv",
      });
      return;
    }
    setFile(f);
    onClearResult?.();
  }, [onClearResult]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  // ✅ cuando llega un importResult, disparar un toast NOTORIO según resultado
  useEffect(() => {
    if (!importResult) return;

    const created = Number(importResult.created ?? 0);
    const skipped = Number(importResult.skipped ?? 0);
    const errors = Number(importResult.errorsCount ?? 0);

    if (errors > 0) {
      setToast({
        open: true,
        severity: "error",
        title: "Importación con errores",
        msg: `Se detectaron ${errors} errores. Revisa el detalle.`,
      });
      return;
    }

    // Caso clave: TODO repetido
    if (created === 0 && skipped > 0) {
      setToast({
        open: true,
        severity: "warning",
        title: "CSV ya importado",
        msg: `No se creó nada porque ${skipped} filas ya existían (saltadas).`,
      });
      return;
    }

    // Importación normal
    if (created > 0) {
      setToast({
        open: true,
        severity: "success",
        title: "Importación exitosa",
        msg: `Creadas ${created} compras. Saltadas ${skipped}.`,
      });
      return;
    }

    // fallback
    setToast({
      open: true,
      severity: "info",
      title: "Importación terminada",
      msg: `Total filas: ${importResult.totalRows ?? 0}`,
    });
  }, [importResult]);

  // ✅ si hay importErr, toast
  useEffect(() => {
    if (!importErr) return;
    setToast({
      open: true,
      severity: "error",
      title: "Error importando CSV",
      msg: String(importErr),
    });
  }, [importErr]);

  // ===== estilos visuales del resultado =====
  const resultTone = useMemo(() => {
    if (!importResult) return null;

    const created = Number(importResult.created ?? 0);
    const skipped = Number(importResult.skipped ?? 0);
    const errors = Number(importResult.errorsCount ?? 0);

    if (errors > 0) return "error";
    if (created === 0 && skipped > 0) return "warning";
    if (created > 0) return "success";
    return "info";
  }, [importResult]);

  const resultIcon = useMemo(() => {
    if (resultTone === "success") return <CheckCircleIcon fontSize="small" />;
    if (resultTone === "warning") return <WarningAmberIcon fontSize="small" />;
    if (resultTone === "error") return <ErrorOutlineIcon fontSize="small" />;
    return <UploadFileIcon fontSize="small" />;
  }, [resultTone]);

  return (
    <div className="space-y-3">
      {/* ===== Dropzone ===== */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "rounded-xl border p-4 md:p-5 transition",
          "bg-slate-50/60",
          dragOver ? "border-slate-400 ring-2 ring-slate-200" : "border-dashed border-slate-300",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <UploadFileIcon fontSize="small" />
              Arrastra un CSV aquí o selecciónalo
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Formato esperado: CSV con separador “;” y columnas RCV.
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Tip: si vuelves a importar el mismo documento (mismo proveedor + tipo doc + folio),
              se marcará como <b>saltado</b>.
            </div>
          </div>

          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
            {file ? (
              <Chip
                icon={<FilePresentIcon />}
                label={fileLabel}
                variant="outlined"
                sx={{ borderRadius: 2 }}
              />
            ) : (
              <Chip
                icon={<FilePresentIcon />}
                label="Sin archivo"
                variant="outlined"
                sx={{ borderRadius: 2, opacity: 0.75 }}
              />
            )}

            <Button
              variant="outlined"
              onClick={pickFile}
              disabled={importing}
              startIcon={<UploadFileIcon />}
              sx={{ borderRadius: 2, textTransform: "none" }}
            >
              Seleccionar
            </Button>

            <Button
              variant="contained"
              onClick={() => file && onImport(file)}
              disabled={!file || importing}
              startIcon={<CloudUploadIcon />}
              sx={{ borderRadius: 2, textTransform: "none" }}
            >
              {importing ? "Importando…" : "Importar"}
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && !String(f.name || "").toLowerCase().endsWith(".csv")) {
                  setToast({
                    open: true,
                    severity: "error",
                    title: "Archivo inválido",
                    msg: "Debes subir un archivo .csv",
                  });
                  return;
                }
                setFile(f);
                onClearResult?.();
              }}
            />
          </Stack>
        </div>
      </div>

      {/* ===== Resultado NOTORIO ===== */}
      {importResult && (
        <Alert
          severity={resultTone || "info"}
          icon={resultIcon}
          sx={{
            borderRadius: 3,
            py: 2,
            "& .MuiAlert-message": { width: "100%" },
          }}
          action={
            <Button
              color="inherit"
              variant="outlined"
              size="small"
              startIcon={<DeleteSweepIcon />}
              sx={{ borderRadius: 2, textTransform: "none" }}
              onClick={() => {
                setFile(null);
                onClearResult?.();
              }}
            >
              Limpiar
            </Button>
          }
        >
          <div className="font-semibold">
            {resultTone === "warning"
              ? "⚠️ CSV ya estaba importado"
              : resultTone === "success"
              ? "✅ Importación terminada"
              : resultTone === "error"
              ? "⛔ Importación con errores"
              : "Importación terminada"}
          </div>

          <div className="mt-1">
            Total filas: <b>{importResult.totalRows}</b> · Creadas:{" "}
            <b>{importResult.created}</b> · Saltadas:{" "}
            <b>{importResult.skipped}</b> · Errores:{" "}
            <b>{importResult.errorsCount}</b>
          </div>

          {/* Mensaje extra para el caso repetido */}
          {resultTone === "warning" && (
            <div className="mt-2 text-sm">
              No se creó ninguna compra porque el sistema detectó que ya existían esos documentos.
              Si necesitas reimportar, elimina primero esas compras o cambia el criterio de duplicidad.
            </div>
          )}

          {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
            <div className="mt-3">
              <div className="font-semibold">Primeros errores:</div>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {importResult.errors.slice(0, 10).map((e, idx) => (
                  <li key={idx}>
                    Fila {e.row}: {e.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      )}

      {/* ===== TOAST / SNACKBAR ===== */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          <div className="font-semibold">{toast.title}</div>
          <div>{toast.msg}</div>
        </Alert>
      </Snackbar>
    </div>
  );
}
