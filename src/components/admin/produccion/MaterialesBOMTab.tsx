"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Layers,
  Edit2,
  Trash2,
  Download,
  PackageCheck,
  Scale,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import {
  MaterialItem,
  CategoriaMaterial,
  UnidadMedida,
} from "@/types/produccion";
import { exportarBOMMateriales } from "./exportUtils";

interface MaterialesBOMTabProps {
  materiales: MaterialItem[];
  onGuardarMaterial: (material: Partial<MaterialItem>) => Promise<boolean>;
  onEliminarMaterial: (id: string) => Promise<boolean>;
}

const CATEGORIAS: CategoriaMaterial[] = [
  "Hilos",
  "Relleno",
  "Fornituras",
  "Packaging",
  "Contenido Box",
  "Accesorios",
  "Otros",
];

const UNIDADES: UnidadMedida[] = [
  "unidades",
  "gramos",
  "pares",
  "metros",
  "pliegos",
  "conos",
];

export default function MaterialesBOMTab({
  materiales,
  onGuardarMaterial,
  onEliminarMaterial,
}: MaterialesBOMTabProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<MaterialItem | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState<CategoriaMaterial>("Fornituras");
  const [formPresentacion, setFormPresentacion] = useState("");
  const [formPrecioCompra, setFormPrecioCompra] = useState<string>("");
  const [formCantidadTotal, setFormCantidadTotal] = useState<string>("100");
  const [formUnidadMedida, setFormUnidadMedida] = useState<UnidadMedida>("unidades");
  const [guardando, setGuardando] = useState(false);

  const abrirModalNuevo = () => {
    setEditando(null);
    setFormNombre("");
    setFormCategoria("Fornituras");
    setFormPresentacion("");
    setFormPrecioCompra("");
    setFormCantidadTotal("100");
    setFormUnidadMedida("unidades");
    setModalAbierto(true);
  };

  const abrirModalEditar = (mat: MaterialItem) => {
    setEditando(mat);
    setFormNombre(mat.nombre);
    setFormCategoria(mat.categoria);
    setFormPresentacion(mat.presentacion || "");
    setFormPrecioCompra(String(mat.precio_compra));
    setFormCantidadTotal(String(mat.cantidad_total));
    setFormUnidadMedida(mat.unidad_medida);
    setModalAbierto(true);
  };

  const costoUnitarioCalculado = useMemo(() => {
    const precio = parseFloat(formPrecioCompra) || 0;
    const cant = parseFloat(formCantidadTotal) || 0;
    if (cant <= 0) return 0;
    return precio / cant;
  }, [formPrecioCompra, formCantidadTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    setGuardando(true);
    const pCompra = parseFloat(formPrecioCompra) || 0;
    const cTotal = parseFloat(formCantidadTotal) || 1;

    const data: Partial<MaterialItem> = {
      id: editando ? editando.id : undefined,
      nombre: formNombre.trim(),
      categoria: formCategoria,
      presentacion: formPresentacion.trim() || undefined,
      precio_compra: pCompra,
      cantidad_total: cTotal,
      unidad_medida: formUnidadMedida,
    };

    const ok = await onGuardarMaterial(data);
    setGuardando(false);
    if (ok) {
      setModalAbierto(false);
    }
  };

  const materialesFiltrados = useMemo(() => {
    return materiales.filter((m) => {
      const coincideBusqueda =
        m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (m.presentacion || "").toLowerCase().includes(busqueda.toLowerCase());
      const coincideCat = filtroCategoria === "todas" || m.categoria === filtroCategoria;
      return coincideBusqueda && coincideCat;
    });
  }, [materiales, busqueda, filtroCategoria]);

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-[#FDE8EF] shadow-xs">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
            <Layers className="text-[#EE6B8D]" size={22} />
            Catálogo de Materiales
          </h3>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Registra tus compras por ciento, docena o paquetes. El sistema calcula automáticamente el costo exacto por cada unidad o gramo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => exportarBOMMateriales(materiales)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-[#FDE8EF] text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] font-quicksand text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Exportar a Excel / CSV"
          >
            <Download size={15} />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={abrirModalNuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#EE6B8D] text-white hover:bg-[#C04267] font-quicksand text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Material</span>
          </button>
        </div>
      </div>

      {/* Filtros y Busqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar material por nombre o presentación (ej. llaveros, argolla, hilo rosa)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-white font-quicksand text-xs sm:text-sm focus:border-[#EE6B8D] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFiltroCategoria("todas")}
            className={`px-3 py-2 rounded-2xl text-xs font-quicksand font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filtroCategoria === "todas"
                ? "bg-[#C04267] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200 hover:border-pink-200"
            }`}
          >
            Todas ({materiales.length})
          </button>
          {CATEGORIAS.map((cat) => {
            const count = materiales.filter((m) => m.categoria === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFiltroCategoria(cat)}
                className={`px-3 py-2 rounded-2xl text-xs font-quicksand font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filtroCategoria === cat
                    ? "bg-[#C04267] text-white shadow-xs"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-pink-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla de Materiales */}
      {/* Lista de Materiales: Vista de Tarjetas en Móvil (sin scroll horizontal) y Tabla en Desktop/Tablet */}
      <div className="bg-white rounded-3xl border border-[#FDE8EF] shadow-xs overflow-hidden">
        {/* Vista Móvil (< md): Tarjetas compactas 100% legibles sin scroll horizontal */}
        <div className="md:hidden divide-y divide-gray-100">
          {materialesFiltrados.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-quicksand text-xs">
              No se encontraron materiales registrados.
            </div>
          ) : (
            materialesFiltrados.map((m) => (
              <div key={m.id} className="p-3.5 space-y-2.5 hover:bg-pink-50/20 transition-colors font-quicksand">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-gray-800 text-sm truncate">{m.nombre}</div>
                    <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-[#C04267] border border-pink-100">
                      {m.categoria}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirModalEditar(m)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#EE6B8D] hover:bg-pink-50 transition-colors cursor-pointer"
                      title="Editar material"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Deseas eliminar el material "${m.nombre}"?`)) {
                          onEliminarMaterial(m.id);
                        }
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Eliminar material"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#FDF4F7] p-2.5 rounded-2xl text-xs">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Precio</div>
                    <div className="font-bold text-gray-700 mt-0.5">S/ {m.precio_compra.toFixed(2)}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Paquete</div>
                    <div className="font-semibold text-gray-700 mt-0.5 truncate text-[11px]">
                      {m.presentacion || `${m.cantidad_total} ${m.unidad_medida}`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-[#C04267] uppercase font-bold">Costo Unit.</div>
                    <div className="font-bold text-[#C04267] mt-0.5">
                      S/ {m.costo_unitario < 0.01 ? m.costo_unitario.toFixed(4) : m.costo_unitario.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400">
                      /{m.unidad_medida === "unidades" ? "u" : m.unidad_medida === "pares" ? "par" : "u"}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vista Desktop / Tablet (>= md): Tabla completa */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left font-quicksand text-xs sm:text-sm">
            <thead className="bg-[#FDF4F7] text-[#C04267] font-fredoka font-bold text-xs uppercase border-b border-pink-100">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Material</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4">Precio Compra</th>
                <th className="py-3.5 px-4 text-center">Costo Unitario</th>
                <th className="py-3.5 px-4 text-center">Presentación</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materialesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 font-quicksand text-xs">
                    No se encontraron materiales registrados.
                  </td>
                </tr>
              ) : (
                materialesFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-bold text-gray-800 text-xs sm:text-sm">{m.nombre}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-pink-50 text-[#C04267] border border-pink-100">
                        {m.categoria}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700">
                      S/ {m.precio_compra.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-[#C04267]">
                        S/ {m.costo_unitario < 0.01 ? m.costo_unitario.toFixed(4) : m.costo_unitario.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        por 1 {m.unidad_medida === "unidades" ? "unidad" : m.unidad_medida === "pares" ? "par" : m.unidad_medida.slice(0, -1)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-gray-700 bg-pink-50/60 text-[#C04267] px-2.5 py-1 rounded-full border border-pink-100 text-xs">
                        {m.presentacion || `${m.cantidad_total} ${m.unidad_medida}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(m)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#EE6B8D] hover:bg-pink-50 transition-colors cursor-pointer"
                          title="Editar material"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Deseas eliminar el material "${m.nombre}"?`)) {
                              onEliminarMaterial(m.id);
                            }
                          }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar material"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Material con Presets de Compra por Mayor */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-3xl p-5 sm:p-7 border border-[#FDE8EF] shadow-2xl animate-in fade-in my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h4 className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267]">
                {editando ? "Editar Material" : "Añadir Nuevo Material"}
              </h4>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 font-quicksand">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nombre del Material *
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="ej. Llavero con cadena, Argolla plateada, Hilo Algodón Rosa, Caja con visor"
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value as CategoriaMaterial)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caja de cálculo del costo unitario */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-50/70 via-white to-pink-50/40 border border-pink-200 space-y-3">
                <div className="text-xs font-bold text-[#C04267]">
                  Datos de Compra y Paquete:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Precio de Compra (S/) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={formPrecioCompra}
                      onChange={(e) => setFormPrecioCompra(e.target.value)}
                      placeholder="ej. 25.00"
                      className="w-full px-3.5 py-2 rounded-xl border border-pink-200 bg-white text-sm focus:border-[#EE6B8D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Cantidad del Paquete *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={formCantidadTotal}
                      onChange={(e) => setFormCantidadTotal(e.target.value)}
                      placeholder="ej. 100"
                      className="w-full px-3.5 py-2 rounded-xl border border-pink-200 bg-white text-sm focus:border-[#EE6B8D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Unidad de Medida
                    </label>
                    <select
                      value={formUnidadMedida}
                      onChange={(e) => setFormUnidadMedida(e.target.value as UnidadMedida)}
                      className="w-full px-3.5 py-2 rounded-xl border border-pink-200 bg-white text-sm focus:border-[#EE6B8D] focus:outline-none"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Nombre de Presentación (ej. Ciento, Docena, Ovillo)
                  </label>
                  <input
                    type="text"
                    value={formPresentacion}
                    onChange={(e) => setFormPresentacion(e.target.value)}
                    placeholder="ej. Ciento (100 u), Docena (12 u), Ovillo 100g"
                    className="w-full px-3.5 py-1.5 rounded-xl border border-pink-200 bg-white text-xs focus:border-[#EE6B8D] focus:outline-none"
                  />
                </div>

                {/* Explicación y Cálculo en Vivo */}
                <div className="pt-2 border-t border-pink-200/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Costo unitario por cada 1 {formUnidadMedida === "unidades" ? "unidad" : formUnidadMedida === "pares" ? "par" : formUnidadMedida.slice(0, -1)}:
                    </span>
                    <span className="font-bold text-[#C04267] text-base font-fredoka">
                      S/ {costoUnitarioCalculado < 0.01 ? costoUnitarioCalculado.toFixed(4) : costoUnitarioCalculado.toFixed(2)}
                    </span>
                  </div>

                  {parseFloat(formPrecioCompra) > 0 && parseFloat(formCantidadTotal) > 0 && (
                    <div className="p-2 rounded-xl bg-pink-100/70 text-[#C04267] text-[11px] font-semibold">
                      Compraste {formPresentacion || `${formCantidadTotal} ${formUnidadMedida}`} a S/ {parseFloat(formPrecioCompra).toFixed(2)} ➔ Cada unidad te cuesta S/ {costoUnitarioCalculado < 0.01 ? costoUnitarioCalculado.toFixed(4) : costoUnitarioCalculado.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm active:scale-95 cursor-pointer"
                >
                  {guardando ? "Guardando..." : editando ? "Actualizar Material" : "Guardar Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
