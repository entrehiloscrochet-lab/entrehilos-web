'use client';

import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { FileDown } from "lucide-react";

export default function WhatsAppButton() {
  const pathname = usePathname();
  const [showWspTooltip, setShowWspTooltip] = useState(false);
  const [showCatalogTooltip, setShowCatalogTooltip] = useState(false);
  const [currentEvento, setCurrentEvento] = useState<any | null>(null);

  const whatsappNumber = "51902578295";
  const generalWspMessage = "¡Hola Entre Hilos! Quiero más información sobre sus productos artesanales.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(generalWspMessage)}`;

  useEffect(() => {
    let isMounted = true;
    async function loadEventoData() {
      try {
        const res = await fetch("/api/eventos");
        if (!res.ok) return;
        const eventos: any[] = await res.json();
        if (!isMounted || !Array.isArray(eventos) || eventos.length === 0) return;

        const activos = eventos.filter((e) => e.activo !== false && e.catalogo_boton_visible !== false);

        // En página de evento específico: usar ese evento si tiene catálogo
        if (pathname?.startsWith("/evento/")) {
          const slug = pathname.replace("/evento/", "").split("/")[0]?.trim();
          const match = activos.find((e) => e.slug === slug);
          if (match) {
            setCurrentEvento(match);
            return;
          }
        }

        // En portada: buscar el mejor evento CON catálogo real cargado
        // Prioridad: destacado_rotonda con catálogo → featured con catálogo → cualquiera con catálogo
        const conCatalogo = activos.filter((e) => Boolean(e.catalogo_url));

        const rotondaConCatalogo = conCatalogo.find((e) => e.destacado_rotonda === true);
        if (rotondaConCatalogo) { setCurrentEvento(rotondaConCatalogo); return; }

        const featuredConCatalogo = conCatalogo.find((e) => e.featured === true);
        if (featuredConCatalogo) { setCurrentEvento(featuredConCatalogo); return; }

        if (conCatalogo.length > 0) { setCurrentEvento(conCatalogo[0]); return; }

        // Sin catálogo: no mostrar botón (currentEvento = null)
        setCurrentEvento(null);
      } catch (err) {
        console.error("Error al cargar evento para catálogo:", err);
      }
    }

    loadEventoData();
    return () => { isMounted = false; };
  }, [pathname]);

  // El botón solo se muestra si hay un evento con catálogo real y el toggle está activo
  const showCatalogButton =
    Boolean(currentEvento?.catalogo_url) &&
    currentEvento?.catalogo_boton_visible !== false &&
    (pathname === "/" || pathname?.startsWith("/evento"));

  // Formato del badge: PDF / PPT / IMG
  const catalogBadge = (() => {
    if (!currentEvento?.catalogo_url) return "PDF";
    const clean = currentEvento.catalogo_url.split("?")[0].toLowerCase();
    if (clean.endsWith(".ppt") || clean.endsWith(".pptx")) return "PPT";
    if (/\.(png|jpe?g|webp|avif)$/i.test(clean)) return "IMG";
    return "PDF";
  })();

  const isDirectFile = Boolean(
    currentEvento?.catalogo_url &&
    /\.(pdf|ppt|pptx|png|jpe?g|webp|avif)($|\?)/i.test(currentEvento.catalogo_url)
  );

  // Siempre descarga/abre directamente — nunca redirige a WhatsApp
  const catalogoHref = currentEvento?.catalogo_url ?? "#";


  return (
    <aside aria-label="Accesos rápidos flotantes" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
      
      {/* 1. Botón Flotante: Descargar / Ver Catálogo del Evento */}
      {showCatalogButton && (
        <div className="relative pointer-events-auto flex items-center group">
          {/* Tooltip en desktop */}
          {showCatalogTooltip && (
            <div className="hidden md:block absolute right-full mr-3 px-3.5 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-lato font-medium rounded-lg whitespace-nowrap shadow-xl animate-in fade-in duration-200">
              {`Descargar Catálogo · ${currentEvento?.nombre}`}
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-gray-900/95 rotate-45" />
            </div>
          )}

          <a
            href={catalogoHref}
            target="_blank"
            rel="noopener noreferrer"
            download={isDirectFile}
            onMouseEnter={() => setShowCatalogTooltip(true)}
            onMouseLeave={() => setShowCatalogTooltip(false)}
            className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full shadow-lg bg-gradient-to-tr from-[#982B4D] via-[#C04267] to-[#EE6B8D] text-white hover:shadow-[0_8px_25px_rgba(192,66,103,0.45)] hover:-translate-y-1.5 transition-all duration-300 border-2 border-white/40"
            aria-label={`Descargar Catálogo ${currentEvento?.nombre || ""}`}
          >
            <FileDown className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5" />
            
            {/* Pequeño distintivo indicador PDF / PPT / IMG */}
            <span className="absolute -top-1 -left-1 bg-amber-400 text-gray-900 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-xs border border-white">
              {catalogBadge}
            </span>
          </a>
        </div>
      )}

      {/* 2. Botón Flotante: WhatsApp */}
      <div className="relative pointer-events-auto flex items-center group">
        {/* Tooltip en desktop */}
        {showWspTooltip && (
          <div className="hidden md:block absolute right-full mr-3 px-3.5 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-lato font-medium rounded-lg whitespace-nowrap shadow-xl animate-in fade-in duration-200">
            ¿Consultas? Escríbenos
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-gray-900/95 rotate-45" />
          </div>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setShowWspTooltip(true)}
          onMouseLeave={() => setShowWspTooltip(false)}
          className="group flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-[#25D366] rounded-full shadow-lg hover:shadow-[0_8px_25px_rgba(37,211,102,0.4)] hover:-translate-y-1.5 transition-all duration-300"
          aria-label="Contactar por WhatsApp"
        >
          <Image
            src="/Wspicono.png"
            alt="WhatsApp"
            width={36}
            height={36}
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"
          />
        </a>
      </div>

    </aside>
  );
}