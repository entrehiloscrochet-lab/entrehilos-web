"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Download,
  Edit2,
  Trash2,
  Sparkles,
  PackageCheck,
  ChevronRight,
  Info,
  Layers,
  ShoppingBag,
} from "lucide-react";
import {
  CampanaProduccion,
  CampanaGasto,
  ProductoProduccion,
  CampanaItem,
  ProduccionConfig,
  EventoCatalogoItem,
  PublicarProductoItem,
} from "@/types/produccion";
import { exportarListaEmpaqueCampana } from "./exportUtils";
import PublicarTiendaModal from "./PublicarTiendaModal";

export interface CampanaPayload {
  id?: string;
  nombre?: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  activa?: boolean;
  items?: Array<{
    id?: string;
    campana_id?: string;
    producto_id?: string;
    cantidad_meta?: number;
    cantidad_terminada?: number;
    producto?: ProductoProduccion;
  }>;
  gastos?: CampanaGasto[];
  created_at?: string;
}

interface CampanasFeriasTabProps {
  campanas: CampanaProduccion[];
  productos: ProductoProduccion[];
  eventos?: EventoCatalogoItem[];
  config: ProduccionConfig;
  onGuardarCampana: (campana: CampanaPayload) => Promise<boolean>;
  onEliminarCampana: (id: string) => Promise<boolean>;
  onActualizarMeta: (campanaId: string, productoId: string, meta?: number, terminada?: number) => Promise<boolean>;
  onToggleActiva: (id: string) => Promise<boolean>;
  onPublicarTienda?: (items: PublicarProductoItem[], catalogoSlug: string) => Promise<boolean>;
}

