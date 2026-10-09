"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { MaterialItem } from "@/types/produccion";

interface MaterialComboboxProps {
  materiales: MaterialItem[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function MaterialCombobox({
  materiales,
  selectedId,
  onChange,
  className = "",
}: MaterialComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedMaterial = useMemo(() => {
    return materiales.find((m) => m.id === selectedId) || null;
  }, [materiales, selectedId]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickAfuera = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    if (abierto) {
      document.addEventListener("mousedown", handleClickAfuera);
      // Auto-foco en el input de búsqueda al desplegar
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => {
        document.removeEventListener("mousedown", handleClickAfuera);
        clearTimeout(timer);
      };
    }
    return () => {
      document.removeEventListener("mousedown", handleClickAfuera);
    };
  }, [abierto]);

  const materialesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return materiales;
    const q = busqueda.toLowerCase().trim();
    return materiales.filter((m) => {
      const nombreMatch = m.nombre.toLowerCase().includes(q);
      const catMatch = (m.categoria || "").toLowerCase().includes(q);
      const presMatch = (m.presentacion || "").toLowerCase().includes(q);
      return nombreMatch || catMatch || presMatch;
    });
  }, [materiales, busqueda]);

  const handleSeleccionar = (id: string) => {
    onChange(id);
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <div ref={dropdownRef} className={`w-full min-w-0 ${className}`}>
      {/* Botón trigger principal */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="w-full min-w-0 px-3 py-2 rounded-xl border border-pink-200 bg-white text-xs font-semibold focus:border-[#EE6B8D] focus:outline-none flex items-center justify-between gap-2 text-left cursor-pointer transition-colors hover:border-[#EE6B8D]/70 shadow-2xs"
      >
        <div className="min-w-0 flex-1 truncate">
          {selectedMaterial ? (
            <span className="text-gray-800">
              <strong className="text-gray-900">{selectedMaterial.nombre}</strong>
              <span className="text-gray-500 font-normal ml-1.5">
                (S/ {selectedMaterial.precio_compra.toFixed(2)} por {selectedMaterial.presentacion || `${selectedMaterial.cantidad_total} ${selectedMaterial.unidad_medida}`})
              </span>
            </span>
          ) : (
            <span className="text-gray-400">Seleccionar insumo o color...</span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-400 shrink-0 transition-transform ${abierto ? "rotate-180 text-[#EE6B8D]" : ""}`}
        />
      </button>

      {/* Panel buscador interactivo en flujo (NUNCA queda tapado ni cortado) */}
      {abierto && (
        <div className="w-full bg-white rounded-2xl border border-pink-200 shadow-sm p-2.5 space-y-2 mt-2 animate-in fade-in duration-150">
          {/* Buscador de insumos */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por color, nombre o presentación..."
              className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-pink-200 bg-pink-50/40 focus:bg-white focus:border-[#EE6B8D] focus:outline-none font-medium"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Lista de resultados filtrados */}
          <div className="max-h-[190px] overflow-y-auto space-y-1 pr-1 divide-y divide-pink-50">
            {materialesFiltrados.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 font-quicksand">
                No se encontró ningún insumo con &quot;{busqueda}&quot;
              </div>
            ) : (
              materialesFiltrados.map((m) => {
                const esSeleccionado = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSeleccionar(m.id)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      esSeleccionado
                        ? "bg-pink-100/70 text-[#C04267] font-bold"
                        : "hover:bg-pink-50 text-gray-700"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900">{m.nombre}</span>
                        {m.categoria && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-pink-50 text-[#C04267] border border-pink-200/60 font-semibold">
                            {m.categoria}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        S/ {m.precio_compra.toFixed(2)} por {m.presentacion || `${m.cantidad_total} ${m.unidad_medida}`}
                      </div>
                    </div>

                    {esSeleccionado && <Check size={14} className="text-[#EE6B8D] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-1.5 border-t border-pink-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>{materialesFiltrados.length} material(es) encontrados</span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-[#C04267] hover:underline font-bold text-[11px] cursor-pointer"
            >
              Cerrar lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
