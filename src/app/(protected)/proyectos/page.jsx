// src/app/(protected)/proyectos/page.jsx
import { serverApi } from "@/lib/api";
import ProyectosPageClient from "@/components/proyectos/ProyectosPageClient";

export default async function ProyectosPage({ searchParams }) {
  const sp = await searchParams;

  const page = sp?.page ? Number(sp.page) : 1;
  const pageSize = sp?.pageSize ? Number(sp.pageSize) : 10;

  let items = [];
  let total = 0;

  try {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    }).toString();

    const data = await serverApi(`/proyectos?${qs}`);

    items = data?.items ?? [];
    total = data?.total ?? items.length;
  } catch (err) {
    console.error("Error cargando proyectos:", err.message);
    // 👇 evita que el Server Component crashee por ECONNREFUSED
    items = [];
    total = 0;
  }

  return (
    <ProyectosPageClient
      items={items}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}