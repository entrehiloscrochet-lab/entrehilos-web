"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, Eye, ArrowRight, MessageCircle } from "lucide-react";
import { isProductInSlug } from "@/lib/catalogos";
import { Product } from "@/lib/ventify";

interface RotondaEvento {
  slug?: string;
  nombre?: string;
  featured?: boolean;
  activo?: boolean;
}

interface CustomCatalogImage {
  id?: string;
  titulo?: string;
  title?: string;
  nombre?: string;
  precio?: number | string;
  price?: number | string;
  imagen?: string;
  image?: string;
  url?: string;
  categoria?: string;
  descripcion?: string;
}

interface RotondaSectionItems {
  evento_slug?: string;
  custom_catalog_images?: CustomCatalogImage[];
  selected_product_ids?: string[];
  limite?: number;
}

interface RotondaSection {
  activo?: boolean;
  titulo?: string;
  subtitulo?: string;
  descripcion?: string;
  items?: RotondaSectionItems;
}

export interface EventoProductosRotondaSectionProps {
  section?: RotondaSection;
  eventoActual?: RotondaEvento | null;
  products?: Product[];
  eventosData?: RotondaEvento[];
  onQuickView?: (product: Product) => void;
}

interface DisplayItem {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  categoria: string;
  descripcion?: string;
  isProduct: boolean;
  rawProduct?: Product;
}

function getWhatsAppLink(item: DisplayItem, eventoNombre?: string) {
  const precioText = item.precio > 0 ? ` (S/ ${item.precio.toFixed(2)})` : "";
  const text = encodeURIComponent(
    `¡Hola Entre Hilos! Me interesa *${item.nombre}*${precioText}${eventoNombre ? ` de la campaña ${eventoNombre}` : ""}. ¿Tienen disponibilidad?`
  );
  return `https://wa.me/51902578295?text=${text}`;
}