function calcularDiasRestantes(fechaFin: string): number {
  if (!fechaFin) return 1;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  const diffTime = fin.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export default function CampanasFeriasTab({
  campanas,
  productos,
  eventos = [],
  config,
  onGuardarCampana,
  onEliminarCampana,
  onActualizarMeta,
  onToggleActiva,
  onPublicarTienda,
}: CampanasFeriasTabProps) {
  const [campanaSeleccionadaId, setCampanaSeleccionadaId] = useState<string>(
    campanas[0]?.id || ""
  );
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalPublicarAbierto, setModalPublicarAbierto] = useState(false);
  const [editando, setEditando] = useState<CampanaProduccion | null>(null);

  // Form Campaña
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formFechaInicio, setFormFechaInicio] = useState("");
  const [formFechaFin, setFormFechaFin] = useState("");
  const [formItems, setFormItems] = useState<{ producto_id: string; cantidad_meta: number; cantidad_terminada: number }[]>([]);
  const [guardando, setGuardando] = useState(false);

  const campanaActiva = useMemo(() => {
    return campanas.find((c) => c.id === campanaSeleccionadaId) || campanas[0] || null;
  }, [campanas, campanaSeleccionadaId]);

  const abrirModalNueva = () => {
    setEditando(null);
    setFormNombre("");
    setFormDescripcion("");
    const hoyStr = new Date().toISOString().split("T")[0];
    const finStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    setFormFechaInicio(hoyStr);
    setFormFechaFin(finStr);
    setFormItems(
      productos.slice(0, 3).map((p) => ({
        producto_id: p.id,
        cantidad_meta: 10,
        cantidad_terminada: 0,
      }))
    );
    setModalAbierto(true);
  };

  const abrirModalEditar = (c: CampanaProduccion) => {
    setEditando(c);
    setFormNombre(c.nombre);
    setFormDescripcion(c.descripcion || "");
    setFormFechaInicio(c.fecha_inicio);
    setFormFechaFin(c.fecha_fin);
    setFormItems(
      c.items.map((it) => ({
        producto_id: it.producto_id,
        cantidad_meta: it.cantidad_meta,
        cantidad_terminada: it.cantidad_terminada,
      }))
    );
    setModalAbierto(true);
  };

  const agregarFilaProducto = () => {
    if (productos.length === 0) return;
    setFormItems((prev) => [
      ...prev,
      { producto_id: productos[0].id, cantidad_meta: 10, cantidad_terminada: 0 },
    ]);
  };

  const eliminarFilaProducto = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    setGuardando(true);
    const payload = {
      id: editando ? editando.id : undefined,
      nombre: formNombre.trim(),
      descripcion: formDescripcion.trim(),
      fecha_inicio: formFechaInicio,
      fecha_fin: formFechaFin,
      activa: editando ? editando.activa : true,
      items: formItems.map((it, idx) => ({
        id: `citem-${Date.now()}-${idx}`,
        producto_id: it.producto_id,
        cantidad_meta: Number(it.cantidad_meta) || 0,
        cantidad_terminada: Number(it.cantidad_terminada) || 0,
      })),
      gastos: editando ? editando.gastos : [],
    };

    const ok = await onGuardarCampana(payload);
    setGuardando(false);
    if (ok) {
      setModalAbierto(false);
      if (!editando && payload.id) setCampanaSeleccionadaId(payload.id);
    }
  };

  // Cálculos en tiempo real de la campaña seleccionada
  const metricasCampana = useMemo(() => {
    if (!campanaActiva) {
      return {
        diasRestantes: 0,
        totalMeta: 0,
        totalTerminadas: 0,
        totalFaltantes: 0,
        porcentajeAvance: 0,
        horasRestantes: 0,
        ritmoDiario: 0,
        esSobrecarga: false,
      };
    }

    const diasRestantes = calcularDiasRestantes(campanaActiva.fecha_fin);
    let totalMeta = 0;
    let totalTerminadas = 0;
    let totalFaltantes = 0;
    let horasRestantes = 0;

    campanaActiva.items.forEach((it) => {
      const prod = it.producto || productos.find((p) => p.id === it.producto_id);
      const meta = it.cantidad_meta;
      const term = it.cantidad_terminada;
      const falt = Math.max(0, meta - term);
      const tProd = prod?.tiempo_produccion || 1;

      totalMeta += meta;
      totalTerminadas += term;
      totalFaltantes += falt;
      horasRestantes += falt * tProd;
    });

    const porcentajeAvance = totalMeta > 0 ? Math.round((totalTerminadas / totalMeta) * 100) : 100;
    const ritmoDiario = diasRestantes > 0 ? Number((horasRestantes / diasRestantes).toFixed(1)) : horasRestantes;
    const esSobrecarga = ritmoDiario > (config.limite_horas_dia_alerta || 4.5);

    return {
      diasRestantes,
      totalMeta,
      totalTerminadas,
      totalFaltantes,
      porcentajeAvance,
      horasRestantes: Number(horasRestantes.toFixed(1)),
      ritmoDiario,
      esSobrecarga,
    };
  }, [campanaActiva, productos, config.limite_horas_dia_alerta]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
            <Calendar className="text-[#EE6B8D]" size={22} />
            Planificación de Campañas y Ferias
          </h3>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Control de metas de stock por evento, días restantes y alerta visual preventiva de sobrecarga de tejido.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {campanaActiva && (
            <button
              type="button"
              onClick={() => exportarListaEmpaqueCampana(campanaActiva)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FDE8EF] text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] font-quicksand text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Descargar lista de empaque en CSV"
            >
              <Download size={14} />
              <span>Lista de Empaque</span>
            </button>
          )}

          {campanaActiva && onPublicarTienda && (
            <button
              type="button"
              onClick={() => setModalPublicarAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-50 border border-pink-200 text-[#C04267] hover:bg-pink-100 font-quicksand text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Sumar piezas terminadas de esta campaña al catálogo de la tienda"
            >
              <ShoppingBag size={14} />
              <span>Publicar en Tienda</span>
            </button>
          )}

          <button
            type="button"
            onClick={abrirModalNueva}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EE6B8D] text-white hover:bg-[#C04267] font-quicksand text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} />
            <span>Nueva Campaña / Feria</span>
          </button>
        </div>
      </div>

      {/* Selector de Campañas (Tabs horizontales) */}
      {campanas.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {campanas.map((c) => {
            const isSelected = c.id === (campanaActiva?.id || "");
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCampanaSeleccionadaId(c.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-quicksand font-bold shrink-0 transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-[#C04267] text-white shadow-md scale-102"
                    : "bg-white text-gray-600 border border-[#FDE8EF] hover:bg-[#FDF4F7]"
                }`}
              >
                <span>{c.nombre}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.items.length} modelos
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detalle de Campaña Activa */}
      {!campanaActiva ? (
        <div className="py-16 bg-white rounded-2xl border border-[#FDE8EF] text-center text-gray-400 font-quicksand">
          <Calendar size={40} className="mx-auto text-gray-300 mb-2" />
          No hay campañas creadas aún. Pulsa en &quot;Nueva Campaña / Feria&quot; para comenzar a planificar.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alerta de Sobrecarga si Ritmo Diario > 4.5 hrs/día */}
          {metricasCampana.esSobrecarga && (
            <div className="bg-rose-50 border-2 border-rose-300/80 p-4 rounded-2xl flex items-start gap-3.5 text-rose-800 shadow-sm animate-in fade-in">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="font-fredoka text-sm sm:text-base font-bold text-rose-700">
                  Alerta: Sobrecarga de producción. Riesgo de retraso o fatiga académica.
                </div>
                <p className="font-quicksand text-xs sm:text-sm text-rose-600 mt-0.5">
                  El ritmo necesario es de <strong>{metricasCampana.ritmoDiario} hrs/día</strong> durante los próximos{" "}
                  <strong>{metricasCampana.diasRestantes} días</strong> (límite saludable: {config.limite_horas_dia_alerta} hrs/día). Considera reajustar metas o convocar apoyo de tejido.
                </p>
              </div>
            </div>
          )}

          {/* Tarjetas KPI de la Campaña adaptadas a Tablet (2 cols vertical, 4 cols horizontal) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Días Restantes
              </div>
              <div className="font-fredoka text-2xl font-bold text-[#C04267] mt-1">
                {metricasCampana.diasRestantes} días
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                Límite: {campanaActiva.fecha_fin}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Avance de Stock
              </div>
              <div className="font-fredoka text-2xl font-bold text-gray-800 mt-1">
                {metricasCampana.totalTerminadas} / {metricasCampana.totalMeta}
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#EE6B8D] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metricasCampana.porcentajeAvance)}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Horas Pendientes
              </div>
              <div className="font-fredoka text-2xl font-bold text-gray-800 mt-1">
                {metricasCampana.horasRestantes} hrs
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                {metricasCampana.totalFaltantes} piezas faltantes
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Ritmo Diario Necesario
              </div>
              <div
                className={`font-fredoka text-2xl font-bold mt-1 ${
                  metricasCampana.esSobrecarga ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {metricasCampana.ritmoDiario} h/día
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                {metricasCampana.esSobrecarga ? "Exceso de carga" : "Ritmo saludable"}
              </div>
            </div>
          </div>

          {/* Tabla de Metas por Producto */}
          <div className="bg-white rounded-2xl border border-[#FDE8EF] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#FDE8EF] flex items-center justify-between">
              <div>
                <h4 className="font-fredoka text-base font-bold text-gray-800">
                  Metas de Producción: {campanaActiva.nombre}
                </h4>
                {campanaActiva.descripcion && (
                  <p className="font-quicksand text-xs text-gray-500">{campanaActiva.descripcion}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => abrirModalEditar(campanaActiva)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-[#EE6B8D] hover:bg-pink-50 transition-colors"
                  title="Editar campaña y metas"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Deseas eliminar la campaña "${campanaActiva.nombre}"?`)) {
                      onEliminarCampana(campanaActiva.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar campaña"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Vista Móvil (< md): Tarjetas completas por producto (sin scroll horizontal) */}
            <div className="md:hidden divide-y divide-[#FDE8EF]">
              {campanaActiva.items.map((it) => {
                const prod = it.producto || productos.find((p) => p.id === it.producto_id);
                const faltantes = Math.max(0, it.cantidad_meta - it.cantidad_terminada);
                const tProd = prod?.tiempo_produccion || 1;
                const horasRest = Number((faltantes * tProd).toFixed(1));
                const avance =
                  it.cantidad_meta > 0
                    ? Math.min(100, Math.round((it.cantidad_terminada / it.cantidad_meta) * 100))
                    : 100;
                const completado = faltantes === 0;

                return (
                  <div key={it.id} className="p-4 space-y-3 font-quicksand">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-800 text-sm truncate">{prod?.nombre || "Producto"}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {prod?.categoria} • {tProd}h por pieza
                        </div>
                      </div>

                      {completado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-xs shrink-0">
                          <CheckCircle2 size={13} />
                          Completado
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#C04267] bg-pink-50 border border-pink-100 px-2.5 py-0.5 rounded-full shrink-0">
                          {avance}%
                        </span>
                      )}
                    </div>

                    {/* Barra de Progreso */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">Avance de producción:</span>
                        <span className="font-bold text-gray-800">
                          {it.cantidad_terminada} / {it.cantidad_meta} hechas
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            completado ? "bg-emerald-500" : "bg-[#EE6B8D]"
                          }`}
                          style={{ width: `${avance}%` }}
                        />
                      </div>
                    </div>

                    {/* Faltantes y Horas */}
                    <div className="grid grid-cols-2 gap-2 bg-[#FDF4F7] p-2.5 rounded-2xl text-xs">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Faltan tejer</div>
                        <div className="font-bold text-gray-700 mt-0.5">
                          {completado ? "0 piezas" : `${faltantes} piezas`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Horas pendientes</div>
                        <div className="font-bold text-gray-700 mt-0.5">
                          {completado ? "0 hrs" : `${horasRest} hrs`}
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción directos */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onActualizarMeta(
                            campanaActiva.id,
                            it.producto_id,
                            undefined,
                            Math.max(0, it.cantidad_terminada - 1)
                          )
                        }
                        disabled={it.cantidad_terminada <= 0}
                        className="w-10 h-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-bold disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Restar 1 pieza"
                      >
                        -1
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onActualizarMeta(
                            campanaActiva.id,
                            it.producto_id,
                            undefined,
                            it.cantidad_terminada + 1
                          )
                        }
                        className="flex-1 py-2.5 px-3 rounded-xl bg-pink-100 hover:bg-[#EE6B8D] hover:text-white text-[#C04267] font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <span>+1 Pieza Terminada</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista Desktop / Tablet (>= md): Tabla completa */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm font-quicksand min-w-[700px]">
                <thead className="bg-[#FDF4F7] text-[#C04267] font-fredoka font-semibold border-b border-[#FDE8EF]">
                  <tr>
                    <th className="py-3 px-4">Modelo / Producto</th>
                    <th className="py-3 px-4 text-center">Meta Planificada</th>
                    <th className="py-3 px-4 text-center">Terminadas</th>
                    <th className="py-3 px-4 text-center">Faltantes</th>
                    <th className="py-3 px-4 text-center">Horas Pendientes</th>
                    <th className="py-3 px-4 text-center">% Avance</th>
                    <th className="py-3 px-4 text-right">Sumar +1 Pieza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FDE8EF]">
                  {campanaActiva.items.map((it) => {
                    const prod = it.producto || productos.find((p) => p.id === it.producto_id);
                    const faltantes = Math.max(0, it.cantidad_meta - it.cantidad_terminada);
                    const tProd = prod?.tiempo_produccion || 1;
                    const horasRest = Number((faltantes * tProd).toFixed(1));
                    const avance =
                      it.cantidad_meta > 0
                        ? Math.min(100, Math.round((it.cantidad_terminada / it.cantidad_meta) * 100))
                        : 100;
                    const completado = faltantes === 0;

                    return (
                      <tr key={it.id} className="hover:bg-pink-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-800">
                          <div>{prod?.nombre || "Producto"}</div>
                          <div className="text-[11px] text-gray-400 font-normal">
                            {prod?.categoria} • {tProd}h por pieza
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                          {it.cantidad_meta}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-bold text-sm ${
                              completado ? "text-emerald-600" : "text-[#C04267]"
                            }`}
                          >
                            {it.cantidad_terminada}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {completado ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                              <CheckCircle2 size={13} />
                              Completado
                            </span>
                          ) : (
                            <span className="font-bold text-gray-700">{faltantes}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center text-gray-600 font-semibold">
                          {horasRest} hrs
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  completado ? "bg-emerald-500" : "bg-[#EE6B8D]"
                                }`}
                                style={{ width: `${avance}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-gray-600">{avance}%</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onActualizarMeta(
                                  campanaActiva.id,
                                  it.producto_id,
                                  undefined,
                                  Math.max(0, it.cantidad_terminada - 1)
                                )
                              }
                              disabled={it.cantidad_terminada <= 0}
                              className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-bold disabled:opacity-30"
                              title="Restar 1 pieza"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onActualizarMeta(
                                  campanaActiva.id,
                                  it.producto_id,
                                  undefined,
                                  it.cantidad_terminada + 1
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-pink-100 hover:bg-[#EE6B8D] hover:text-white text-[#C04267] font-bold text-xs transition-all shadow-xs"
                              title="Sumar 1 pieza terminada"
                            >
                              +1 Terminada
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Campaña */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 border border-[#FDE8EF] shadow-2xl animate-in fade-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h4 className="font-fredoka text-lg font-bold text-[#C04267]">
                {editando ? "Editar Campaña / Feria" : "Nueva Campaña / Feria"}
              </h4>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 font-quicksand text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nombre del Evento / Campaña *
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="ej. Feria Plaza Pisco 2026, Campaña Día de la Madre"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Descripción u Objetivo (opcional)
                </label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="ej. Stand presencial de 3 días con exhibición amigurumi"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={formFechaInicio}
                    onChange={(e) => setFormFechaInicio(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Fecha Límite / Cierre *
                  </label>
                  <input
                    type="date"
                    required
                    value={formFechaFin}
                    onChange={(e) => setFormFechaFin(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Asignación de Metas de Productos */}
              <div className="border border-gray-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 flex items-center gap-1.5">
                    <Layers size={14} className="text-[#EE6B8D]" />
                    Modelos Asignados a la Feria
                  </label>
                  <button
                    type="button"
                    onClick={agregarFilaProducto}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 text-[#C04267] hover:bg-pink-100 font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={13} />
                    <span>Agregar Modelo</span>
                  </button>
                </div>

                {formItems.length === 0 ? (
                  <div className="text-gray-400 py-2 text-center">
                    No has asignado productos a esta campaña aún.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formItems.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                        <select
                          value={it.producto_id}
                          onChange={(e) => {
                            const copy = [...formItems];
                            copy[idx].producto_id = e.target.value;
                            setFormItems(copy);
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold focus:border-[#EE6B8D] focus:outline-none truncate"
                        >
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.tiempo_produccion}h)
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-gray-500">Meta:</label>
                          <input
                            type="number"
                            min="1"
                            value={it.cantidad_meta}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].cantidad_meta = parseInt(e.target.value) || 0;
                              setFormItems(copy);
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 bg-white text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-gray-500">Term.:</label>
                          <input
                            type="number"
                            min="0"
                            value={it.cantidad_terminada}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].cantidad_terminada = parseInt(e.target.value) || 0;
                              setFormItems(copy);
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 bg-white text-center font-bold text-[#C04267]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarFilaProducto(idx)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-bold transition-all disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : editando ? "Actualizar Campaña" : "Crear Campaña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Publicar lo Producido a la Tienda Web */}
      {modalPublicarAbierto && onPublicarTienda && (
        <PublicarTiendaModal
          isOpen={modalPublicarAbierto}
          onClose={() => setModalPublicarAbierto(false)}
          campana={campanaActiva}
          productos={productos}
          eventos={eventos}
          onPublicarExitoso={onPublicarTienda}
        />
      )}
    </div>
  );
}
