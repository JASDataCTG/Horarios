import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Trash2, Calendar, Clock, MapPin, User, GraduationCap, AlertTriangle } from 'lucide-react';
import { ScheduleEntry } from '../types';
import { DAYS, CLASSROOMS, LOCATIONS, DEPARTMENTS } from '../data';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
  entryToEdit?: ScheduleEntry | null;
  // To perform instant conflict checking
  allEntries: ScheduleEntry[];
}

export default function ClassModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  entryToEdit,
  allEntries
}: ClassModalProps) {
  const [formData, setFormData] = useState<Omit<ScheduleEntry, 'id'>>({
    semester: 1,
    code: '',
    subject: '',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Lunes',
    startTime: '08:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 30,
    observation: ''
  });

  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (entryToEdit) {
      setFormData({
        semester: entryToEdit.semester,
        code: entryToEdit.code,
        subject: entryToEdit.subject,
        intensity: entryToEdit.intensity,
        activity: entryToEdit.activity,
        group: entryToEdit.group,
        day: entryToEdit.day,
        startTime: entryToEdit.startTime,
        durationHours: entryToEdit.durationHours,
        location: entryToEdit.location,
        room: entryToEdit.room,
        teacher: entryToEdit.teacher,
        department: entryToEdit.department,
        hoursTheory: entryToEdit.hoursTheory,
        hoursPractice: entryToEdit.hoursPractice,
        projection: entryToEdit.projection,
        observation: entryToEdit.observation || ''
      });
    } else {
      setFormData({
        semester: 1,
        code: '',
        subject: '',
        intensity: 48,
        activity: 'Teoría',
        group: 'G1',
        day: 'Lunes',
        startTime: '08:00',
        durationHours: 2,
        location: 'MHC',
        room: 'Por asignar',
        teacher: 'INSTITUCIONAL',
        department: 'INGENIERÍA',
        hoursTheory: 32,
        hoursPractice: 16,
        projection: 30,
        observation: ''
      });
    }
  }, [entryToEdit, isOpen]);

  // Handle instant conflict simulation upon changing scheduling fields
  useEffect(() => {
    const activeWarnings: string[] = [];
    const id = entryToEdit?.id;

    // Simulate scheduling limits
    const startMins = parseTimeToMins(formData.startTime);
    const endMins = startMins + (formData.durationHours * 60);

    // Shift boundaries check
    let validShift = false;
    let shiftName = '';
    // morning: 7am to 1:15pm
    const mS = 7 * 60;
    const mE = 13 * 60 + 15;
    // afternoon: 2pm to 5pm
    const aS = 14 * 60;
    const aE = 17 * 60;
    // evening: 6pm to 9:45pm
    const eS = 18 * 60;
    const eE = 21 * 60 + 45;

    if (startMins >= mS && startMins <= mE) {
      validShift = true;
      shiftName = 'Mañana (7:00 AM - 1:15 PM)';
      if (endMins > mE) {
        activeWarnings.push(`Excede el final de la Jornada Mañana (${formData.startTime} a ${formatMinsToTime(endMins)} superando 1:15 PM)`);
      }
    } else if (startMins >= aS && startMins <= aE) {
      validShift = true;
      shiftName = 'Tarde (2:00 PM - 5:00 PM)';
      if (endMins > aE) {
        activeWarnings.push(`Excede el final de la Jornada Tarde (${formData.startTime} a ${formatMinsToTime(endMins)} superando 5:00 PM)`);
      }
    } else if (startMins >= eS && startMins <= eE) {
      validShift = true;
      shiftName = 'Nocturna (6:00 PM - 9:45 PM)';
      if (endMins > eE) {
        activeWarnings.push(`Excede el final de la Jornada Nocturna (${formData.startTime} a ${formatMinsToTime(endMins)} superando 9:45 PM)`);
      }
    }

    if (!validShift) {
      activeWarnings.push(`La hora de inicio ${formData.startTime} está por fuera de cualquier jornada oficial académica.`);
    }

    // Check for overlaps with other active courses
    allEntries.forEach(other => {
      // Don't compare with self
      if (other.id === id) return;
      if (other.day !== formData.day) return;

      const otherStart = parseTimeToMins(other.startTime);
      const otherEnd = otherStart + (other.durationHours * 60);

      // Check temporal intersection
      const overlapped = startMins < otherEnd && otherStart < endMins;
      if (overlapped) {
        if (formData.teacher !== 'INSTITUCIONAL' && formData.teacher === other.teacher) {
          activeWarnings.push(`Cruza docente: "${formData.teacher}" ya enseña en "${other.subject}" (${other.startTime} - ${other.day})`);
        }
        if (formData.room !== 'Por asignar' && formData.room !== 'Institucional' && formData.room === other.room) {
          activeWarnings.push(`Cruza aula: El aula "${formData.room}" ya está ocupada por "${other.subject}" (${other.startTime} - ${other.day})`);
        }
        if (formData.semester === other.semester && formData.group === other.group && formData.group !== 'SG') {
          activeWarnings.push(`Cruza grupo: El Semestre ${formData.semester} grupo ${formData.group} ya tiene clase de "${other.subject}" (${other.startTime})`);
        }
      }
    });

    setWarnings(activeWarnings);
  }, [formData.day, formData.startTime, formData.durationHours, formData.teacher, formData.room, formData.semester, formData.group, allEntries, entryToEdit]);

  function parseTimeToMins(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function formatMinsToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'semester' || name === 'intensity' || name === 'hoursTheory' || name === 'hoursPractice' || name === 'projection' || name === 'durationHours')
        ? Number(value)
        : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      alert('Por favor ingrese el nombre de la asignatura');
      return;
    }
    onSave({
      ...formData,
      id: entryToEdit ? entryToEdit.id : `class-${Date.now()}`
    });
    onClose();
  };

  // Pre-configured typical scheduling suggestions
  const quickHours = ['07:00', '08:00', '10:00', '14:00', '18:00', '20:00'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500 text-white">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-800">
                    {entryToEdit ? 'Editar Programación de Clase' : 'Agregar Nueva Clase'}
                  </h2>
                  <p className="text-xs text-slate-500 font-sans">
                    {entryToEdit ? `Código: ${entryToEdit.code || 'S/N'}` : 'Configure los parámetros y valide cruces en tiempo real.'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 px-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                id="btn-close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Warnings / Live simulation alerts */}
              {warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-800 rounded-lg text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Cruces o Alertas de Estilo Sincronizado:
                  </span>
                  <ul className="list-disc pl-4 space-y-1 font-mono">
                    {warnings.map((warn, index) => (
                      <li key={index}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grid block 1: Basic Course Info */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Cód. Asignatura</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="E.g., 3198"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <div className="md:col-span-9">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nombre de Asignatura *</label>
                  <input
                    type="text"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="E.g., PROGRAMACIÓN DE BASES DE DATOS"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              {/* Grid block 2: Semester, Group, Dept */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Semestre</label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <option key={num} value={num}>Semestre {num}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Grupo</label>
                  <input
                    type="text"
                    name="group"
                    value={formData.group}
                    onChange={handleChange}
                    placeholder="E.g., G1, G11"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm animate-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Actividad</label>
                  <select
                    name="activity"
                    value={formData.activity}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm bg-white"
                  >
                    <option value="Teoría">Teoría</option>
                    <option value="Práctica">Práctica</option>
                    <option value="Teoría - Práctica">Teoría - Práctica</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Dependencia</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm bg-white"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid block 3: Scheduling (Day, Start Time, Duration) */}
              <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100/50 space-y-4">
                <span className="text-xs font-bold text-teal-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Programación de Horarios (Lunes a Sábado)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Día Propuesto</label>
                    <select
                      name="day"
                      value={formData.day}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-600 text-sm bg-white"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Hora Inicio Propuesta</label>
                    <input
                      type="text"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      placeholder="E.g., 08:00 o 18:00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-600 font-mono text-sm"
                    />
                    {/* Quick select tags */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {quickHours.map(time => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, startTime: time }))}
                          className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer ${formData.startTime === time ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1 flex items-center justify-between">
                      <span>Duración (Horas)</span>
                      <span className="text-teal-600 font-mono">{(formData.durationHours * 60)} min</span>
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      name="durationHours"
                      value={formData.durationHours}
                      onChange={handleChange}
                      min="0.5"
                      max="6"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-600 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Grid block 4: Physical Location & Teacher */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Sede</label>
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm bg-white"
                  >
                    {LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Aula Requerida (Salon)</label>
                  <select
                    name="room"
                    value={formData.room}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm bg-white"
                  >
                    {CLASSROOMS.map(cl => (
                      <option key={cl} value={cl}>{cl}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Docente Asignado</label>
                  <input
                    type="text"
                    name="teacher"
                    value={formData.teacher}
                    onChange={handleChange}
                    placeholder="Nombre del docente"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              {/* Grid block 5: Statistics & hours details */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Horas Totales</label>
                  <input
                    type="number"
                    name="intensity"
                    value={formData.intensity}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Horas Teoría</label>
                  <input
                    type="number"
                    name="hoursTheory"
                    value={formData.hoursTheory}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Horas Práctica</label>
                  <input
                    type="number"
                    name="hoursPractice"
                    value={formData.hoursPractice}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Proyección Matricula</label>
                  <input
                    type="number"
                    name="projection"
                    value={formData.projection}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              {/* Dynamic weekly intensity translation info card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row gap-4 items-center justify-between text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide font-sans">
                    Cálculo de Intensidad para 16 Semanas (2026-II)
                  </span>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    Un semestre de 16 semanas con {formData.intensity}h totales se desglosa semanalmente así:
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <div className="p-2.5 px-3 bg-indigo-50 border border-indigo-100 rounded-lg text-center min-w-[100px]">
                    <div className="font-bold text-indigo-700 text-sm font-mono">
                      {(formData.intensity / 16).toFixed(2)}h
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Reloj (60 min)</div>
                  </div>
                  <div className="p-2.5 px-3 bg-teal-50 border border-teal-100 rounded-lg text-center min-w-[100px]">
                    <div className="font-bold text-teal-700 text-sm font-mono">
                      {(formData.intensity / 12).toFixed(2)}h
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Académica (45 min)</div>
                  </div>
                </div>
              </div>

              {/* Observation notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Observaciones / Salas Especiales</label>
                <textarea
                  name="observation"
                  value={formData.observation}
                  onChange={handleChange}
                  placeholder="Ej: Requiere sala experimental, proyector HDMI, etc."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-teal-500 text-sm resize-none"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                {onDelete && entryToEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Está seguro de eliminar esta asignación horaria?')) {
                        onDelete(entryToEdit.id);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg hover:text-rose-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Asignación
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Listo / Guardar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
