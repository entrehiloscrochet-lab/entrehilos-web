"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ProduccionRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const cleanSearch = search.replace(/^\?/, "");
    const target = cleanSearch ? `/admin?seccion=produccion&${cleanSearch}` : "/admin?seccion=produccion";
    router.replace(target);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FDF4F7] flex flex-col items-center justify-center p-4">
      <Loader2 size={32} className="animate-spin text-[#EE6B8D] mb-3" />
      <span className="font-quicksand text-xs sm:text-sm font-semibold text-gray-600">
        Cargando Sistema de Producción, Costeo y Punto de Equilibrio...
      </span>
    </div>
  );
}
