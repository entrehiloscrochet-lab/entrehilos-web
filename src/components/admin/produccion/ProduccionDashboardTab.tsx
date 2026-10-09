"use client";

import React, { useMemo } from "react";
import {
  LayoutDashboard,
  Layers,
  Calculator,
  Calendar,
  Scale,
  Smartphone,
  TrendingUp,
  Clock,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Download,
  Printer,
} from "lucide-react";
import {
  ResumenProduccionData,
  ProductoProduccion,
  CampanaProduccion,
} from "@/types/produccion";
import { exportarReporteCostos, exportarBOMMateriales } from "./exportUtils";

interface ProduccionDashboardTabProps {
  data: ResumenProduccionData;
  onNavigateTab: (tabId: string) => void;
}

export default function ProduccionDashboardTab({
  data,
  onNavigateTab,
}: ProduccionDashboardTabProps) {
  const { config, materiales, productos, campanas, bitacora } = data;

  // Campaña principal o primera activa
  const campanaActiva = useMemo(() => {
    return campanas.find((c) => c.activa) || campanas[0] || null;
  }, [campanas]);

  // KPIs Globales
  const kpis = useMemo(() => {
    let totalMeta = 0;
    let totalTerminadas = 0;
    let totalFaltantes = 0;
    let totalHorasPendientes = 0;

    (campanas || []).forEach((c) => {
      (c.items || []).forEach((it) => {
        const prod = it.producto || productos.find((p) => p.id === it.producto_id);
        const meta = it.cantidad_meta;
        const term = it.cantidad_terminada;
        const falt = Math.max(0, meta - term);
        const tProd = prod?.tiempo_produccion || 1;

        totalMeta += meta;
        totalTerminadas += term;
        totalFaltantes += falt;
        totalHorasPendientes += falt * tProd;
      });
    });

    const porcentajeAvanceGlobal = totalMeta > 0 ? Math.round((totalTerminadas / totalMeta) * 100) : 100;

    // Cálculo Break-Even del Stand de la campaña activa
    let totalGastosFijosStand = 0;
    let mcuPromedio = 0;
    let unidadesMinimasStand = 0;

    if (campanaActiva) {
      totalGastosFijosStand = (campanaActiva.gastos || []).reduce(
        (sum, g) => sum + (Number(g.monto) || 0),
        0
      );

      let sumaMCU = 0;
      let countMCU = 0;
      (campanaActiva.items || []).forEach((it) => {
        const prod = it.producto || productos.find((p) => p.id === it.producto_id);
        if (prod) {
          sumaMCU += Math.max(0, prod.precio_venta_real - prod.costo_total);
          countMCU++;
        }
      });
      mcuPromedio = countMCU > 0 ? sumaMCU / countMCU : 0;
      unidadesMinimasStand = mcuPromedio > 0 ? Math.ceil(totalGastosFijosStand / mcuPromedio) : 0;
    }

    // Ritmo diario para campaña activa
    let diasRestantes = 1;
    let ritmoDiarioCampana = 0;
    let esSobrecarga = false;

    if (campanaActiva?.fecha_fin) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fin = new Date(campanaActiva.fecha_fin + "T00:00:00");
      diasRestantes = Math.max(1, Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));

      let horasCamp = 0;
      (campanaActiva.items || []).forEach((it) => {
        const prod = it.producto || productos.find((p) => p.id === it.producto_id);
        const falt = Math.max(0, it.cantidad_meta - it.cantidad_terminada);
        horasCamp += falt * (prod?.tiempo_produccion || 1);
      });
      ritmoDiarioCampana = Number((horasCamp / diasRestantes).toFixed(1));
      esSobrecarga = ritmoDiarioCampana > (config.limite_horas_dia_alerta || 4.5);
    }

    return {
      totalMeta,
      totalTerminadas,
      totalFaltantes,
      totalHorasPendientes: Number(totalHorasPendientes.toFixed(1)),
      porcentajeAvanceGlobal,
      totalGastosFijosStand,
      unidadesMinimasStand,
      diasRestantes,
      ritmoDiarioCampana,
      esSobrecarga,
    };
  }, [campanas, productos, campanaActiva, config.limite_horas_dia_alerta]);

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
            <LayoutDashboard className="text-[#EE6B8D]" size={22} />
            Dashboard de Producción y Costeo
          </h3>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Resumen integral de insumos, horas de tejido requeridas, punto de equilibrio y metas para ferias.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportarReporteCostos(productos, config.tarifa_hora)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FDE8EF] text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] font-quicksand text-xs font-semibold transition-all shadow-xs"
            title="Exportar escandallo de costos a Excel"
          >
            <Download size={14} />
            <span>Exportar Costos</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FDE8EF] text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] font-quicksand text-xs font-semibold transition-all shadow-xs"
            title="Imprimir o guardar en PDF"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("produccion-bitacora")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EE6B8D] text-white hover:bg-[#C04267] font-quicksand text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <Smartphone size={15} />
            <span>Abrir Bitácora Móvil</span>
          </button>
        </div>
      </div>

      {/* Banner de alerta preventiva de sobrecarga si aplica */}
      {kpis.esSobrecarga && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl flex items-start gap-3.5 text-rose-800 shadow-sm animate-in fade-in">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="font-fredoka text-sm sm:text-base font-bold text-rose-700">
              Alerta: Sobrecarga de producción. Riesgo de retraso o fatiga académica.
            </div>
            <p className="font-quicksand text-xs sm:text-sm text-rose-600 mt-0.5">
              La campaña actual requiere tejer <strong>{kpis.ritmoDiarioCampana} hrs/día</strong> durante los próximos{" "}
              <strong>{kpis.diasRestantes} días</strong> (límite saludable: {config.limite_horas_dia_alerta} hrs/día). Revisa tus metas en el módulo de campañas.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas KPI Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-quicksand font-bold uppercase tracking-wide">
              Piezas Faltantes
            </span>
            <PackageCheck size={18} className="text-[#EE6B8D]" />
          </div>
          <div className="font-fredoka text-2xl sm:text-3xl font-bold text-gray-800">
            {kpis.totalFaltantes}
          </div>
          <div className="text-[11px] font-quicksand text-gray-500 mt-1">
            De {kpis.totalMeta} planificadas en ferias
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-quicksand font-bold uppercase tracking-wide">
              Horas Pendientes
            </span>
            <Clock size={18} className="text-[#EE6B8D]" />
          </div>
          <div className="font-fredoka text-2xl sm:text-3xl font-bold text-[#C04267]">
            {kpis.totalHorasPendientes} hrs
          </div>
          <div className="text-[11px] font-quicksand text-gray-500 mt-1">
            Tarifa base: S/ {config.tarifa_hora.toFixed(2)}/h
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-quicksand font-bold uppercase tracking-wide">
              Avance Global
            </span>
            <TrendingUp size={18} className="text-[#EE6B8D]" />
          </div>
          <div className="font-fredoka text-2xl sm:text-3xl font-bold text-gray-800">
            {kpis.porcentajeAvanceGlobal}%
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#EE6B8D] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.porcentajeAvanceGlobal)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FDE8EF] shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-quicksand font-bold uppercase tracking-wide">
              Equilibrio Stand
            </span>
            <Scale size={18} className="text-[#EE6B8D]" />
          </div>
          <div className="font-fredoka text-2xl sm:text-3xl font-bold text-[#C04267]">
            {kpis.unidadesMinimasStand} uds
          </div>
          <div className="text-[11px] font-quicksand text-gray-500 mt-1">
            Cubre S/ {kpis.totalGastosFijosStand.toFixed(2)} de costos fijos
          </div>
        </div>
      </div>

      {/* Accesos Rápidos a Módulos del Sistema */}
      <div>
        <h4 className="font-fredoka text-base sm:text-lg font-bold text-[#C04267] mb-3">
          Módulos de tu Taller Entre Hilos
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab("produccion-materiales")}
            className="group bg-white p-5 rounded-3xl border border-[#FDE8EF] hover:border-[#EE6B8D] hover:shadow-md transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#FDF4F7] text-[#EE6B8D] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                <Layers size={22} />
              </div>
              <h5 className="font-fredoka text-base font-bold text-gray-800 group-hover:text-[#EE6B8D] transition-colors">
                1. Materiales
              </h5>
              <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                {materiales.length} materiales registrados por ciento, docena o granel. Costo exacto por unidad o gramo.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-quicksand font-bold text-[#EE6B8D]">
              <span>Ver mis materiales</span>
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("produccion-recetas")}
            className="group bg-white p-5 rounded-3xl border border-[#FDE8EF] hover:border-[#EE6B8D] hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#FDF4F7] text-[#EE6B8D] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                <Calculator size={22} />
              </div>
              <h5 className="font-fredoka text-base font-bold text-gray-800 group-hover:text-[#EE6B8D] transition-colors">
                2. Diseños y Costos
              </h5>
              <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                {productos.length} modelos costeados con categorías y fotos. Materiales, tiempo de tejido, precio sugerido y ganancia real.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-quicksand font-bold text-[#EE6B8D]">
              <span>Calcular diseños y precios</span>
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("produccion-campanas")}
            className="group bg-white p-5 rounded-3xl border border-[#FDE8EF] hover:border-[#EE6B8D] hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#FDF4F7] text-[#EE6B8D] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                <Calendar size={22} />
              </div>
              <h5 className="font-fredoka text-base font-bold text-gray-800 group-hover:text-[#EE6B8D] transition-colors">
                3. Campañas y Ferias
              </h5>
              <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                {campanas.length} eventos planificados. Control de fechas, metas, piezas terminadas y publicación directa a la tienda.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-quicksand font-bold text-[#EE6B8D]">
              <span>Planificar ferias y stock</span>
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("produccion-equilibrio")}
            className="group bg-white p-5 rounded-3xl border border-[#FDE8EF] hover:border-[#EE6B8D] hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#FDF4F7] text-[#EE6B8D] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                <Scale size={22} />
              </div>
              <h5 className="font-fredoka text-base font-bold text-gray-800 group-hover:text-[#EE6B8D] transition-colors">
                4. Gastos Fijos
              </h5>
              <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                Control de alquiler de stand, movilidad y viáticos para saber cuántas piezas necesitas vender para cubrirlos.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-quicksand font-bold text-[#EE6B8D]">
              <span>Ver gastos fijos</span>
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("produccion-bitacora")}
            className="group bg-white p-5 rounded-3xl border border-[#FDE8EF] hover:border-[#EE6B8D] hover:shadow-md transition-all text-left flex flex-col justify-between sm:col-span-2 lg:col-span-1 cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#FDF4F7] text-[#EE6B8D] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                <Smartphone size={22} />
              </div>
              <h5 className="font-fredoka text-base font-bold text-gray-800 group-hover:text-[#EE6B8D] transition-colors">
                5. Bitácora
              </h5>
              <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                {bitacora.length} sesiones anotadas. Botones táctiles (+1, +2, +5), control de ovillos necesarios y horas reales.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-quicksand font-bold text-[#EE6B8D]">
              <span>Abrir bitácora</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
