"use client";

import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function EmpleadoConfirmModal({
  open,
  action,
  targetEmp,
  loading,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  const nombre = targetEmp?.usuario?.nombre || "";

  let message = "";
  if (action === "disable") {
    message = `¿Seguro que quieres deshabilitar al empleado "${nombre}"? Podrás restaurarlo más adelante.`;
  } else if (action === "restore") {
    message = `¿Restaurar al empleado "${nombre}" y marcarlo como activo?`;
  } else if (action === "delete") {
    message = `Esta acción eliminará permanentemente al empleado "${nombre}". Si tiene rendiciones o tareas, recuerda que solo se permite con "?force=true".`;
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirmar acción">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}
