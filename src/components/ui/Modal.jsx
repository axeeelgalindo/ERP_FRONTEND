// src/components/ui/Modal.jsx
"use client";

import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export default function Modal({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // mientras carga en el cliente, no renderizamos nada
  if (!mounted || !open) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose?.();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="mx-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <span className="sr-only">Cerrar</span>
            ×
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );

  // portal al body (sin tocar parentNode a mano)
  return ReactDOM.createPortal(modalContent, document.body);
}
