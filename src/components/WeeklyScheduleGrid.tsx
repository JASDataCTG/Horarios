import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScheduleEntry, ScheduleConflict } from '../types';
import { DAYS, detectConflicts } from '../data';
import { Clock, AlertTriangle, Edit2, MapPin, User, GraduationCap, CheckCircle } from 'lucide-react';

interface WeeklyScheduleGridProps {
  entries: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  onEditEntry: (entry: ScheduleEntry) => void;
  selectedShift: 'all' | 'morning' | 'afternoon' | 'evening';
  selectedSemester: string; // 'all' or '1'..'9'
  onUpdateEntry?: (entry: ScheduleEntry) => void;
}

// Distinct background color tags by semester for immediate identification (Geometric Balance customized)
const SEMESTER_COLORS: Record<number, { bg: string; text: string; border: string; accent: string }> = {
  1: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', border: 'border-[#2563EB]/40', accent: 'bg-[#2563EB]' }, // .eng blue
  2: { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', border: 'border-[#16A34A]/40', accent: 'bg-[#16A34A]' }, // .math green
  3: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#D97706]/40', accent: 'bg-[#D97706]' }, // .hum amber
  4: { bg: 'bg-[#F3E8FF]', text: 'text-[#6B21A8]', border: 'border-[#9333EA]/40', accent: 'bg-[#9333EA]' }, // .lab purple
  5: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', border: 'border-[#2563EB]/40', accent: 'bg-[#2563EB]' }, // .eng blue
  6: { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', border: 'border-[#16A34A]/40', accent: 'bg-[#16A34A]' }, // .math green
  7: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#D97706]/40', accent: 'bg-[#D97706]' }, // .hum amber
  8: { bg: 'bg-[#F3E8FF]', text: 'text-[#6B21A8]', border: 'border-[#9333EA]/40', accent: 'bg-[#9333EA]' }, // .lab purple
  9: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', border: 'border-[#2563EB]/40', accent: 'bg-[#2563EB]' }, // .eng blue
};

export default function WeeklyScheduleGrid({
  entries,
  conflicts,
  onEditEntry,
  selectedShift,
  selectedSemester,
  onUpdateEntry
}: WeeklyScheduleGridProps) {
  const [viewType, setViewType] = useState<'columns' | 'grid'>('columns');

  // --- DRAG & DROP STATE ---
  const [draggedEntry, setDraggedEntry] = useState<ScheduleEntry | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; startTime: string } | null>(null);

  // Simulated conflict solver running on dragOver to isolate results and solutions
  const getSimulatedConflicts = (entry: ScheduleEntry, targetDay: string, targetStartTime: string): ScheduleConflict[] => {
    const simulatedEntries = entries.map(e => 
      e.id === entry.id 
        ? { ...e, day: targetDay, startTime: targetStartTime }
        : e
    );
    const allConflicts = detectConflicts(simulatedEntries);
    return allConflicts.filter(c => c.involvedIds.includes(entry.id));
  };

  const handleDragStart = (e: React.DragEvent, entry: ScheduleEntry) => {
    setDraggedEntry(entry);
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, day: string, startTime: string) => {
    e.preventDefault();
    if (hoveredCell?.day !== day || hoveredCell?.startTime !== startTime) {
      setHoveredCell({ day, startTime });
    }
  };

  const handleDragLeave = () => {
    setHoveredCell(null);
  };

  const handleDrop = (e: React.DragEvent, day: string, startTime: string) => {
    e.preventDefault();
    setHoveredCell(null);
    setDraggedEntry(null);
    
    if (!draggedEntry) return;

    if (onUpdateEntry) {
      onUpdateEntry({
        ...draggedEntry,
        day,
        startTime: startTime === 'columns-view' ? draggedEntry.startTime : startTime
      });
    }
  };

  const handleDragEnd = () => {
    setDraggedEntry(null);
    setHoveredCell(null);
  };

  // Filter entries according to active viewport settings
  const filteredEntries = entries.filter(entry => {
    // Semester filter
    if (selectedSemester !== 'all' && entry.semester.toString() !== selectedSemester) {
      return false;
    }

    // Shift filter
    const [hours] = entry.startTime.split(':').map(Number);
    if (selectedShift === 'morning') {
      return hours >= 6 && hours < 14;
    }
    if (selectedShift === 'afternoon') {
      return hours >= 14 && hours < 18;
    }
    if (selectedShift === 'evening') {
      return hours >= 18;
    }

    return true;
  });

  // Check if an entry has any conflict
  const getEntryConflicts = (id: string) => {
    return conflicts.filter(c => c.involvedIds.includes(id));
  };

  // Convert "HH:MM" to float hour
  const timeToHourFloat = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  // 1. Column view: Daily schedule blocks listed chronologically
  const renderColumnsView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {DAYS.map(day => {
          const dayEntries = filteredEntries
             .filter(e => e.day === day)
             .sort((a, b) => timeToHourFloat(a.startTime) - timeToHourFloat(b.startTime));

          const isColumnHovered = hoveredCell?.day === day && hoveredCell?.startTime === 'columns-view';

          return (
            <div
              key={day}
              onDragOver={(e) => handleDragOver(e, day, 'columns-view')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day, 'columns-view')}
              className={`rounded-xl p-4 border flex flex-col min-h-[400px] transition-all duration-150 ${
                isColumnHovered
                  ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-200'
                  : draggedEntry
                  ? 'bg-emerald-50/10 border-dashed border-emerald-300'
                  : 'bg-slate-50 border-slate-100'
              }`}
            >
              <div className="border-b border-slate-200/60 pb-2 mb-3 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-700 font-sans uppercase tracking-wider">{day}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-mono">
                  {dayEntries.length} asignada(s)
                </span>
              </div>

              {dayEntries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 font-sans">Sin clases programadas</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {dayEntries.map(entry => {
                    const colTheme = SEMESTER_COLORS[entry.semester] || {
                      bg: 'bg-slate-50',
                      text: 'text-slate-705',
                      border: 'border-slate-200',
                      accent: 'bg-slate-400'
                    };
                    const entryConflicts = getEntryConflicts(entry.id);
                    const hasError = entryConflicts.some(c => c.severity === 'error');
                    const hasWarning = entryConflicts.some(c => c.severity === 'warning');

                    return (
                      <div
                        key={entry.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, entry)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onEditEntry(entry)}
                        className={`group relative p-3.5 rounded-xl border-l-4 text-left transition-all hover:scale-[1.01] hover:shadow-sm cursor-pointer ${colTheme.bg} ${colTheme.border} ${
                          hasError
                            ? 'border-l-rose-500 ring-2 ring-rose-300 bg-rose-50/25'
                            : hasWarning
                            ? 'border-l-amber-500 ring-2 ring-amber-255/45 bg-amber-50/25'
                            : 'border-l-indigo-600'
                        } ${draggedEntry?.id === entry.id ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''}`}
                      >
                        {/* Conflict Flags */}
                        {(hasError || hasWarning) && (
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            {hasError && <span className="p-0.5 bg-rose-500 text-white rounded-full shadow-xs" title="Tiene choques de alta gravedad"><AlertTriangle className="w-3 h-3" /></span>}
                            {!hasError && hasWarning && <span className="p-0.5 bg-amber-500 text-white rounded-full shadow-xs" title="Advertencia de consistencia"><AlertTriangle className="w-3 h-3" /></span>}
                          </div>
                        )}

                        {/* Timing Block */}
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {entry.startTime} - {(() => {
                            const startMins = timeToHourFloat(entry.startTime) * 60;
                            const endMins = startMins + (entry.durationHours * 60);
                            const h = Math.floor(endMins / 60) % 24;
                            const m = Math.floor(endMins % 60);
                            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                          })()}
                          <span className="ml-1 text-slate-400 font-normal">({entry.durationHours}h)</span>
                        </div>

                        {/* Title & Code */}
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 mt-1.5 leading-tight group-hover:text-indigo-650 transition-colors">
                          {entry.subject}
                        </h4>

                        <div className="mt-2.5 space-y-1 text-[11px] text-slate-500 font-sans">
                          {/* Teacher */}
                          <div className="flex items-center gap-1 truncate">
                            <span className="font-semibold text-slate-400">D:</span>
                            <span className="truncate text-slate-600 font-medium">{entry.teacher}</span>
                          </div>
                          
                          {/* Classroom & Sede */}
                          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-205 text-slate-550">
                            <span className="font-mono bg-slate-200/60 px-1 rounded truncate max-w-[65px] font-bold text-slate-700">
                              {entry.room || "S/A"}
                            </span>
                            <span className="font-bold text-slate-550">{entry.group} • Sem. {entry.semester}°</span>
                          </div>
                        </div>

                        {/* Detailed alert feed inside card */}
                        {entryConflicts.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 space-y-1 animate-fadeIn no-print">
                            {entryConflicts.map((c, idx) => (
                              <div
                                key={idx}
                                className={`text-[9.5px] px-2 py-1 rounded border font-sans font-medium leading-normal flex items-start gap-1 ${
                                  c.severity === 'error'
                                    ? 'bg-rose-50 border-rose-105 text-rose-700 font-bold'
                                    : 'bg-amber-50 border-amber-105 text-amber-700'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${c.severity === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`}></span>
                                <span>{c.message.includes(':') ? c.message.substring(c.message.indexOf(':') + 1).trim() : c.message}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Edit overlay indicator */}
                        <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="bg-white/95 px-2 py-1 rounded shadow-sm text-[10px] font-bold text-indigo-700 flex items-center gap-1 border border-indigo-100">
                            <Edit2 className="w-2.5 h-2.5" />
                            Editar clase o arrastrar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 2. Timeline Grid structure visual representation (Y-axis: 45-minute blocks grouped by shift, X-axis: days)
  const renderHourlyGridView = () => {
    const shiftConfigurations = [
      {
        id: 'morning',
        name: 'Jornada Mañana',
        hours: '7:00 AM - 1:15 PM',
        baseHour: 7,
        blocksCount: 8,
        accentColor: 'text-indigo-700 bg-indigo-50 border-indigo-100',
      },
      {
        id: 'afternoon',
        name: 'Jornada Tarde',
        hours: '2:00 PM - 5:00 PM',
        baseHour: 14,
        blocksCount: 4,
        accentColor: 'text-teal-700 bg-teal-50 border-teal-100',
      },
      {
        id: 'evening',
        name: 'Jornada Nocturna',
        hours: '6:00 PM - 9:45 PM',
        baseHour: 18,
        blocksCount: 5,
        accentColor: 'text-amber-700 bg-amber-50 border-amber-100',
      }
    ];

    const timeToMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const getShiftBlocks = (shiftConfig: typeof shiftConfigurations[0]) => {
      const blocks = [];
      for (let i = 0; i < shiftConfig.blocksCount; i++) {
        const startMins = shiftConfig.baseHour * 60 + i * 45;
        const endMins = startMins + 45;
        
        const startH = Math.floor(startMins / 60);
        const startM = startMins % 60;
        const endH = Math.floor(endMins / 60);
        const endM = endMins % 60;
        
        const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        
        blocks.push({
          index: i,
          startMins,
          endMins,
          startTime: startTimeStr,
          endTime: endTimeStr,
          label: `Bloque ${i + 1}`,
        });
      }
      return blocks;
    };

    const activeShifts = shiftConfigurations.filter(s => selectedShift === 'all' || s.id === selectedShift);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            {/* Header row */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 p-3.5 text-center">
              <div className="font-bold text-xs text-slate-500 text-left pl-3">Bloque / Franja Horaria</div>
              {DAYS.map(day => (
                <div key={day} className="font-extrabold text-xs text-slate-705 uppercase tracking-wide">{day}</div>
              ))}
            </div>

            {/* Time matrix rows grouped by shift */}
            <div className="divide-y divide-slate-100">
              {activeShifts.map(shiftConfig => {
                const shiftBlocks = getShiftBlocks(shiftConfig);
                return (
                  <React.Fragment key={shiftConfig.id}>
                    {/* Shift Separator Row */}
                    <div className="grid grid-cols-7 bg-slate-50/60 border-y border-slate-200/50 p-2.5 items-center">
                      <div className="col-span-7 px-3 flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${shiftConfig.accentColor.split(' ')[0]} ${shiftConfig.accentColor.split(' ')[1]} border ${shiftConfig.accentColor.split(' ')[2]}`}>
                          {shiftConfig.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono font-medium">({shiftConfig.hours})</span>
                        <div className="h-[1.5px] bg-slate-200/50 flex-1 ml-2"></div>
                      </div>
                    </div>

                    {/* Rendering the 45-minute blocks within this shift */}
                    {shiftBlocks.map(block => {
                      return (
                        <div key={`${shiftConfig.id}-${block.index}`} className="grid grid-cols-7 min-h-[95px] hover:bg-slate-50/10 transition-colors">
                          {/* Left Column Label (45 min slot info) */}
                          <div className="p-3 border-r border-slate-100 bg-slate-50/10 flex flex-col justify-center text-left pl-4">
                            <span className="font-bold text-xs text-slate-700 font-mono whitespace-nowrap">{block.startTime} - {block.endTime}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-bold">{block.label}</span>
                          </div>

                          {/* Days Grid Cells */}
                          {DAYS.map(day => {
                            // Fetch any schedule entry active in this 45-minute slot range
                            const slotEntries = filteredEntries.filter(entry => {
                              if (entry.day !== day) return false;
                              const entryStart = timeToMinutes(entry.startTime);
                              const entryEnd = entryStart + Math.round(entry.durationHours * 60);
                              return entryStart < block.endMins && block.startMins < entryEnd;
                            });

                            const isCellHovered = hoveredCell?.day === day && hoveredCell?.startTime === block.startTime;
                            
                            // Calculate simulated conflicts over this hovered cell
                            let simulatedConflicts: ScheduleConflict[] = [];
                            let isPotentialSolution = false;
                            if (draggedEntry) {
                              simulatedConflicts = getSimulatedConflicts(draggedEntry, day, block.startTime);
                              const hasError = simulatedConflicts.some(c => c.severity === 'error');
                              isPotentialSolution = !hasError;
                            }

                            return (
                              <div
                                key={day}
                                onDragOver={(e) => handleDragOver(e, day, block.startTime)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, block.startTime)}
                                className={`relative p-2 border-r border-slate-105 last:border-r-0 flex flex-col gap-1.5 justify-center transition-all min-h-[90px] ${
                                  isCellHovered
                                    ? isPotentialSolution
                                      ? 'bg-emerald-50 border-2 border-emerald-500 scale-[1.01] z-10 shadow-md ring-4 ring-emerald-100/30'
                                      : 'bg-rose-50 border-2 border-rose-500 scale-[1.01] z-10 shadow-md ring-4 ring-rose-100/30'
                                    : draggedEntry
                                    ? isPotentialSolution
                                      ? 'bg-emerald-50/20 border-2 border-dashed border-emerald-400 m-[0.5px] scale-[0.98]'
                                      : 'opacity-25 bg-slate-100/30'
                                    : 'bg-slate-50/[0.02] hover:bg-slate-50/[0.08] transition-colors'
                                }`}
                              >
                                {slotEntries.map(entry => {
                                  const colTheme = SEMESTER_COLORS[entry.semester] || {
                                    bg: 'bg-slate-50',
                                    text: 'text-slate-700',
                                    border: 'border-slate-200'
                                  };
                                  const entryConflicts = getEntryConflicts(entry.id);
                                  const hasError = entryConflicts.some(c => c.severity === 'error');
                                  const hasWarning = entryConflicts.some(c => c.severity === 'warning');

                                  return (
                                    <div
                                      key={entry.id}
                                      draggable={true}
                                      onDragStart={(e) => handleDragStart(e, entry)}
                                      onDragEnd={handleDragEnd}
                                      onClick={() => onEditEntry(entry)}
                                      className={`group p-2 rounded-lg text-left text-[11px] leading-snug border transition-all cursor-pointer shadow-xs ${colTheme.bg} ${colTheme.border} hover:scale-[1.01] ${
                                        hasError 
                                          ? 'ring-2 ring-rose-400 border-rose-500 bg-rose-50/40' 
                                          : hasWarning 
                                          ? 'ring-2 ring-amber-350 border-amber-450 bg-amber-50/20'
                                          : ''
                                      } ${draggedEntry?.id === entry.id ? 'opacity-30 scale-95 border-dashed border-indigo-400' : ''}`}
                                    >
                                      <div className="flex items-center justify-between text-[8px] font-mono font-bold text-slate-400">
                                        <span className="flex items-center gap-1">
                                          {entry.startTime}
                                          {hasError && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
                                          {!hasError && hasWarning && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                        </span>
                                        <span>Sem. {entry.semester}° {entry.group}</span>
                                      </div>
                                      <div className="font-bold text-slate-800 line-clamp-1 mt-0.5 group-hover:text-indigo-650 transition-colors flex items-center justify-between gap-1">
                                        <span className="truncate">{entry.subject}</span>
                                        {(hasError || hasWarning) && (
                                          <AlertTriangle className={`w-3 h-3 shrink-0 ${hasError ? 'text-rose-600' : 'text-amber-500'}`} />
                                        )}
                                      </div>
                                      <div className="text-[9px] text-slate-505 flex items-center justify-between mt-1 pt-1 border-t border-slate-200/50">
                                        <span className="truncate max-w-[55px] font-medium">{entry.teacher.split(' ').slice(-1)[0]}</span>
                                        <span className="font-mono bg-slate-205/65 px-1 rounded text-[8px] truncate max-w-[45px] font-bold text-slate-700">{entry.room}</span>
                                      </div>

                                      {/* High-visibility inline tags inside grid cell block */}
                                      {entryConflicts.length > 0 && (
                                        <div className="mt-1.5 pt-1 border-t border-slate-200/50 flex flex-wrap gap-0.5 no-print">
                                          {entryConflicts.map((c, ix) => {
                                            const typeLabel = c.type === 'TEACHER' ? 'Docente' : 
                                                              c.type === 'ROOM' ? 'Aula' : 
                                                              c.type === 'OUT_OF_SHIFT' ? 'Jornada' : 
                                                              c.type === 'GROUP' ? 'Cruce Int.' : 'Hueco';
                                            return (
                                              <span 
                                                key={ix} 
                                                className={`text-[7px] font-extrabold uppercase tracking-wide px-1 py-0.5 rounded leading-none ${
                                                  c.severity === 'error' 
                                                    ? 'bg-rose-100/90 text-rose-800 border border-rose-200/60' 
                                                    : 'bg-amber-100/90 text-amber-800 border border-amber-200/60'
                                                }`}
                                                title={c.message}
                                              >
                                                ⚠️ {typeLabel}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Simulated live conflict tooltip/overlay inside the drop zone on drag hover */}
                                {isCellHovered && (
                                  <div className="absolute inset-x-1 inset-y-1 z-30 flex flex-col justify-center items-center p-1 bg-white/95 backdrop-blur-xs text-center border rounded-lg shadow-lg pointer-events-none transition-all">
                                    {isPotentialSolution ? (
                                      <div className="text-emerald-700 space-y-0.5 flex flex-col items-center">
                                        <CheckCircle className="w-5 h-5 text-emerald-500 animate-bounce" />
                                        <span className="font-extrabold text-[9px] uppercase tracking-wider block">¡Franja Libre!</span>
                                        <span className="text-[8px] text-slate-500 leading-none">Sin traslapes ni cruces</span>
                                      </div>
                                    ) : (
                                      <div className="text-rose-700 space-y-0.5 w-full flex flex-col items-center">
                                        <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                                        <span className="font-extrabold text-[9px] uppercase tracking-wider block">Conflictos ({simulatedConflicts.length})</span>
                                        <div className="max-h-[50px] w-full overflow-y-auto text-[7.5px] text-slate-600 font-medium font-sans leading-tight divide-y divide-rose-100/30 text-left px-1">
                                          {simulatedConflicts.map((c, idx) => (
                                            <div key={idx} className="py-0.5 line-clamp-2">
                                              • {c.message.replace(/Conflicto |Jornada Incorrecta: |Conflicto Docente: |Conflicto Aula: |Conflicto Semestre: /g, '')}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Switch bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-xs text-slate-500 font-sans font-semibold">
          Mostrando <strong className="text-slate-700 font-bold">{filteredEntries.length} de {entries.length}</strong> clases según filtros activos.
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setViewType('columns')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold font-sans transition-all cursor-pointer ${viewType === 'columns' ? 'bg-white text-indigo-650 shadow-xs' : 'text-slate-500 hover:text-slate-750'}`}
          >
            Vista Columnas por Día
          </button>
          <button
            onClick={() => setViewType('grid')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold font-sans transition-all cursor-pointer ${viewType === 'grid' ? 'bg-white text-indigo-650 shadow-xs' : 'text-slate-500 hover:text-slate-750'}`}
          >
            Matriz Horaria Semanal
          </button>
        </div>
      </div>

      {/* Render selected view */}
      {viewType === 'columns' ? renderColumnsView() : renderHourlyGridView()}
    </div>
  );
}
