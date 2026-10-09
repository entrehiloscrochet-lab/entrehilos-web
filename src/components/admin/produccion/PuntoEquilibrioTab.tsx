"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Plus,
  DollarSign,
  PieChart,
  Scale,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  CampanaProduccion,
  ProductoProduccion,
  CampanaGasto,
} from "@/types/produccion";
import type { CampanaPayload } from "./CampanasFeriasTab";

interface PuntoEquilibrioTabProps {
  campanas: CampanaProduccion[];
  productos: ProductoProduccion[];
  onGuardarCampana: (campana: CampanaPayload) => Promise<boolean>;
}

const CATEGORIAS_GASTO = [
  "Stand",
  "Transporte",
  "Exhibición",
  "Publicidad",
  "Refrigerio",
  "Otros",
];

export default function PuntoEquilibrioTab({
  campanas,
  productos,
  onGuardarCampana,
}: PuntoEquilibrioTabProps) {
  const [campanaSeleccionadaId, setCampanaSeleccionadaId] = useState<string>(
    campanas[0]?.id || ""
  );

  // Form nuevo gasto
  const [conceptoInput, setConceptoInput] = useState("");
  const [categoriaInput, setCategoriaInput] = useState("Stand");
  const [montoInput, setMontoInput] = useState("");
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const campanaActiva = useMemo(() => {
    return campanas.find((c) => c.id === campanaSeleccionadaId) || campanas[0] || null;
  }, [campanas, campanaSeleccionadaId]);

  // Cálculos de Punto de Equilibrio (Break-Even)
  const analisisFinanciero = useMemo(() => {
    if (!campanaActiva) {
      return {
        totalGastosFijos: 0,
        mcuPromedio: 0,
        precioPromedio: 0,
        unidadesMinimas: 0,
        ventaBrutaMinima: 0,
        totalMetaUnidades: 0,
        ingresosTotalesProyectados: 0,
        costosVariablesProyectados: 0,
        utilidadNetaProyectada: 0,
        unidadesActualesTerminadas: 0,
        porcentajeEquilibrioAlcanzado: 0,
      };
    }

    // 1. Total Gastos Fijos (CF)
    const totalGastosFijos = (campanaActiva.gastos || []).reduce(
      (sum, g) => sum + (Number(g.monto) || 0),
      0
    );

    // 2. Margen de Contribución por unidad de cada producto asignado
    const items = campanaActiva.items || [];
    let sumaGananciaUnitaria = 0;
    let sumaPrecios = 0;
    let countProds = 0;

    let totalMetaUnidades = 0;
    let unidadesActualesTerminadas = 0;
    let ingresosTotalesProyectados = 0;
    let costosVariablesProyectados = 0;

    items.forEach((it) => {
      const prod = it.producto || productos.find((p) => p.id === it.producto_id);
      if (prod) {
        const gananciaUnit = Math.max(0, prod.precio_venta_real - prod.costo_total);
        sumaGananciaUnitaria += gananciaUnit;
        sumaPrecios += prod.precio_venta_real;
        countProds++;

        totalMetaUnidades += it.cantidad_meta;
        unidadesActualesTerminadas += it.cantidad_terminada;
        ingresosTotalesProyectados += it.cantidad_meta * prod.precio_venta_real;
        costosVariablesProyectados += it.cantidad_meta * prod.costo_total;
      }
    });

    // Margen de Contribución Promedio por Unidad (MCU)
    const mcuPromedio = countProds > 0 ? sumaGananciaUnitaria / countProds : 0;
    const precioPromedio = countProds > 0 ? sumaPrecios / countProds : 0;

    // Unidades Mínimas a Vender: ceil(CF / MCU)
    const unidadesMinimas = mcuPromedio > 0 ? Math.ceil(totalGastosFijos / mcuPromedio) : 0;

    // Venta Bruta Mínima requerida: Unidades Mínimas * Precio Promedio
    const ventaBrutaMinima = Number((unidadesMinimas * precioPromedio).toFixed(2));

    // Utilidad Neta Proyectada = Ingresos Proyectados - Costos Totales Insumos/MO - Gastos Fijos
    const utilidadNetaProyectada = Number(
      (ingresosTotalesProyectados - costosVariablesProyectados - totalGastosFijos).toFixed(2)
    );

    const porcentajeEquilibrioAlcanzado =
      unidadesMinimas > 0
        ? Math.min(100, Math.round((unidadesActualesTerminadas / unidadesMinimas) * 100))
        : 100;

    return {
      totalGastosFijos: Number(totalGastosFijos.toFixed(2)),
      mcuPromedio: Number(mcuPromedio.toFixed(2)),
      precioPromedio: Number(precioPromedio.toFixed(2)),
      unidadesMinimas,
      ventaBrutaMinima,
      totalMetaUnidades,
      ingresosTotalesProyectados: Number(ingresosTotalesProyectados.toFixed(2)),
      costosVariablesProyectados: Number(costosVariablesProyectados.toFixed(2)),
      utilidadNetaProyectada,
      unidadesActualesTerminadas,
      porcentajeEquilibrioAlcanzado,
    };
  }, [campanaActiva, productos]);

  const handleAgregarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campanaActiva || !conceptoInput.trim()) return;

    setGuardandoGasto(true);
    const nuevoGasto: CampanaGasto = {
      id: `cgasto-${Date.now()}`,
      campana_id: campanaActiva.id,
      concepto: conceptoInput.trim(),
      categoria: categoriaInput,
      monto: parseFloat(montoInput) || 0,
    };

    const payload = {
      ...campanaActiva,
      gastos: [...(campanaActiva.gastos || []), nuevoGasto],
    };

    const ok = await onGuardarCampana(payload);
    setGuardandoGasto(false);
    if (ok) {
      setConceptoInput("");
      setMontoInput("");
    }
  };

  const handleEliminarGasto = async (gastoId: string) => {
    if (!campanaActiva) return;
    const payload = {
      ...campanaActiva,
      gastos: (campanaActiva.gastos || []).filter((g) => g.id !== gastoId),
    };
    await onGuardarCampana(payload);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
            <Scale className="text-[#EE6B8D]" size={22} />
            Gastos Fijos y Meta Financiera
          </h3>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Calcula tus gastos fijos de evento (alquiler de stand, pasajes, movilidad) y cuántas piezas necesitas vender para cubrirlos.
          </p>
        </div>

        {campanas.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-quicksand font-bold text-gray-600">Evento / Feria:</label>
            <select
              value={campanaActiva?.id || ""}
              onChange={(e) => setCampanaSeleccionadaId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-pink-200 bg-[#FDF4F7] text-xs font-quicksand font-bold text-[#C04267] focus:outline-none"
            >
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!campanaActiva ? (
        <div className="py-16 bg-white rounded-2xl border border-[#FDE8EF] text-center text-gray-400 font-quicksand">
          <Scale size={40} className="mx-auto text-gray-300 mb-2" />
          Crea una campaña en &quot;Campañas / Ferias&quot; para registrar los gastos fijos.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas Principales del Punto de Equilibrio adaptadas a Tablet y Celular */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Total Costos Fijos (CF)
              </div>
              <div className="font-fredoka text-2xl font-bold text-gray-800 mt-1">
                S/ {analisisFinanciero.totalGastosFijos.toFixed(2)}
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                Stand, flete, toldo, viáticos
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Margen Contribución (MCU)
              </div>
              <div className="font-fredoka text-2xl font-bold text-[#C04267] mt-1">
                S/ {analisisFinanciero.mcuPromedio.toFixed(2)}
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                Ganancia neta promedio / unidad
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-[#EE6B8D]/40 bg-pink-50/30 shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-[#C04267] uppercase tracking-wide">
                Punto de Equilibrio (Meta Mínima)
              </div>
              <div className="font-fredoka text-2xl font-bold text-[#C04267] mt-1 flex items-baseline gap-1">
                <span>{analisisFinanciero.unidadesMinimas}</span>
                <span className="text-xs font-quicksand font-normal text-gray-600">unidades mínimas</span>
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                Para no perder ni un sol de stand
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
              <div className="text-[11px] font-quicksand font-bold text-gray-400 uppercase tracking-wide">
                Venta Bruta Mínima
              </div>
              <div className="font-fredoka text-2xl font-bold text-emerald-600 mt-1">
                S/ {analisisFinanciero.ventaBrutaMinima.toFixed(2)}
              </div>
              <div className="text-[11px] font-quicksand text-gray-500 mt-0.5">
                A precio promedio de S/ {analisisFinanciero.precioPromedio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Proyección Total de Utilidad vs Gastos Fijos */}
          <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
            <h4 className="font-fredoka text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-[#EE6B8D]" />
              Proyección de Utilidad Neta Total para &quot;{campanaActiva.nombre}&quot;
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#FDF4F7] font-quicksand text-xs">
              <div>
                <div className="text-gray-500">Venta Total Proyectada (Metas):</div>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  S/ {analisisFinanciero.ingresosTotalesProyectados.toFixed(2)}{" "}
                  <span className="text-[10px] text-gray-400">({analisisFinanciero.totalMetaUnidades} uds)</span>
                </div>
              </div>

              <div>
                <div className="text-gray-500">Costos Variables (Insumos + Tejido):</div>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  - S/ {analisisFinanciero.costosVariablesProyectados.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Utilidad Neta Libre de Feria:</div>
                <div
                  className={`font-fredoka text-base font-bold mt-0.5 ${
                    analisisFinanciero.utilidadNetaProyectada >= 0
                      ? "text-emerald-700"
                      : "text-rose-600"
                  }`}
                >
                  S/ {analisisFinanciero.utilidadNetaProyectada.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Barra de progreso hacia el Punto de Equilibrio */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs font-quicksand font-bold text-gray-700 mb-1.5">
                <span>
                  Progreso hacia el Break-Even: {analisisFinanciero.unidadesActualesTerminadas} de{" "}
                  {analisisFinanciero.unidadesMinimas} unidades producidas
                </span>
                <span className="text-[#C04267]">
                  {analisisFinanciero.porcentajeEquilibrioAlcanzado}%
                </span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    analisisFinanciero.porcentajeEquilibrioAlcanzado >= 100
                      ? "bg-emerald-500"
                      : "bg-[#EE6B8D]"
                  }`}
                  style={{ width: `${Math.min(100, analisisFinanciero.porcentajeEquilibrioAlcanzado)}%` }}
                />
              </div>
              <div className="text-[11px] font-quicksand text-gray-400 mt-1">
                {analisisFinanciero.porcentajeEquilibrioAlcanzado >= 100
                  ? "¡Ya tienes suficiente producción terminada para cubrir el costo del stand y comenzar a generar ganancias netas!"
                  : `Faltan terminar ${Math.max(0, analisisFinanciero.unidadesMinimas - analisisFinanciero.unidadesActualesTerminadas)} unidades para garantizar la cobertura total de costos fijos.`}
              </div>
            </div>
          </div>

          {/* Registro y Detalle de Gastos Fijos del Evento */}
          <div className="bg-white rounded-2xl border border-[#FDE8EF] p-5 shadow-xs">
            <h4 className="font-fredoka text-base font-bold text-gray-800 mb-3 flex items-center justify-between">
              <span>Registro de Gastos Fijos de la Feria</span>
              <span className="text-xs font-quicksand font-bold text-[#C04267]">
                Total: S/ {analisisFinanciero.totalGastosFijos.toFixed(2)}
              </span>
            </h4>

            {/* Formulario rápido para añadir gasto */}
            <form
              onSubmit={handleAgregarGasto}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-gray-50 p-3 rounded-2xl mb-4 font-quicksand text-xs"
            >
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={conceptoInput}
                  onChange={(e) => setConceptoInput(e.target.value)}
                  placeholder="Concepto (ej. Alquiler toldo 2x2, Flete de ida, Banners)..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={categoriaInput}
                  onChange={(e) => setCategoriaInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:border-[#EE6B8D] focus:outline-none"
                >
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={montoInput}
                  onChange={(e) => setMontoInput(e.target.value)}
                  placeholder="S/ Monto"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-center focus:border-[#EE6B8D] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={guardandoGasto}
                  className="px-4 py-2 rounded-xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-bold shrink-0 shadow-xs active:scale-95 transition-all"
                >
                  + Agregar
                </button>
              </div>
            </form>

            {/* Lista de gastos registrados */}
            {(!campanaActiva.gastos || campanaActiva.gastos.length === 0) ? (
              <div className="text-center py-6 text-xs text-gray-400 font-quicksand">
                No hay gastos fijos registrados para este evento. Agrega el stand o transporte arriba.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 font-quicksand text-xs">
                {campanaActiva.gastos.map((g) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-pink-50 text-[#C04267] text-[10px] font-bold border border-pink-100">
                        {g.categoria}
                      </span>
                      <span className="font-semibold text-gray-800">{g.concepto}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">S/ {Number(g.monto).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarGasto(g.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar gasto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
