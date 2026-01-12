// src/components/ui/Modal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);
  const [portalEl, setPortalEl] = useState(null);

  // id único por instancia (estable)
  const portalId = useMemo(
    () => `modal-portal-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    setMounted(true);

    // crear contenedor propio para el portal
    const el = document.createElement("div");
    el.setAttribute("id", portalId);
    document.body.appendChild(el);
    setPortalEl(el);

    return () => {
      // cleanup seguro (evita parentNode null)
      try {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch {
        // no-op
      }
      setMounted(false);
      setPortalEl(null);
    };
  }, [portalId]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!mounted || !open || !portalEl) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={handleBackdropClick}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalEl);
}
