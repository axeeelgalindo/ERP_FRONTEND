// src/components/common/BackButton.jsx
"use client";

import { ArrowLeft } from "lucide-react";

export default function BackButton({ className = "" }) {
  function goBack() {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={className}
    >
      <ArrowLeft size={16} />
      <span>Volver atrás</span>
    </button>
  );
}
