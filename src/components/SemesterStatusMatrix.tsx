import React from 'react';
import { ScheduleEntry, ScheduleConflict } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, ArrowRight, Layers } from 'lucide-react';

interface SemesterStatusMatrixProps {
  entries: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  selectedSemester: string;
  onSelectSemester: (semester: string) => void;
  onSelectClassToEdit: (entry: ScheduleEntry) => void;
}

export default function SemesterStatusMatrix({
  entries,
  conflicts,
  selectedSemester,
  onSelectSemester,
  onSelectClassToEdit
}: SemesterStatusMatrixProps) {
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-left font-sans space-y-4 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600 animate-pulse" />
            Semáforo de Consistencia por Semestre
          </h3>
          <p className="text-[11px] text-slate-500">
            Estado de traslapes internos y cruces de recursos con otras franjas semestrales. Haga clic en un semestre para filtrarlo.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold font-mono">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sin conflictos internos
          </span>
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            Con conflictos internos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        {semesters.map(sem => {
          const semStr = sem.toString();
          const semEntries = entries.filter(e => e.semester === sem);
          
          // Get all conflicts that involve classes of this specific semester
          const semConflicts = conflicts.filter(c => 
            c.involvedIds.length > 0 && 
            c.involvedIds.some(id => semEntries.some(e => e.id === id))
          );

          // Internal: All involved classes reside securely in the SAME semester (or isolated single warnings)
          const internalConflicts = semConflicts.filter(c => 
            c.involvedIds.every(id => {
              const entry = entries.find(e => e.id === id);
              return entry && entry.semester === sem;
            })
          );

          // External: Cruces con otros semestres (Profesor compartido o aula coincidente con otro semestre)
          const externalConflicts = semConflicts.filter(c => 
            c.involvedIds.some(id => {
              const entry = entries.find(e => e.id === id);
              return entry && entry.semester === sem;
            }) && 
            c.involvedIds.some(id => {
              const entry = entries.find(e => e.id === id);
              return entry && entry.semester !== sem;
            })
          );

          const hasInternal = internalConflicts.length > 0;
          const hasExternal = externalConflicts.length > 0;
          const isSelected = selectedSemester === semStr;

          // Check if there are actually classes scheduled for this semester
          const hasClasses = semEntries.length > 0;

          return (
            <button
              key={sem}
              onClick={() => onSelectSemester(isSelected ? 'all' : semStr)}
              className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer focus:outline-none select-none ${
                isSelected 
                  ? 'ring-3 ring-indigo-500/30 border-indigo-600 bg-indigo-50/20' 
                  : 'hover:scale-[1.02]'
              } ${
                !hasClasses 
                  ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' 
                  : hasInternal
                  ? 'bg-rose-50/30 border-rose-250 text-rose-900 hover:bg-rose-50/50'
                  : 'bg-emerald-50/25 border-emerald-250 text-emerald-950 hover:bg-emerald-50/45'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-bold text-[11px] uppercase tracking-wider ${isSelected ? 'text-indigo-900 font-extrabold' : 'text-slate-700'}`}>
                  Semestre {sem}°
                </span>
                {hasClasses ? (
                  hasInternal ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" title="Tiene conflictos internos de horario" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-650 shrink-0" title="Semestre sin conflictos internos" />
                  )
                ) : (
                  <HelpCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" title="Sin clases registradas" />
                )}
              </div>

              <div className="space-y-1 mt-1.5">
                {hasClasses ? (
                  <>
                    {/* Internal Status Indicator */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasInternal ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                      <span className={`font-medium ${hasInternal ? 'text-rose-705 font-bold' : 'text-emerald-805'}`}>
                        {hasInternal ? `${internalConflicts.length} internos` : 'Sin conf. int.'}
                      </span>
                    </div>

                    {/* External Status Indicator */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasExternal ? 'bg-amber-400' : 'bg-slate-300'}`}></span>
                      <span className={hasExternal ? 'text-amber-805 font-bold' : 'text-slate-500'}>
                        {hasExternal ? `${externalConflicts.length} cruzados` : '0 ext.'}
                      </span>
                    </div>

                    <div className="text-[9px] text-slate-450 font-mono">
                      {semEntries.length} materias
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Sin clases</span>
                )}
              </div>
              
              {/* Underline for selection */}
              {isSelected && (
                <div className="absolute bottom-1.5 right-3 left-3 h-0.5 bg-indigo-600 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded diagnostics sub-panel when a semester is actively filtered */}
      {selectedSemester !== 'all' && (
        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
              Análisis de Coherencia: Semestre {selectedSemester}°
            </span>
            <button 
              onClick={() => onSelectSemester('all')}
              className="text-[10px] text-indigo-700 font-bold hover:underline cursor-pointer"
            >
              Ver todos los semestres
            </button>
          </div>

          {(() => {
            const sem = parseInt(selectedSemester, 10);
            const semEntries = entries.filter(e => e.semester === sem);
            const semConflicts = conflicts.filter(c => 
              c.involvedIds.length > 0 && 
              c.involvedIds.some(id => semEntries.some(e => e.id === id))
            );

            const internal = semConflicts.filter(c => 
              c.involvedIds.every(id => {
                const entry = entries.find(e => e.id === id);
                return entry && entry.semester === sem;
              })
            );

            const external = semConflicts.filter(c => 
              c.involvedIds.some(id => {
                const entry = entries.find(e => e.id === id);
                return entry && entry.semester === sem;
              }) && 
              c.involvedIds.some(id => {
                const entry = entries.find(e => e.id === id);
                return entry && entry.semester !== sem;
              })
            );

            if (semConflicts.length === 0) {
              return (
                <div className="flex items-center gap-2.5 text-emerald-800 bg-emerald-50/50 border border-emerald-100 rounded-lg p-3.5 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <strong className="block font-bold">¡Semestre 100% Consistente!</strong>
                    <span className="text-[11.5px] text-slate-600">Este grupo académico de semestre {selectedSemester}° no presenta traslapes internos de horario ni choques de aula o profesor con otra cohorte.</span>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Internal conflicts list */}
                <div className="space-y-2 border-r border-slate-205/50 pr-4">
                  <div className="flex items-center gap-2 font-bold text-slate-850">
                    <span className={`w-2.5 h-2.5 rounded-full ${internal.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-505'}`}></span>
                    <span>1. Conflictos Propios (Internos) del Semestre ({internal.length})</span>
                  </div>
                  
                  {internal.length === 0 ? (
                    <div className="text-emerald-800 bg-emerald-50/30 border border-emerald-100/50 rounded-lg p-3 text-[11px] leading-relaxed">
                      ✅ <strong>¡Consiste consigo mismo!</strong> El horario interno de este nivel no tiene solapamientos. Los alumnos de {selectedSemester}° semestre no tendrán cruces de clases en su pensum.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {internal.map((c, i) => (
                        <div key={i} className="p-3 rounded-lg bg-rose-50/55 border border-rose-100 text-[11px] text-rose-900 space-y-1">
                          <p className="font-extrabold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            ⚠️ {c.type === 'GROUP' ? 'Traslape Horario Interno' : c.type === 'GAP' ? 'Tiempo Muerto Excesivo' : 'Jornada Incorrecta'}
                          </p>
                          <p className="text-slate-650 font-normal leading-relaxed">{c.message}</p>
                          <div className="text-[10px] leading-snug p-1.5 bg-white/70 border border-rose-100/50 rounded text-indigo-900">
                            <strong className="block font-bold">Posible Solución:</strong>
                            {c.type === 'GROUP' ? 'Arrastre una de las materias (Drag & Drop) a otro bloque vacío del lunes al sábado.' : 
                             c.type === 'GAP' ? 'Aproxime las asignaturas para eliminar el bache de tiempo intermedio.' : 
                             'Reubique la materia trasladándola a la jornada correspondiente de este nivel.'}
                          </div>
                          {c.involvedIds.length > 0 && (
                            <div className="pt-1 flex gap-1 items-center flex-wrap">
                              {c.involvedIds.map(id => {
                                const ent = entries.find(e => e.id === id);
                                if (!ent) return null;
                                return (
                                  <button
                                    key={id}
                                    onClick={() => onSelectClassToEdit(ent)}
                                    className="bg-white hover:bg-slate-100 text-[9.5px] px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold flex items-center gap-0.5 shadow-xs transition-all"
                                  >
                                    Asignar {ent.subject} <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. External conflicts list */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-850">
                    <span className={`w-2.5 h-2.5 rounded-full ${external.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></span>
                    <span>2. Conflictos de Recursos con Otros Semestres ({external.length})</span>
                  </div>

                  {external.length === 0 ? (
                    <div className="text-emerald-800 bg-emerald-50/30 border border-emerald-100/50 rounded-lg p-3 text-[11px] leading-relaxed">
                      ✅ <strong>¡Recursos Exclusivos!</strong> No hay choques de profesores ni de aulas con otros niveles semestrales.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {external.map((c, i) => {
                        const otherSems = c.involvedIds
                          .map(id => entries.find(e => e.id === id)?.semester)
                          .filter((s): s is number => typeof s === 'number' && s !== sem);
                        const otherSemNames = Array.from(new Set(otherSems)).map(s => `${s}° Semestre`).join(', ');

                        return (
                          <div key={i} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100 text-[11px] text-amber-900 space-y-1">
                            <p className="font-extrabold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                              ⚠️ {c.type === 'TEACHER' ? `Cruce de Docente (con ${otherSemNames})` : `Cruce de Aula (con ${otherSemNames})`}
                            </p>
                            <p className="text-slate-650 font-normal leading-relaxed">{c.message}</p>
                            <div className="text-[10px] leading-snug p-1.5 bg-white/70 border border-amber-105/50 rounded text-indigo-900">
                              <strong className="block font-bold">Posible Solución:</strong>
                              {c.type === 'TEACHER' ? 'Modifique el docente de una de las asignaturas o mueva una de las clases con Drag & Drop a otro horario.' : 
                               'Cambie el número de aula para una de las clases usando la grilla de Disponibilidad de Aulas.'}
                            </div>
                            {c.involvedIds.length > 0 && (
                              <div className="pt-1 flex gap-1 items-center flex-wrap">
                                {c.involvedIds.map(id => {
                                  const ent = entries.find(e => e.id === id);
                                  if (!ent) return null;
                                  return (
                                    <button
                                      key={id}
                                      onClick={() => onSelectClassToEdit(ent)}
                                      className="bg-white hover:bg-slate-105 text-[9.5px] px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold flex items-center gap-0.5 shadow-xs transition-all"
                                    >
                                      Editar {ent.subject} ({ent.semester}°) <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
