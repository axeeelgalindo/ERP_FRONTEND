"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function DropdownPortal({
  open,
  anchorRef,
  onClose,
  children,
  width = 224,
  offset = 8,
}) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => setMounted(true), []);

  // ✅ cerrar al click fuera / ESC (en CAPTURE para que sea consistente)
  useEffect(() => {
    if (!open) return;

    function onDown(e) {
      const a = anchorRef?.current;
      const p = panelRef.current;
      if (!a || !p) return;

      // ✅ si clickeas dentro del botón o dentro del panel -> NO cerrar
      if (a.contains(e.target) || p.contains(e.target)) return;

      onClose?.();
    }

    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }

    document.addEventListener("mousedown", onDown, true); // ✅ capture
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const a = anchorRef?.current;
    if (!a) return;

    const r = a.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = r.right - width;
    let top = r.bottom + offset;

    left = Math.max(8, Math.min(left, viewportW - width - 8));

    const estimatedH = 140;
    if (top + estimatedH > viewportH - 8) {
      top = r.top - offset - estimatedH;
      top = Math.max(8, top);
    }

    setPos({ top, left });

    function recalc() {
      const r2 = a.getBoundingClientRect();
      let left2 = r2.right - width;
      let top2 = r2.bottom + offset;

      left2 = Math.max(8, Math.min(left2, window.innerWidth - width - 8));

      if (top2 + estimatedH > window.innerHeight - 8) {
        top2 = r2.top - offset - estimatedH;
        top2 = Math.max(8, top2);
      }

      setPos({ top: top2, left: left2 });
    }

    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [open, anchorRef, width, offset]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width,
        zIndex: 9999,
      }}
      className="bg-white border border-slate-200  rounded-xl shadow-xl p-2"
      // ✅ evita que el mousedown “suba” y lo tome el listener global
      onMouseDownCapture={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