export default function EventoProductosRotondaSection({
  section,
  eventoActual,
  products = [],
  eventosData = [],
  onQuickView,
}: EventoProductosRotondaSectionProps) {
  const seccionInactiva = Boolean(section && section.activo === false);

  // 1. Determinar el EVENTO PRINCIPAL:
  // Prioriza el evento marcado como featured: true (evento principal activo en la tienda y navbar)
  const eventoPrincipal = (() => {
    const configuredSlug = section?.items?.evento_slug;
    if (configuredSlug && configuredSlug !== "auto" && Array.isArray(eventosData) && eventosData.length > 0) {
      const found = eventosData.find((e) => e.slug?.toLowerCase() === configuredSlug.toLowerCase());
      if (found) return found;
    }
    if (Array.isArray(eventosData) && eventosData.length > 0) {
      const feat = eventosData.find((e) => e.featured === true && e.activo !== false);
      if (feat) return feat;
      const act = eventosData.find((e) => e.activo !== false);
      if (act) return act;
      return eventosData[0];
    }
    return eventoActual || null;
  })();

  const eventoSlug = (eventoPrincipal?.slug || "dia-del-novio").toLowerCase();
  const eventoNombre = eventoPrincipal?.nombre || "Campaña Especial";

  // 2. Obtener imágenes de catálogo subidas manualmente desde el Admin
  const rawCustomImages = section?.items?.custom_catalog_images;
  const customImages: CustomCatalogImage[] = Array.isArray(rawCustomImages)
    ? rawCustomImages
    : [];

  // 3. Obtener productos elegidos o asignados al evento principal
  const rawSelectedProductIds = section?.items?.selected_product_ids;
  const selectedProductIds: string[] = Array.isArray(rawSelectedProductIds)
    ? rawSelectedProductIds
    : [];
  const selectedSet = new Set(selectedProductIds);

  const limite = section?.items?.limite;
  const maxItems = typeof limite === "number" && limite > 0
    ? limite
    : 8;

  // Filtrar productos: si el admin eligió productos específicos, tomamos esos;
  // de lo contrario, tomamos automáticamente los productos vinculados al evento principal
  let matchingProducts = (products || []).filter((p) => {
    if (p.is_active === false) return false;
    if (selectedSet.size > 0) {
      return selectedSet.has(p.id) || selectedSet.has(p.sku);
    }
    if (Array.isArray(p.catalogos) && p.catalogos.includes(eventoSlug)) return true;
    return isProductInSlug(p, eventoSlug);
  });

  // Fallback a ramos si el evento principal no tiene productos aún y no hay imágenes subidas
  if (matchingProducts.length === 0 && selectedSet.size === 0 && customImages.length === 0) {
    matchingProducts = (products || []).filter((p) => {
      if (p.is_active === false) return false;
      if (Array.isArray(p.catalogos) && p.catalogos.includes("ramos")) return true;
      return isProductInSlug(p, "ramos");
    });
  }

  // Normalizar items para la rotonda
  const customItems: DisplayItem[] = customImages.map((c, idx) => ({
    id: c.id || `custom-${idx}`,
    nombre: c.titulo || c.title || c.nombre || eventoNombre,
    precio: Number(c.precio ?? c.price ?? 0),
    imagen: c.imagen || c.image || c.url || "/logo.png",
    categoria: c.categoria || eventoNombre,
    descripcion: c.descripcion || "",
    isProduct: false,
  }));

  const productItems: DisplayItem[] = matchingProducts.map((p) => ({
    id: String(p.id || p.sku),
    nombre: p.nombre,
    precio: Number(p.precio || 0),
    imagen: p.imagen || "/logo.png",
    categoria: p.categoria || eventoNombre,
    descripcion: p.descripcion || "",
    isProduct: true,
    rawProduct: p,
  }));

  // Combinar imágenes de catálogo subidas y productos elegidos
  const baseItems: DisplayItem[] = [...customItems, ...productItems].slice(0, maxItems);

  // REGLA DE CARRUSEL:
  // - Si tiene MÁS de 3 productos o imágenes (> 3): en desktop se muestran 4 visibles (2 al centro y 2 a los costados)
  // - Si tiene ÚNICAMENTE 3 productos o imágenes (= 3): se muestran exactamente 3 (1 adelante y dos a los costados), SIN duplicar
  // - Si tiene menos de 3 (1 o 2): duplicar cíclicamente hasta 3 para permitir el giro
  let displayItems = [...baseItems];
  if (baseItems.length > 0 && displayItems.length < 3) {
    while (displayItems.length < 3) {
      displayItems = [...displayItems, ...baseItems];
    }
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const total = displayItems.length;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Rotación automática cada 5.5s cuando no está en hover
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(nextSlide, 5500);
    return () => clearInterval(timer);
  }, [isHovered, nextSlide]);

  if (seccionInactiva || baseItems.length === 0) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 40) {
      if (touchDeltaX.current > 0) prevSlide();
      else nextSlide();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Textos y títulos de la sección
  const titulo = section?.titulo && section.titulo.trim() !== ""
    ? section.titulo.replace("{evento}", eventoNombre)
    : `Colección ${eventoNombre}`;

  const subtitulo = section?.subtitulo && section.subtitulo.trim() !== ""
    ? section.subtitulo.replace("{evento}", eventoNombre)
    : `Catálogo Especial · ${eventoNombre}`;

  const descripcion = section?.descripcion && section.descripcion.trim() !== ""
    ? section.descripcion.replace("{evento}", eventoNombre)
    : `Descubre los ramos, arreglos y creaciones exclusivas tejidas a mano para celebrar en grande esta temporada.`;

  const eventoLink = `/evento/${eventoSlug}`;

  return (
    <section
      className="py-14 sm:py-20 px-2 sm:px-6 xl:px-10 overflow-hidden relative w-full border-b border-[#FDE8EF]"
      style={{ backgroundColor: "#FDF4F7" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-full max-w-[96rem] mx-auto">
        {/* Cabecera con tipografía oficial */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 px-4">
          <span className="font-lato text-xs tracking-[0.2em] uppercase font-bold text-[#C04267]">
            {subtitulo}
          </span>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-semibold mt-2 mb-3 text-[#C04267]">
            {titulo}
          </h2>
          {descripcion && (
            <p className="font-lato text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {descripcion}
            </p>
          )}
        </div>

        {/* Carrusel Rotonda 3D de Productos */}
        <div
          className="relative w-full max-w-6xl xl:max-w-7xl mx-auto h-[380px] sm:h-[420px] md:h-[460px] lg:h-[510px] xl:h-[530px] flex items-center justify-center select-none"
          style={{ perspective: "1300px" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {displayItems.map((item, idx) => {
            const diff = (idx - activeIndex + total) % total;

            let transform = "";
            let zIndex = 10;
            let opacity = 0;
            let pointerEvents: "auto" | "none" = "none";
            let isHighlight = false;

            // CASO 1: MODO RESPONSIVO (CELULAR / PANTALLAS PEQUEÑAS)
            // Exactamente como estaba originalmente con efecto 3D, rotación y profundidad
            if (isMobile) {
              if (diff === 0) {
                // 1 ADELANTE / CENTRO RESALTADO
                transform = "translate3d(0, 0, 15px) scale(1) rotateY(0deg)";
                zIndex = 30;
                opacity = 1;
                pointerEvents = "auto";
                isHighlight = true;
              } else if (diff === 1) {
                // COSTADO DERECHO: Curvatura 3D armónica
                transform = "translate3d(58%, 0, -60px) scale(0.85) rotateY(-18deg)";
                zIndex = 20;
                opacity = 0.88;
                pointerEvents = "auto";
              } else if (diff === total - 1) {
                // COSTADO IZQUIERDO: Simétrico y continuo
                transform = "translate3d(-58%, 0, -60px) scale(0.85) rotateY(18deg)";
                zIndex = 20;
                opacity = 0.88;
                pointerEvents = "auto";
              } else {
                // RESTO OCULTO
                transform = "translate3d(0, 0, -220px) scale(0.65) rotateY(0deg)";
                zIndex = 10;
                opacity = 0;
                pointerEvents = "none";
              }
            } else if (total === 3) {
              // CASO 2: MODO DESKTOP CON EXACTAMENTE 3 PRODUCTOS
              // Todos del mismo tamaño (scale(1)), separados homogéneamente
              if (diff === 0) {
                transform = "translate3d(0, 0, 0px) scale(1)";
                zIndex = 30;
                opacity = 1;
                pointerEvents = "auto";
                isHighlight = true;
              } else if (diff === 1) {
                transform = "translate3d(108%, 0, 0px) scale(1)";
                zIndex = 25;
                opacity = 1;
                pointerEvents = "auto";
              } else if (diff === total - 1) {
                transform = "translate3d(-108%, 0, 0px) scale(1)";
                zIndex = 25;
                opacity = 1;
                pointerEvents = "auto";
              } else {
                transform = "translate3d(0, 0, -200px) scale(0.6)";
                zIndex = 10;
                opacity = 0;
                pointerEvents = "none";
              }
            } else {
              // CASO 3: MODO DESKTOP CON MÁS DE 3 PRODUCTOS (DE 4 EN 4)
              // Todos del mismo tamaño (scale(1)), separados limpiamente con espaciado equilibrado
              if (diff === 0) {
                // MEDIO IZQUIERDO
                transform = "translate3d(-54%, 0, 0px) scale(1)";
                zIndex = 30;
                opacity = 1;
                pointerEvents = "auto";
                isHighlight = true;
              } else if (diff === 1) {
                // MEDIO DERECHO
                transform = "translate3d(54%, 0, 0px) scale(1)";
                zIndex = 30;
                opacity = 1;
                pointerEvents = "auto";
                isHighlight = true;
              } else if (diff === 2) {
                // LATERAL DERECHO
                transform = "translate3d(162%, 0, 0px) scale(1)";
                zIndex = 25;
                opacity = 1;
                pointerEvents = "auto";
              } else if (diff === total - 1) {
                // LATERAL IZQUIERDO
                transform = "translate3d(-162%, 0, 0px) scale(1)";
                zIndex = 25;
                opacity = 1;
                pointerEvents = "auto";
              } else {
                // RESTO OCULTO ATRÁS
                transform = "translate3d(0, 0, -200px) scale(0.6)";
                zIndex = 10;
                opacity = 0;
                pointerEvents = "none";
              }
            }

            // Sanitizar descripción para NUNCA mostrar placeholders como "product image"
            const rawDesc = (item.descripcion || "").trim();
            const isPlaceholderDesc =
              !rawDesc ||
              rawDesc.toLowerCase() === "product image" ||
              rawDesc.toLowerCase() === "product_image" ||
              rawDesc.toLowerCase().includes("product image") ||
              rawDesc.toLowerCase() === "imagen" ||
              rawDesc.toLowerCase() === "null";

            return (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => {
                  if (isMobile || total === 3) {
                    if (diff === 1) nextSlide();
                    else if (diff === total - 1) prevSlide();
                    else if (diff === 0) {
                      if (item.isProduct && onQuickView && item.rawProduct) {
                        onQuickView(item.rawProduct);
                      }
                    }
                  } else {
                    if (diff === 2) nextSlide();
                    else if (diff === total - 1) prevSlide();
                    else if (diff === 0 || diff === 1) {
                      if (item.isProduct && onQuickView && item.rawProduct) {
                        onQuickView(item.rawProduct);
                      }
                    }
                  }
                }}
                className={`absolute w-[220px] xs:w-[240px] sm:w-[260px] md:w-[275px] lg:w-[285px] xl:w-[295px] h-[340px] sm:h-[375px] md:h-[410px] lg:h-[450px] xl:h-[470px] rounded-3xl overflow-hidden cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] bg-white ${
                  isHighlight
                    ? "ring-2 sm:ring-4 ring-[#EE6B8D]/40 shadow-[0_16px_36px_-8px_rgba(238,107,141,0.3)]"
                    : "shadow-lg hover:shadow-xl hover:ring-2 hover:ring-pink-200"
                }`}
                style={{
                  transform,
                  zIndex,
                  opacity,
                  pointerEvents,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Imagen del producto o lámina de catálogo */}
                <img
                  src={item.imagen}
                  alt={item.nombre}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo.png";
                  }}
                />

                {/* Gradiente en la base optimizado para legibilidad */}
                <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                {/* Badges superiores: Categoría/Campaña a la izquierda, Precio a la derecha */}
                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-[#C04267] font-lato font-bold text-[11px] shadow-sm">
                    <Sparkles size={11} className="text-[#EE6B8D]" />
                    {item.categoria || eventoNombre}
                  </span>

                  {item.precio > 0 && (
                    <span className="px-3 py-1 rounded-full bg-[#C04267] text-white font-quicksand font-bold text-xs sm:text-sm shadow-md">
                      S/ {item.precio.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Información y botones en la parte inferior */}
                <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white">
                  {/* Título en blanco nítido con sombra de texto de alta definición */}
                  <h3 className="font-playfair text-base sm:text-lg md:text-xl font-bold leading-snug mb-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] line-clamp-1">
                    {item.nombre}
                  </h3>

                  {/* Descripción solo si NO es placeholder como 'product image' */}
                  {!isPlaceholderDesc && (
                    <p className="font-lato text-xs text-white/90 line-clamp-1 mb-2.5 drop-shadow-sm">
                      {rawDesc}
                    </p>
                  )}

                  {/* Botones de acción: en celular solo en la tarjeta frontal (isHighlight), en desktop en las tarjetas visibles */}
                  {(isHighlight || (!isMobile && opacity > 0)) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/20 animate-in fade-in duration-300">
                      {item.isProduct ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuickView && item.rawProduct) {
                              onQuickView(item.rawProduct);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white text-[#C04267] hover:bg-pink-50 font-quicksand text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <Eye size={13} strokeWidth={2.5} />
                          <span>Ver detalle</span>
                        </button>
                      ) : (
                        <a
                          href={getWhatsAppLink(item, eventoNombre)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white text-[#C04267] hover:bg-pink-50 font-quicksand text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <Sparkles size={13} className="text-[#EE6B8D]" />
                          <span>Consultar</span>
                        </a>
                      )}

                      <a
                        href={getWhatsAppLink(item, eventoNombre)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-[#25D366] text-white hover:bg-[#20bd5a] transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Pedir por WhatsApp"
                        aria-label="Pedir por WhatsApp"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="currentColor"
                          className="shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Flechas de navegación fuera de las tarjetas */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Anterior producto"
            className="absolute -left-3 sm:-left-6 md:-left-12 lg:-left-16 xl:-left-20 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-white text-[#C04267] hover:text-[#EE6B8D] flex items-center justify-center shadow-lg hover:shadow-xl transition-all border border-pink-100 backdrop-blur-sm hover:scale-105 cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Siguiente producto"
            className="absolute -right-3 sm:-right-6 md:-right-10 lg:-right-16 xl:-right-20 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-white text-[#C04267] hover:text-[#EE6B8D] flex items-center justify-center shadow-lg hover:shadow-xl transition-all border border-pink-100 backdrop-blur-sm hover:scale-105 cursor-pointer"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Indicadores inferiores */}
        <div className="flex items-center justify-center gap-2 mt-7">
          {displayItems.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Ver producto ${i + 1}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-8 bg-[#EE6B8D]"
                  : "w-2.5 bg-pink-200 hover:bg-pink-300"
              }`}
            />
          ))}
        </div>

        {/* Botón para ver todo el catálogo completo del evento */}
        <div className="text-center mt-7">
          <Link
            href={eventoLink}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#EE6B8D] text-white font-quicksand font-bold text-xs sm:text-sm hover:bg-[#C04267] transition-all shadow-sm hover:shadow-md hover:scale-105"
          >
            <span>Ver todo el catálogo de {eventoNombre}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
