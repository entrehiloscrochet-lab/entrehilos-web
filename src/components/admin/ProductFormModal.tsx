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
} from "lucide-react";
import {
  CATALOGOS_TIENDA,
  EVENTOS_BASE,
  getProductActiveSlugs,
  getSlugBadgeInfo,
  ProductoCatalogoAssignment,
} from "@/lib/catalogos";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null; // null para crear nuevo, objeto para editar
  assignments: ProductoCatalogoAssignment[];
  eventos: any[];
  inactiveIds: Set<string>;
  onSaveSuccess: (savedProduct: any, activeSlugs: string[], isActive: boolean) => void;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  assignments,
  eventos,
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
  const [categoria, setCategoria] = useState<"Ramos" | "Amigurumis" | "Cajas" | "Personalizado" | "General">("Ramos");
  const [imagen, setImagen] = useState("");
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
    eventos.forEach((e: any) => {
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

    if (product) {
      setNombre(product.nombre || "");
      setSku(product.sku || "");
      setPrecio(product.precio !== undefined ? String(product.precio) : "");
      const stockVal = Number(product.stock) || 0;
      setStock(stockVal);
      setEsAPedido(stockVal === 0);
      setCategoria(product.categoria || "Ramos");
      setImagen(product.imagen || "");
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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setErrorMsg(null);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop();
      const filename = `productos/prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(filename, file, { upsert: true });
      if (error) {
        setErrorMsg("Error al subir imagen: " + error.message);
      } else {
        const { data: pub } = supabase.storage.from("heroes").getPublicUrl(filename);
        setImagen(pub.publicUrl);
      }
    } catch (err: any) {
      setErrorMsg("Error inesperado al subir la imagen");
      console.error(err);
    } finally {
      setUploadingImg(false);
    }
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
      const payload = {
        id: product?.id || undefined,
        sku: sku.trim() || undefined,
        nombre: nombre.trim(),
        precio: precioNum,
        stock: finalStock,
        categoria,
        imagen: imagen.trim() || "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=600&q=80",
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

      // También guardar explícitamente en producto_catalogos para garantizar consistencia
      await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guardar-producto-catalogos",
          producto_id: saved.id,
          sku: saved.sku || null,
          slugs_incluidos: selectedSlugs,
          slugs_excluidos: [],
        }),
      });

      // Si cambió el estado de activo en web, actualizar visibilidad
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
    } catch (err: any) {
      console.error("Error al guardar producto:", err);
      setErrorMsg(err.message || "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-gradient-to-r from-pink-50/50 via-white to-pink-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 text-[#C04267] flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-fredoka text-lg font-bold text-gray-900">
                {isEditing ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <p className="font-quicksand text-xs text-gray-500">
                {isEditing ? "Modifica los datos y catálogos asignados" : "Crea un producto nuevo para el catálogo de la tienda"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-quicksand flex items-center gap-2">
              <Info size={16} className="text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sección 1: Datos principales */}
          <div className="space-y-4">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Información Básica
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ramo Rosas y Girasoles Eternos"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] focus:ring-1 focus:ring-[#EE6B8D]"
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
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] font-mono"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Categoría Principal
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
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
                    className="w-full pl-8 pr-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>
              </div>

              <div>
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
                      A pedido
                    </span>
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  disabled={esAPedido}
                  value={esAPedido ? 0 : stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 ${
                    esAPedido ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white focus:outline-none focus:border-[#EE6B8D]"
                  }`}
                  placeholder={esAPedido ? "A pedido (Stock 0)" : "Unidades disponibles"}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 2: Foto del Producto */}
          <div className="space-y-3">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Imagen del Producto
            </h4>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {imagen ? (
                <div className="relative group w-24 h-24 rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                  <img src={imagen} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImagen("")}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Quitar imagen"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50 shrink-0">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-quicksand mt-1">Sin foto</span>
                </div>
              )}

              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingImg}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2 bg-pink-50 hover:bg-pink-100 text-[#C04267] rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-2 border border-pink-200 transition-colors"
                >
                  {uploadingImg ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{uploadingImg ? "Subiendo archivo..." : "Subir foto desde tu dispositivo"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="O pega el enlace URL de la imagen..."
                    value={imagen}
                    onChange={(e) => setImagen(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 3: Descripción */}
          <div className="space-y-2">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Descripción del Producto
            </h4>
            <textarea
              rows={2}
              placeholder="Detalles sobre materiales, hilos utilizados, dimensiones o presentación..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 4: Asignación a Catálogos y Eventos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
                  Catálogos y Eventos Asignados
                </h4>
                <p className="font-quicksand text-[11px] text-gray-500 mt-0.5">
                  Marca todas las secciones donde deseas que aparezca este producto
                </p>
              </div>
              <span className="font-quicksand text-xs font-bold text-[#EE6B8D] bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                {selectedSlugs.length} seleccionado{selectedSlugs.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Catálogos de tienda */}
            <div>
              <p className="font-quicksand text-[11px] font-bold text-gray-600 mb-2">
                Catálogos principales:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATALOGOS_TIENDA.map((cat) => {
                  const isChecked = selectedSlugs.includes(cat.slug);
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleToggleSlug(cat.slug)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                        }`}
                      >
                        {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-quicksand text-xs font-bold truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Eventos especiales */}
            <div>
              <p className="font-quicksand text-[11px] font-bold text-gray-600 mb-2">
                Eventos y campañas de temporada:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allAvailableEvents.map((ev) => {
                  const isChecked = selectedSlugs.includes(ev.slug);
                  return (
                    <button
                      key={ev.slug}
                      type="button"
                      onClick={() => handleToggleSlug(ev.slug)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                        }`}
                      >
                        {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-quicksand text-xs font-bold truncate">{ev.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Sección 5: Visibilidad en web */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-quicksand text-xs font-bold text-gray-800">
                Visible para los clientes en la tienda
              </p>
              <p className="font-quicksand text-[11px] text-gray-500">
                Si está desactivado, el producto solo se verá aquí en el panel de administración
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{saving ? "Guardando..." : isEditing ? "Actualizar Producto" : "Crear Producto"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
