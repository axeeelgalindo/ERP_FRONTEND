"use client";

import React, { useEffect } from "react";

export default function ModalBase({ open, title, onClose, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white  shadow-xl border border-slate-200 ">
        <div className="p-4 border-b border-slate-100  flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate text-slate-900 ">
              {title}
            </div>
          </div>

          <button
            className="h-9 w-9 rounded-lg border border-slate-200  hover:bg-slate-50 "
            onClick={onClose}
            type="button"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer ? (
          <div className="p-4 border-t border-slate-100 ">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}