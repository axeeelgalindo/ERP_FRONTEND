"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

import {
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Stack,
  Typography,
  LinearProgress,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ImportJiraCsvButton({ proyectoId, onDone }) {
  const router = useRouter();
  const { data: session } = useSession();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);

  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [overwrite, setOverwrite] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => {
    return !!session?.user && !!proyectoId && !!file && !loading;
  }, [session, proyectoId, file, loading]);

  const close = () => {
    setOpen(false);
    setErr("");
    setResult(null);
    setFile(null);
    setHoursPerDay(8);
    setOverwrite(true);
  };

  const handleImport = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      setErr("");
      setResult(null);

      // multipart/form-data => NO setear Content-Type manualmente
      const headers = { ...makeHeaders(session) };
      delete headers["Content-Type"];
      delete headers["content-type"];

      const fd = new FormData();
      fd.append("file", file);

      const url = new URL(`${API}/proyectos/${proyectoId}/jira/import`);
      url.searchParams.set("hoursPerDay", String(Number(hoursPerDay) || 8));
      url.searchParams.set("overwrite", overwrite ? "true" : "false");

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: fd,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || json?.msg || "Error importando CSV");
      }

      setResult(json);
      // refresca la vista del proyecto para ver tareas nuevas
      router.refresh();
      onDone?.(json);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<UploadFileIcon />}
        onClick={() => setOpen(true)}
      >
        Importar Jira (CSV)
      </Button>

      <Modal open={open} onClose={close} title="Importar cronograma desde Jira (CSV)">
        <div className="space-y-4">
          <Typography variant="body2" color="text.secondary">
            Sube el CSV exportado desde Jira. Se crearán/actualizarán tareas y subtareas.
          </Typography>

          {loading && <LinearProgress />}

          {err && <Alert severity="error">{err}</Alert>}

          {result?.summary && (
            <Alert severity="success">
              Importación OK. {JSON.stringify(result.summary)}
            </Alert>
          )}

          <Stack spacing={2}>
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={loading}
            >
              {file ? `Archivo: ${file.name}` : "Seleccionar CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Button>

            <TextField
              label="Horas por día"
              type="number"
              size="small"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              inputProps={{ min: 1, max: 24 }}
              disabled={loading}
              helperText="Ej: 8. Si una tarea dura 3 días => 24 HH."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Sobrescribir (overwrite)"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!canSubmit}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Importar
              </button>
            </div>
          </Stack>
        </div>
      </Modal>
    </>
  );
}
