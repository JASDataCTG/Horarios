import React, { useState, useMemo } from 'react';
import { ScheduleEntry, ScheduleConflict } from '../types';
import { User, BookOpen, AlertCircle, FileSpreadsheet, Hourglass, Search } from 'lucide-react';

interface TeacherSchedulesProps {
  entries: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  onSelectEntry: (entry: ScheduleEntry) => void;
}

export default function TeacherSchedules({
  entries,
  conflicts,
  onSelectEntry
  }: TeacherSchedulesProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Extract all distinct teachers dynamically from the scheduled hours
    const teacherStats = useMemo(() => {
      const listMap: Record<string, {
        name: string;
        totalHours: number;
        sessions: ScheduleEntry[];
        clashed: boolean;
      }> = {};

      entries.forEach(entry => {
        const teacherName = entry.teacher || 'INSTITUCIONAL';
        
        if (!listMap[teacherName]) {
          listMap[teacherName] = {
            name: teacherName,
            totalHours: 0,
            sessions: [],
            clashed: false
          };
        }

        listMap[teacherName].totalHours += entry.durationHours;
        listMap[teacherName].sessions.push(entry);

        // Check if this teacher is involved in any critical conflict
        const isClashed = conflicts.some(c => 
          c.type === 'TEACHER' && c.involvedIds.includes(entry.id)
        );
        if (isClashed) {
          listMap[teacherName].clashed = true;
        }
      });

      return Object.values(listMap).sort((a, b) => b.totalHours - a.totalHours);
    }, [entries, conflicts]);

    const filteredTeachers = teacherStats.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-205 p-5 space-y-4">
        {/* Title + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold font-sans text-slate-800 text-base md:text-lg flex items-center gap-2">
              <User className="text-indigo-650 w-5 h-5" />
              Carga Académica de Docentes
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5 animate-none">
              Verifique la sumatoria de horas y la agenda semanal asignada a cada docente.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar docente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-sans">
            No se encontraron profesores para "{searchTerm}"
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeachers.map(teacher => {
              return (
                <div
                  key={teacher.name}
                  className={`p-4 rounded-xl border transition-all ${
                    teacher.clashed 
                      ? 'bg-rose-50/50 border-rose-250 ring-1 ring-rose-200/50' 
                      : teacher.name === 'INSTITUCIONAL'
                      ? 'bg-slate-50 border-slate-250'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 font-sans">{teacher.name}</h4>
                      <span className="text-[10px] text-slate-500 font-bold font-sans mt-0.5 block uppercase tracking-wider">
                        {teacher.sessions.length} clases asignadas
                      </span>
                    </div>

                    {/* Hours badge */}
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                        <Hourglass className="w-3 h-3 text-slate-450" />
                        {teacher.totalHours} Horas Sem.
                      </span>
                      {teacher.clashed && (
                        <span className="mt-1 block text-[10px] text-rose-600 font-bold bg-rose-100/50 p-0.5 px-1 rounded">
                          ⚠️ Cruce Registrado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Agenda list */}
                  <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-200 text-left">
                    <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2 font-sans">Agenda Semanal:</p>
                    
                    {teacher.sessions
                      .sort((a,b) => {
                        const daysIdx: Record<string, number> = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5 };
                        return (daysIdx[a.day] ?? 0) - (daysIdx[b.day] ?? 0);
                      })
                      .map(session => (
                        <div
                          key={session.id}
                          onClick={() => onSelectEntry(session)}
                          className={`p-2 rounded-lg border border-slate-200 bg-slate-50/20 hover:bg-slate-50 transition-colors cursor-pointer text-xs flex items-center justify-between gap-4 group`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-700 truncate font-sans group-hover:text-indigo-650 transition-colors">
                              {session.subject}
                            </p>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-sans space-x-1">
                              <span className="font-semibold text-slate-400 font-mono">Día:</span> 
                              <span>{session.day} {session.startTime}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-slate-400 font-mono">Aula:</span> 
                              <span className="font-mono font-semibold text-slate-700">{session.room || 'Por asignar'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">
                            {session.durationHours} hrs
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
