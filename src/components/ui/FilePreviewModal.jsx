"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  CircularProgress,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";

/**
 * FilePreviewer: Componente interno que maneja la lógica de renderizado según el tipo de archivo.
 */
const FilePreviewer = ({ url }) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [xlsxData, setXlsxData] = useState(null);

  useEffect(() => {
    if (!url) return;

    const isDocx = url.toLowerCase().endsWith(".docx");
    const isXlsx = url.toLowerCase().endsWith(".xlsx");

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
            inWrapper: false,
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
        <img
          src={url}
          alt="Documento"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "8px",
          }}
        />
      </div>
    );
  }

  if (url.toLowerCase().endsWith(".pdf")) {
    return (
      <iframe
        src={url}
        width="100%"
        height="100%"
        title="Visor PDF"
        style={{ border: "none" }}
      />
    );
  }

  return (
    <div className="relative w-full h-full overflow-auto bg-white p-4">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 gap-3 flex-col">
          <CircularProgress size={32} />
          <p className="text-sm font-medium text-slate-500">
            Procesando vista previa...
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-500">
          <p>{error}</p>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            sx={{ mt: 2 }}
            href={url}
            target="_blank"
            download
          >
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
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        />
      )}

      {!loading &&
        !error &&
        !xlsxData &&
        !url.match(/\.(docx|pdf|jpeg|jpg|gif|png)$/i) && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <VisibilityOutlinedIcon fontSize="large" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Previsualización no disponible
            </h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Este formato de archivo no puede procesarse en el navegador. Por
              favor, descárgalo para verlo.
            </p>
            <Button variant="contained" href={url} target="_blank" download>
              Descargar Archivo
            </Button>
          </div>
        )}
    </div>
  );
};

/**
 * FilePreviewModal: Modal principal que utiliza Material UI Dialog.
 */
export default function FilePreviewModal({ open, onClose, url, title = "Visor de Documento" }) {
  if (!url && !open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: (t) => t.zIndex.modal + 100 }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 2,
        }}
      >
        <span className="text-base font-bold text-slate-800">{title}</span>
        <Button onClick={onClose} color="inherit" size="small">
          Cerrar
        </Button>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 0,
          height: "75vh",
          backgroundColor: "#f8fafc",
          overflow: "hidden",
        }}
      >
        {url && <FilePreviewer url={url} />}
      </DialogContent>
    </Dialog>
  );
}
