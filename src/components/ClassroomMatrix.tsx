import React, { useState } from 'react';
import { ScheduleEntry, DBClassroom } from '../types';
import { DAYS, CLASSROOMS } from '../data';
import { Home, Info, BookOpen, Clock } from 'lucide-react';

interface ClassroomMatrixProps {
  entries: ScheduleEntry[];
  classrooms?: DBClassroom[];
  onSelectEntry: (entry: ScheduleEntry) => void;
}

export default function ClassroomMatrix({ entries, classrooms, onSelectEntry }: ClassroomMatrixProps) {
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  // Rooms list derived from dynamic classrooms state with static fallback
  const activeRooms = classrooms && classrooms.length > 0 
    ? Array.from(new Set([...classrooms.map(c => c.name), 'Por asignar', 'Institucional']))
    : CLASSROOMS;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-205 pb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-bold font-sans text-slate-800 text-base md:text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-indigo-600" />
            Matriz de Ocupación por Aula (Salón)
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5 animate-none">
            Consulte qué aulas físicas están ocupadas por cada día para ubicar espacios libres o resolver cruces de infraestructura.
          </p>
        </div>
      </div>

      {/* Classroom view grids */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px] border border-slate-200 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 p-3 text-center">
            <div className="font-bold text-xs text-slate-500 text-left pl-3">Aula / Salón</div>
            {DAYS.map(day => (
              <div key={day} className="font-bold text-xs text-slate-705 uppercase tracking-wide">{day}</div>
            ))}
          </div>

          {/* Table rows */}
          <div className="divide-y divide-slate-100">
            {activeRooms.map(room => {
              return (
                <div key={room} className="grid grid-cols-7 min-h-[110px] items-stretch font-sans">
                  
                  {/* Left Label cell */}
                  <div className="p-3 border-r border-slate-200 bg-slate-50/10 flex flex-col justify-center text-left">
                    <span className="font-bold text-xs text-slate-800 font-sans">{room}</span>
                    <span className="text-[10px] text-slate-400 mt-1 font-semibold font-mono">
                      {entries.filter(e => e.room === room).length} clase(s)
                    </span>
                  </div>

                  {/* Day cell boxes */}
                  {DAYS.map(day => {
                    const roomDayEntries = entries
                      .filter(e => e.room === room && e.day === day)
                      .sort((a,b) => a.startTime.localeCompare(b.startTime));

                    return (
                      <div key={day} className="p-2 border-r border-slate-100 last:border-r-0 flex flex-col gap-1.5 justify-center bg-slate-50/5 hover:bg-slate-50/20 transition-colors">
                        {roomDayEntries.length === 0 ? (
                          <span className="text-[10px] text-slate-300 font-mono italic text-center py-4">
                            Libre
                          </span>
                        ) : (
                          roomDayEntries.map(entry => (
                            <div
                              key={entry.id}
                              onClick={() => onSelectEntry(entry)}
                              className="p-1.5 px-2 rounded bg-white hover:bg-indigo-50/50 border border-slate-200 text-left cursor-pointer transition-all shadow-xs group"
                            >
                              <div className="flex items-center justify-between text-[8px] font-mono font-bold text-indigo-600">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2 h-2 text-indigo-500" />
                                  {entry.startTime}
                                </span>
                                <span>G{entry.group}</span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-800 truncate mt-0.5 leading-tight group-hover:text-indigo-650 transition-colors">
                                {entry.subject}
                              </h5>
                              <div className="text-[8px] text-slate-500 line-clamp-1 mt-0.5 italic">
                                Sem. {entry.semester} • {entry.teacher.split(' ').slice(-1)[0]}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}

                </div>
              );
            })}
          </div>

        </div>
      </div>
      
      {/* Help Note card */}
      <div className="bg-slate-50 border-l-4 border-slate-400 p-3 text-xs text-slate-600 rounded flex gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="font-sans">
          <strong>Tip Administrativo:</strong> Si un aula marca conflicto crítico por superposición horaria, edite cualquiera de las clases cruzadas desde la pestaña de lista y asígnele otra aula marcando "Libre" en el mismo día y bloque horario.
        </p>
      </div>
    </div>
  );
}
