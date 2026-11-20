"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Loader2,
  Check,
  Package,
  Image as ImageIcon,
  DollarSign,
  Tag,
  Layers,
  Sparkles,
  Info,
  Star,
  Trash2,
  Plus,
} from "lucide-react";
import {
  CATALOGOS_TIENDA,
  CatalogoDef,
  EVENTOS_BASE,
  getDefaultProductSlugs,
  getProductActiveSlugs,
  getSlugBadgeInfo,
  ProductoCatalogoAssignment,
} from "@/lib/catalogos";
import type { Product } from "@/lib/ventify";

type CategoriaProducto = "Ramos" | "Amigurumis" | "Cajas" | "Personalizado" | "General";

interface EventoFormOption {
  slug?: string | null;
  nombre?: string | null;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null; // null para crear nuevo, objeto para editar
  assignments: ProductoCatalogoAssignment[];
  eventos: EventoFormOption[];
  catalogos?: CatalogoDef[];
  inactiveIds: Set<string>;
  onSaveSuccess: (savedProduct: Product, activeSlugs: string[], isActive: boolean) => void;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  assignments,
  eventos,
  catalogos,
  inactiveIds,
  onSaveSuccess,
}: ProductFormModalProps) {
  const isEditing = Boolean(product);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState<number | string>(0);
  const [esAPedido, setEsAPedido] = useState(true);
  const [categoria, setCategoria] = useState<CategoriaProducto>("Ramos");
  const [imagen, setImagen] = useState(""); // Imagen principal / portada
  const [imagenes, setImagenes] = useState<string[]>([]); // Galería completa de imágenes
  const [tempUrlInput, setTempUrlInput] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lista combinada de eventos
  const allAvailableEvents = React.useMemo(() => {
    const map = new Map<string, string>();
    EVENTOS_BASE.forEach((e) => map.set(e.slug, e.label));
    eventos.forEach((e) => {
      if (e.slug && !map.has(e.slug)) {
        map.set(e.slug, e.nombre || e.slug);
      }
    });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [eventos]);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setTempUrlInput("");

    if (product) {
      setNombre(product.nombre || "");
      setSku(product.sku || "");
      setPrecio(product.precio !== undefined ? String(product.precio) : "");
      const stockVal = Number(product.stock) || 0;
      setStock(stockVal);
      setEsAPedido(stockVal === 0);
      setCategoria((product.categoria as CategoriaProducto) || "Ramos");

      // Cargar lista de imágenes
      const imgs: string[] = [];
      if (Array.isArray(product.imagenes) && product.imagenes.length > 0) {
        imgs.push(...product.imagenes.filter(Boolean));
      }
      if (product.imagen && !imgs.includes(product.imagen)) {
        imgs.unshift(product.imagen);
      }
      setImagenes(imgs);
      setImagen(product.imagen || imgs[0] || "");

      setDescripcion(product.descripcion || "");
      const activeSlugs = getProductActiveSlugs(product, assignments);
      setSelectedSlugs(activeSlugs);
      setIsActive(!inactiveIds.has(product.id));
    } else {
      // Nuevo producto
      setNombre("");
      setSku(`PROD-${Math.floor(100 + Math.random() * 900)}`);
      setPrecio("");
      setStock(0);
      setEsAPedido(true);
      setCategoria("Ramos");
      setImagen("");
      setImagenes([]);
      setDescripcion("");
      setSelectedSlugs(["ramos"]);
      setIsActive(true);
    }
  }, [isOpen, product, assignments, inactiveIds]);

  if (!isOpen) return null;

  const handleToggleSlug = (slug: string) => {
    const normalized = slug.toLowerCase().trim();
    setSelectedSlugs((prev) =>
      prev.includes(normalized) ? prev.filter((s) => s !== normalized) : [...prev, normalized]
    );
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    setErrorMsg(null);

    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const filename = `productos/prod_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("heroes").upload(filename, file, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("heroes").getPublicUrl(filename);
          if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setImagenes((prev) => {
          const next = [...prev, ...uploadedUrls];
          if (!imagen && next[0]) setImagen(next[0]);
          return next;
        });
      }
    } catch (err) {
      setErrorMsg("Error al subir una o más imágenes");
      console.error(err);
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrlImage = () => {
    const url = tempUrlInput.trim();
    if (!url) return;
    if (!imagenes.includes(url)) {
      setImagenes((prev) => {
        const next = [...prev, url];
        if (!imagen) setImagen(url);
        return next;
      });
    }
    setTempUrlInput("");
  };

  const handleSetCover = (url: string) => {
    setImagen(url);
    // Mover la portada al inicio del array
    setImagenes((prev) => [url, ...prev.filter((u) => u !== url)]);
  };

  const handleRemoveImage = (urlToRemove: string) => {
    setImagenes((prev) => {
      const next = prev.filter((u) => u !== urlToRemove);
      if (imagen === urlToRemove) {
        setImagen(next[0] || "");
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("El nombre del producto es obligatorio.");
      return;
    }
    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      setErrorMsg("Ingresa un precio válido en soles.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const finalStock = esAPedido ? 0 : (typeof stock === "string" ? parseInt(stock) || 0 : stock);
      const primaryImg = imagen || imagenes[0] || "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=600&q=80";

      const payload = {
        id: product?.id || undefined,
        sku: sku.trim() || undefined,
        nombre: nombre.trim(),
        precio: precioNum,
        stock: finalStock,
        categoria,
        imagen: primaryImg,
        imagenes: imagenes.length > 0 ? imagenes : [primaryImg],
        descripcion: descripcion.trim(),
        catalogos: selectedSlugs,
        is_active: isActive,
      };

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar-producto", producto: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "No se pudo guardar el producto");
      }

      const resJson = await res.json();
      const saved = resJson.producto;

      // Calcular qué catálogos por defecto fueron desmarcados para guardarlos como excluidos (incluir: false)
      const defaultSlugs = getDefaultProductSlugs({
        sku: saved.sku,
        nombre: saved.nombre,
        categoriaOriginal: saved.categoriaOriginal || saved.categoria_original || product?.categoriaOriginal,
      });
      const slugsExcluidos = defaultSlugs.filter((s) => !selectedSlugs.includes(s));

      // Actualizar asignaciones en producto_catalogos
      await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guardar-producto-catalogos",
          producto_id: saved.id,
          sku: saved.sku || null,
          slugs_incluidos: selectedSlugs,
          slugs_excluidos: slugsExcluidos,
        }),
      });

      // Actualizar visibilidad si cambió
      if (saved.id) {
        await fetch("/api/admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle-producto",
            id: saved.id,
            ocultar: !isActive,
          }),
        });
      }

      onSaveSuccess(saved, selectedSlugs, isActive);
      onClose();
    } catch (err) {
      console.error("Error al guardar producto:", err);
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl lg:max-w-3xl shadow-2xl border border-gray-100 max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera compacta */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 shrink-0 bg-gradient-to-r from-pink-50/50 via-white to-pink-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-100 text-[#C04267] flex items-center justify-center shrink-0">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-900 leading-tight">
                {isEditing ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <p className="font-quicksand text-[11px] sm:text-xs text-gray-500">
                {isEditing ? "Modifica fotos, precios y catálogos asignados" : "Añade un producto al catálogo propio de la tienda"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrollable optimizado para móvil y tablet */}
        <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-quicksand flex items-center gap-2">
              <Info size={15} className="text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sección 1: Datos principales */}
          <div className="space-y-3">
            <h4 className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Información del Producto
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ramo Rosas y Girasoles Eternos"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] focus:ring-1 focus:ring-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  SKU / Código Único
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ramos-036"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] font-mono"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Categoría Principal
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as CategoriaProducto)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                >
                  <option value="Ramos">Ramos</option>
                  <option value="Amigurumis">Amigurumis</option>
                  <option value="Cajas">Cajas</option>
                  <option value="Personalizado">Personalizado</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Precio (S/) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-quicksand text-xs font-bold">
                    S/
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="50.00"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-quicksand text-xs font-bold text-gray-700">
                    Disponibilidad / Stock
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={esAPedido}
                      onChange={(e) => {
                        setEsAPedido(e.target.checked);
                        if (e.target.checked) setStock(0);
                      }}
                      className="rounded text-[#EE6B8D] focus:ring-[#EE6B8D]"
                    />
                    <span className="font-quicksand text-[11px] text-gray-500 font-semibold">
                      Elaborado a pedido (Stock 0)
                    </span>
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  disabled={esAPedido}
                  value={esAPedido ? 0 : stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 ${
                    esAPedido ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white focus:outline-none focus:border-[#EE6B8D]"
                  }`}
                  placeholder={esAPedido ? "Elaborado a pedido (Stock 0)" : "Unidades disponibles en stock"}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 2: Múltiples Imágenes y Galería */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Fotos del Producto (Permite múltiples)
                </h4>
                <p className="font-quicksand text-[11px] text-gray-500">
                  Puedes seleccionar varias imágenes a la vez. La primera foto o la marcada con estrella será la portada.
                </p>
              </div>
              <span className="font-quicksand text-xs font-bold text-[#EE6B8D] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200 shrink-0">
                {imagenes.length} foto{imagenes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Galería de miniaturas */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
              {imagenes.map((imgUrl, idx) => {
                const isCover = (imagen && imagen === imgUrl) || (!imagen && idx === 0);
                return (
                  <div
                    key={idx}
                    className={`relative group rounded-xl overflow-hidden border-2 bg-gray-50 aspect-square flex items-center justify-center transition-all ${
                      isCover ? "border-[#EE6B8D] shadow-xs ring-2 ring-pink-100" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />

                    {/* Badge de Portada */}
                    {isCover && (
                      <span className="absolute top-1 left-1 bg-[#EE6B8D] text-white text-[9px] font-quicksand font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                        Portada
                      </span>
                    )}

                    {/* Acciones flotantes */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      {!isCover && (
                        <button
                          type="button"
                          onClick={() => handleSetCover(imgUrl)}
                          title="Hacer foto de portada"
                          className="p-1.5 bg-white text-amber-500 hover:bg-amber-50 rounded-lg shadow-xs transition-colors"
                        >
                          <Star size={13} fill="currentColor" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(imgUrl)}
                        title="Eliminar foto"
                        className="p-1.5 bg-white text-red-500 hover:bg-red-50 rounded-lg shadow-xs transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Botón para subir fotos */}
              <button
                type="button"
                disabled={uploadingImg}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-pink-200 hover:border-[#EE6B8D] bg-pink-50/40 hover:bg-pink-50 aspect-square flex flex-col items-center justify-center text-[#C04267] transition-all p-2 disabled:opacity-50"
              >
                {uploadingImg ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={20} />
                    <span className="text-[10px] font-quicksand font-bold mt-1 text-center leading-tight">
                      Subir fotos
                    </span>
                  </>
                )}
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleUploadImages}
              className="hidden"
            />

            {/* Opción para añadir por URL */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="url"
                placeholder="O pega un enlace de imagen (https://...)"
                value={tempUrlInput}
                onChange={(e) => setTempUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUrlImage();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
              />
              <button
                type="button"
                onClick={handleAddUrlImage}
                disabled={!tempUrlInput.trim()}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-quicksand font-bold text-xs transition-colors disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 3: Descripción */}
          <div className="space-y-1.5">
            <h4 className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Descripción del Producto
            </h4>
            <textarea
              rows={2}
              placeholder="Materiales (hilo 100% algodón), dimensiones, colores o dedicatoria incluida..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 4: Asignación a Catálogos y Eventos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Catálogos y Eventos
                </h4>
                <p className="font-quicksand text-[11px] text-gray-500">
                  Marca las categorías y eventos donde se mostrará este producto
                </p>
              </div>
              <span className="font-quicksand text-xs font-bold text-[#EE6B8D] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                {selectedSlugs.length} activo{selectedSlugs.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Catálogos de tienda */}
            <div>
              <p className="font-quicksand text-[11px] font-bold text-gray-600 mb-1.5">
                Catálogos Principales:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {(catalogos && catalogos.length > 0 ? catalogos : CATALOGOS_TIENDA).map((cat) => {
                  const isChecked = selectedSlugs.includes(cat.slug);
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleToggleSlug(cat.slug)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                        }`}
                      >
                        {isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-quicksand text-[11px] font-bold truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Eventos especiales */}
            <div>
              <p className="font-quicksand text-[11px] font-bold text-gray-600 mb-1.5">
                Eventos y Campañas:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {allAvailableEvents.map((ev) => {
                  const isChecked = selectedSlugs.includes(ev.slug);
                  return (
                    <button
                      key={ev.slug}
                      type="button"
                      onClick={() => handleToggleSlug(ev.slug)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                        }`}
                      >
                        {isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-quicksand text-[11px] font-bold truncate">{ev.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 5: Visibilidad en web */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-quicksand text-xs font-bold text-gray-800">
                Visible para clientes en la tienda online
              </p>
              <p className="font-quicksand text-[11px] text-gray-500">
                {isActive ? "Activo (los clientes pueden verlo y comprarlo)" : "Oculto (solo visible en el Super Admin)"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${
                isActive ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform mt-1 ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 sm:px-5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{saving ? "Guardando..." : isEditing ? "Actualizar Producto" : "Crear Producto"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
