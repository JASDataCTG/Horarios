import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScheduleConflict, ScheduleEntry } from '../types';
import { AlertTriangle, HelpCircle, CheckCircle2, User, Home, Clock, ShieldAlert, ArrowRight } from 'lucide-react';

interface ConflictAlertsProps {
  conflicts: ScheduleConflict[];
  entries: ScheduleEntry[];
  onSelectClassToEdit: (entry: ScheduleEntry) => void;
}

export default function ConflictAlerts({
  conflicts,
  entries,
  onSelectClassToEdit
}: ConflictAlertsProps) {
  const [filterType, setFilterType] = useState<'all' | 'error' | 'warning'>('all');

  // Filter conflicts inside inspector
  const filteredConflicts = conflicts.filter(c => {
    if (filterType === 'all') return true;
    return c.severity === filterType;
  });

  const getEntryById = (id: string): ScheduleEntry | undefined => {
    return entries.find(e => e.id === id);
  };

  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col h-full">
      {/* Header bar */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-5 h-5 ${conflicts.length > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
          <h3 className="font-bold font-sans text-slate-800">Diagnóstico de Choques y Alertas</h3>
        </div>
        <span className="text-xs text-slate-500 font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-full">
          {conflicts.length} total
        </span>
      </div>

      {conflicts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-505 mb-3 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">¡Cero Conflictos Registrados!</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 font-sans">
            La programación se encuentra perfectamente sincronizada. Todos los docentes, aulas y semestres disponen de horarios exclusivos.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick filter tabs */}
          <div className="flex gap-1 border-b border-slate-100 pb-2 mt-3 mb-3">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer font-semibold ${filterType === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              Todos ({conflicts.length})
            </button>
            <button
              onClick={() => setFilterType('error')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer font-semibold ${filterType === 'error' ? 'bg-rose-600 text-white font-bold' : 'text-slate-500 hover:bg-rose-50'}`}
            >
              Cruces Críticos ({errorCount})
            </button>
            <button
              onClick={() => setFilterType('warning')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer font-semibold ${filterType === 'warning' ? 'bg-amber-500 text-white font-bold' : 'text-slate-500 hover:bg-amber-50'}`}
            >
              Fuera de Jornada ({warningCount})
            </button>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[350px]">
            <AnimatePresence initial={false}>
              {filteredConflicts.map((conflict, i) => {
                const isError = conflict.severity === 'error';
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={i}
                    className={`p-3 rounded-xl border text-xs text-left transition-all flex flex-col gap-2 ${
                      isError 
                        ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-50 text-rose-800' 
                        : 'bg-amber-50/30 border-amber-100 hover:bg-amber-50 text-amber-800'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0 w-full">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="font-bold flex items-center gap-1.5 font-sans">
                          {conflict.type === 'TEACHER' && <User className="w-3.5 h-3.5 shrink-0" />}
                          {conflict.type === 'ROOM' && <Home className="w-3.5 h-3.5 shrink-0" />}
                          {conflict.type === 'OUT_OF_SHIFT' && <Clock className="w-3.5 h-3.5 shrink-0" />}
                          {conflict.type === 'GROUP' && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
                          {conflict.type === 'GAP' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-505" />}
                          <span>
                            {conflict.type === 'TEACHER' ? 'Cruzar Docente' :
                             conflict.type === 'ROOM' ? 'Cruce de Aula' :
                             conflict.type === 'GROUP' ? 'Cruce de Grupo Académico' :
                             conflict.type === 'GAP' ? 'Tiempo Libre Excesivo (Hueco)' :
                             'Fuera de Límites de Jornada'}
                          </span>
                        </div>

                        {/* Real-time Category Badges (Internal vs. Cross-Semester) */}
                        {(() => {
                          const sems = conflict.involvedIds
                            .map(id => getEntryById(id)?.semester)
                            .filter((s): s is number => typeof s === 'number');
                          const uniqueSems = Array.from(new Set(sems)).sort((a, b) => a - b);
                          
                          if (uniqueSems.length === 1) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Interno: Sem. {uniqueSems[0]}°
                              </span>
                            );
                          } else if (uniqueSems.length > 1) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                                Cruzado: Sem. {uniqueSems.map(s => `${s}°`).join(' / ')}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      
                      <p className="text-slate-600 font-sans leading-relaxed">{conflict.message}</p>
 
                       {/* Micro buttons to edit involved courses */}
                       {conflict.involvedIds.length > 0 && (
                         <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100/60 mt-1">
                           <span className="text-[10px] text-slate-400 font-medium">Ir a editar:</span>
                           {conflict.involvedIds.map(classId => {
                             const cls = getEntryById(classId);
                             if (!cls) return null;
                             return (
                               <button
                                 key={classId}
                                 type="button"
                                 onClick={() => onSelectClassToEdit(cls)}
                                 className={`text-[10px] px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 shadow-xs cursor-pointer text-slate-700 hover:text-teal-700 transition-colors font-mono font-medium flex items-center gap-1`}
                               >
                                 <span className="text-slate-400 font-bold mr-0.5">{cls.semester}°</span>
                                 {cls.subject.length > 15 ? cls.subject.substring(0, 13) + '...' : cls.subject}
                                 <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                               </button>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredConflicts.length === 0 && (
              <div className="py-6 text-center text-slate-500 text-xs">
                No hay alertas en esta categoría.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Academic advice on Shifts (Recomendaciones de Jornada de acuerdo a restricciones) */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 text-left bg-gradient-to-br from-indigo-50/30 via-amber-50/20 to-emerald-50/20 p-3.5 rounded-xl border border-slate-100">
        <h4 className="text-[12px] font-bold text-indigo-900 flex items-center gap-1.5 mb-2 font-sans">
          <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Sugerencias de Distribución de Jornadas Estudiantiles</span>
        </h4>
        <ul className="space-y-2.5 text-[11px] leading-relaxed text-slate-600 font-sans">
          <li className="flex items-start gap-1.5">
            <span className="text-indigo-600 font-bold text-[13px] leading-none shrink-0">•</span>
            <span>
              <strong>🌙 Descongestión Nocturna y Tarde:</strong> Si se presentan demasiados cruces de docentes avanzados, es aconsejable mover asignaturas selectivas a la <strong>Jornada de la Tarde (2:00 PM - 5:00 PM)</strong>. El sistema lo admite oficialmente para semestres de 6° a 9° como una advertencia manejable sin conflicto crítico.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-teal-600 font-bold text-[13px] leading-none shrink-0">•</span>
            <span>
              <strong>🌅 Balance de Mañana y Tarde (Semestres 3° a 5°):</strong> Recomiende desplazar las materias teóricas de estos semestres intermedios hacia la <strong>tarde</strong>. Esto libera la jornada de la <strong>mañana</strong> garantizando exclusividad y espacio de laboratorios físicos para los primeros semestres (1° y 2°).
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-amber-600 font-bold text-[13px] leading-none shrink-0">•</span>
            <span>
              <strong>📅 Sábados Estratégicos (Semestres 5° a 9°):</strong> Los sábados admiten únicamente la jornada de la <strong>Mañana (7:00 AM - 1:15 PM)</strong>. El optimizador ahora programa de manera prioritaria y permite acomodar las materias del <strong>5to al 9no semestre</strong> los sábados por la mañana, reubicando automáticamente cualquier asignatura que antes quedara indebidamente en sábado de tarde o noche.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
