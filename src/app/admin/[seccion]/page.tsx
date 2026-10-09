"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminSeccionPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const seccionRaw = params?.seccion;
    const seccion = Array.isArray(seccionRaw) ? seccionRaw[0] : seccionRaw || "dashboard";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const cleanSearch = search.replace(/^\?/, "");
    const target = cleanSearch ? `/admin?seccion=${seccion}&${cleanSearch}` : `/admin?seccion=${seccion}`;
    router.replace(target);
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#FDF4F7] flex flex-col items-center justify-center p-4">
      <Loader2 size={32} className="animate-spin text-[#EE6B8D] mb-3" />
      <span className="font-quicksand text-xs sm:text-sm font-semibold text-gray-600">
        Cargando sección del panel...
      </span>
    </div>
  );
}
