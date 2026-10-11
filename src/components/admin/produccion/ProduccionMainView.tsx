"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Layers,
  Calculator,
  Calendar,
  Scale,
  Smartphone,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ResumenProduccionData,
  MaterialItem,
  ProductoProduccion,
  CampanaProduccion,
  ProduccionConfig,
  BitacoraRegistro,
  PublicarProductoItem,
} from "@/types/produccion";
import ProduccionDashboardTab from "./ProduccionDashboardTab";
import MaterialesBOMTab from "./MaterialesBOMTab";
import EscandalloRecetasTab, { type ProductoPayload } from "./EscandalloRecetasTab";
import CampanasFeriasTab, { type CampanaPayload } from "./CampanasFeriasTab";
import PuntoEquilibrioTab from "./PuntoEquilibrioTab";
import BitacoraTejidoTab from "./BitacoraTejidoTab";

interface ProduccionMainViewProps {
  initialSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export type ProduccionSubTab =
  | "produccion-dashboard"
  | "produccion-materiales"
  | "produccion-recetas"
  | "produccion-campanas"
  | "produccion-equilibrio"
  | "produccion-bitacora";

export function produccionSubToSlug(tab: ProduccionSubTab): string {
  switch (tab) {
    case "produccion-dashboard": return "resumen";
    case "produccion-materiales": return "materiales";
    case "produccion-recetas": return "disenos";
    case "produccion-campanas": return "campanas";
    case "produccion-equilibrio": return "gastos";
    case "produccion-bitacora": return "bitacora";
    default: return "resumen";
  }
}

export function slugToProduccionSub(slug: string | null | undefined): ProduccionSubTab {
  if (!slug) return "produccion-dashboard";
  const s = slug.toLowerCase();
  if (s === "resumen" || s === "dashboard" || s === "produccion-dashboard") return "produccion-dashboard";
  if (s === "materiales" || s === "insumos" || s === "bom" || s === "produccion-materiales") return "produccion-materiales";
  if (s === "disenos" || s === "diseno" || s === "recetas" || s === "costos" || s === "escandallo" || s === "produccion-recetas") return "produccion-recetas";
  if (s === "campanas" || s === "campana" || s === "ferias" || s === "produccion-campanas") return "produccion-campanas";
  if (s === "gastos" || s === "equilibrio" || s === "fijos" || s === "produccion-equilibrio") return "produccion-equilibrio";
  if (s === "bitacora" || s === "tejido" || s === "produccion-bitacora") return "produccion-bitacora";
  return "produccion-dashboard";
}

const SUBTABS_NAV: { id: ProduccionSubTab; label: string; icon: LucideIcon; shortLabel: string }[] = [
  { id: "produccion-dashboard", label: "Resumen General", shortLabel: "Resumen", icon: LayoutDashboard },
  { id: "produccion-materiales", label: "Materiales", shortLabel: "Materiales", icon: Layers },
  { id: "produccion-recetas", label: "Diseños y Costos", shortLabel: "Diseños", icon: Calculator },
  { id: "produccion-campanas", label: "Campañas / Ferias", shortLabel: "Campañas", icon: Calendar },
  { id: "produccion-equilibrio", label: "Gastos Fijos", shortLabel: "Gastos Fijos", icon: Scale },
  { id: "produccion-bitacora", label: "Bitácora", shortLabel: "Bitácora", icon: Smartphone },
];

export default function ProduccionMainView({
  initialSubTab,
  onSubTabChange,
}: ProduccionMainViewProps) {
  const [activeTab, setActiveTab] = useState<ProduccionSubTab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlSub = params.get("sub") || params.get("subtab");
      const savedSub = localStorage.getItem("admin_produccion_subtab");
      const target = initialSubTab || urlSub || savedSub;
      if (target) return slugToProduccionSub(target);
    }
    return slugToProduccionSub(initialSubTab || "produccion-dashboard");
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<ResumenProduccionData>({
    config: { id: "default", tarifa_hora: 8.0, margen_deseado_default: 40.0, limite_horas_dia_alerta: 4.5 },
    materiales: [],
    productos: [],
    campanas: [],
    bitacora: [],
  });

