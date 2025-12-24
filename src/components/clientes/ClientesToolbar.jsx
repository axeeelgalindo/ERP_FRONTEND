"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

export default function ClientesToolbar({
  q, onQChange,
  onCreateClick,
  canCreate = false,
}) {
  const [v, setV] = useState(q || "");

  useEffect(() => { setV(q || ""); }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-sm w-full">
        <input
          value={v}
          onChange={(e) => {
            const nv = e.target.value;
            setV(nv);
            onQChange?.(nv);
          }}
          placeholder="Buscar por nombre, RUT o correo…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
        <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
      </div>

      {canCreate && (
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Nuevo cliente
        </button>
      )}
    </div>
  );
}