  // Sincronizar si cambia initialSubTab desde el padre
  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(slugToProduccionSub(initialSubTab));
    }
  }, [initialSubTab]);

  const handleTabSelect = (tab: ProduccionSubTab) => {
    setActiveTab(tab);
    const slug = produccionSubToSlug(tab);
    try {
      localStorage.setItem("admin_produccion_subtab", slug);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("seccion", "produccion");
        params.set("sub", slug);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch {
      // ignore
    }
    if (onSubTabChange) onSubTabChange(slug);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/produccion");
      if (!res.ok) throw new Error("Error al obtener datos de producción");
      const json = await res.json();
      if (json && json.config) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sincronizar si cambia desde prop externa
  useEffect(() => {
    if (initialSubTab && initialSubTab.startsWith("produccion-")) {
      setActiveTab(initialSubTab as ProduccionSubTab);
    }
  }, [initialSubTab]);

  // Operaciones API
  const handleGuardarMaterial = async (material: Partial<MaterialItem>): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar-material", ...material }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleEliminarMaterial = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/produccion?tipo=material&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
        return true;
      }
      if (json.error) {
        alert(json.error);
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleGuardarProducto = async (producto: ProductoPayload): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar-producto", ...producto }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleEliminarProducto = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/produccion?tipo=producto&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
        return true;
      }
      if (json.error) {
        alert(json.error);
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleAdaptarTiempoReal = async (productoId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adaptar-tiempo-real", producto_id: productoId }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleActualizarConfig = async (cfg: Partial<ProduccionConfig>): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "actualizar-config", ...cfg }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleGuardarCampana = async (campana: CampanaPayload): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar-campana", ...campana }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleEliminarCampana = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/produccion?tipo=campana&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
        return true;
      }
      if (json.error) {
        alert(json.error);
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleActualizarMeta = async (
    campanaId: string,
    productoId: string,
    meta?: number,
    terminada?: number
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "actualizar-meta-campana",
          campana_id: campanaId,
          producto_id: productoId,
          cantidad_meta: meta,
          cantidad_terminada: terminada,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleToggleActiva = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-campana-activa", id }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleGuardarBitacora = async (registro: Partial<BitacoraRegistro>): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar-bitacora", ...registro }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleSumarPiezaRapida = async (
    productoId: string,
    campanaId?: string | null,
    cantidad: number = 1
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sumar-pieza-bitacora",
          producto_id: productoId,
          campana_id: campanaId,
          cantidad,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleEliminarBitacora = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/produccion?tipo=bitacora&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
        return true;
      }
      if (json.error) {
        alert(json.error);
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handlePublicarTienda = async (items: PublicarProductoItem[], catalogoSlug: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publicar-productos-tienda",
          items,
          catalogo_slug: catalogoSlug,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Sub-Pestañas Superior sin scroll: Cuadrícula responsiva para móvil, tablet y desktop */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#FDE8EF]/60">
          <div className="flex items-center gap-1.5 text-[#C04267] font-fredoka font-bold text-xs sm:text-sm">
            {(() => {
              const current = SUBTABS_NAV.find((s) => s.id === activeTab);
              const CurrentIcon = current?.icon || LayoutDashboard;
              return (
                <>
                  <CurrentIcon size={16} className="text-[#EE6B8D]" />
                  <span>Módulo: {current?.label}</span>
                </>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 px-2.5 rounded-xl text-gray-500 hover:text-[#C04267] hover:bg-pink-50 transition-colors flex items-center gap-1.5 text-xs font-quicksand font-bold cursor-pointer"
            title="Refrescar datos de producción"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#EE6B8D]" : ""} />
            <span className="hidden sm:inline">Actualizar datos</span>
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
          {SUBTABS_NAV.map((st) => {
            const Icon = st.icon;
            const isActive = activeTab === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleTabSelect(st.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 sm:py-2.5 rounded-xl font-quicksand text-[11px] sm:text-xs lg:text-sm font-semibold transition-all text-center cursor-pointer ${
                  isActive
                    ? "bg-[#EE6B8D] text-white shadow-sm font-bold scale-[1.01]"
                    : "text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] bg-pink-50/30 sm:bg-transparent"
                }`}
              >
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.7} className="shrink-0" />
                <span className="truncate max-w-full hidden xl:inline">{st.label}</span>
                <span className="truncate max-w-full xl:hidden">{st.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Loader2 size={32} className="animate-spin text-[#EE6B8D] mb-3" />
          <span className="font-quicksand text-xs font-semibold">
            Cargando módulos de producción y costeo...
          </span>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-700 font-quicksand text-xs flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {!loading && (
        <div className="animate-in fade-in duration-300">
          {activeTab === "produccion-dashboard" && (
            <ProduccionDashboardTab
              data={data}
              onNavigateTab={(tab) => handleTabSelect(tab as ProduccionSubTab)}
            />
          )}

          {activeTab === "produccion-materiales" && (
            <MaterialesBOMTab
              materiales={data.materiales}
              onGuardarMaterial={handleGuardarMaterial}
              onEliminarMaterial={handleEliminarMaterial}
            />
          )}

          {activeTab === "produccion-recetas" && (
            <EscandalloRecetasTab
              productos={data.productos}
              materiales={data.materiales}
              categorias={data.categorias}
              config={data.config}
              onGuardarProducto={handleGuardarProducto}
              onEliminarProducto={handleEliminarProducto}
              onActualizarConfig={handleActualizarConfig}
              onAdaptarTiempoReal={handleAdaptarTiempoReal}
            />
          )}

          {activeTab === "produccion-campanas" && (
            <CampanasFeriasTab
              campanas={data.campanas}
              productos={data.productos}
              eventos={data.eventos}
              config={data.config}
              onGuardarCampana={handleGuardarCampana}
              onEliminarCampana={handleEliminarCampana}
              onActualizarMeta={handleActualizarMeta}
              onToggleActiva={handleToggleActiva}
              onPublicarTienda={handlePublicarTienda}
            />
          )}

          {activeTab === "produccion-equilibrio" && (
            <PuntoEquilibrioTab
              campanas={data.campanas}
              productos={data.productos}
              onGuardarCampana={handleGuardarCampana}
            />
          )}

          {activeTab === "produccion-bitacora" && (
            <BitacoraTejidoTab
              bitacora={data.bitacora}
              productos={data.productos}
              materiales={data.materiales}
              campanas={data.campanas}
              config={data.config}
              onGuardarBitacora={handleGuardarBitacora}
              onSumarPiezaRapida={handleSumarPiezaRapida}
              onEliminarBitacora={handleEliminarBitacora}
            />
          )}
        </div>
      )}
    </div>
  );
}
