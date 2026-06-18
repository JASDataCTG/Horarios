import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Grid,
  List,
  Home,
  User,
  Plus,
  RotateCcw,
  Download,
  Upload,
  Printer,
  Table,
  Search,
  AlertTriangle,
  FileDown,
  Sparkles,
  BookmarkCheck,
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';

import { ScheduleEntry, ShiftType } from './types';
import { INITIAL_ENTRIES, detectConflicts, DAYS, CLASSROOMS, LOCATIONS, autoResolveConflicts } from './data';
import MetricCard from './components/MetricCard';
import ClassModal from './components/ClassModal';
import WeeklyScheduleGrid from './components/WeeklyScheduleGrid';
import ConflictAlerts from './components/ConflictAlerts';
import ClassroomMatrix from './components/ClassroomMatrix';
import TeacherSchedules from './components/TeacherSchedules';
import SemesterStatusMatrix from './components/SemesterStatusMatrix';

export default function App() {
  // --- STATE ---
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<'grid' | 'list' | 'classrooms' | 'teachers'>('grid');
  const [selectedShift, setSelectedShift] = useState<ShiftType>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  
  // Search state inside active list
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyShowConflicts, setOnlyShowConflicts] = useState(false);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<ScheduleEntry | null>(null);

  // File Upload reference
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // --- PERSISTENCE HOOK ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem('university_schedule_entries');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read from localstorage, falling back to default pdf list.', e);
    }
    // Default load
    setEntries(INITIAL_ENTRIES);
  }, []);

  // Save changes to localStorage on entries change
  const saveEntries = (newEntries: ScheduleEntry[]) => {
    setEntries(newEntries);
    try {
      localStorage.setItem('university_schedule_entries', JSON.stringify(newEntries));
    } catch (e) {
      console.error('Failed to save state to localStore', e);
    }
  };

  // --- COMPUTED CONFLICTS ---
  // Real-time conflict engine computing overlaps in fractions of milliseconds on state changes
  const conflicts = useMemo(() => {
    return detectConflicts(entries);
  }, [entries]);

  // --- KPI STATISTICS ---
  const totalHours = useMemo(() => {
    return entries.reduce((acc, curr) => acc + curr.durationHours, 0);
  }, [entries]);

  const uniqueRoomsUsed = useMemo(() => {
    const list = entries.map(e => e.room).filter(Boolean);
    const roomsSet = new Set(list);
    roomsSet.delete('Por asignar');
    roomsSet.delete('Institucional');
    return roomsSet.size;
  }, [entries]);

  // --- SELECTION TO EDIT DUAL LINK ---
  // Click handler allowing any sub-panel (conflicts alert, or day grid card) to open the class editor form immediately
  const handleOpenEdit = (entry: ScheduleEntry) => {
    setEntryToEdit(entry);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEntryToEdit(null);
    setIsModalOpen(true);
  };

  // --- SAVE / DELETE MUTATORS ---
  const handleSaveEntry = (savedEntry: ScheduleEntry) => {
    let updated: ScheduleEntry[];
    const exists = entries.some(e => e.id === savedEntry.id);
    
    if (exists) {
      updated = entries.map(e => e.id === savedEntry.id ? savedEntry : e);
    } else {
      updated = [...entries, savedEntry];
    }
    saveEntries(updated);
  };

  const handleDeleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveEntries(updated);
  };

  // --- BACKUP MECHANISMS ---
  const handleResetToPDFData = () => {
    if (confirm('¿Desea restablecer toda la programación al estado original de la planilla del PDF? Se perderán las modificaciones actuales.')) {
      saveEntries(INITIAL_ENTRIES);
    }
  };

  const handleClearAllEntries = () => {
    if (confirm('¿Está absolutamente seguro de vaciar toda la base de datos de horarios de clases? Esto borrará permanentemente todos los registros y le permitirá ingresar sus propias clases y configurar la programación desde cero.')) {
      saveEntries([]);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "programacion_horarios_universidad.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          saveEntries(parsed);
          alert('¡Sincronización Exitosa! Horarios cargados correctamente desde el respaldo.');
        } else {
          alert('El archivo no tiene el formato correcto (debe ser un arreglo JSON de clases).');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  // --- EXCEL CSV COMPATIBILITY GENERATOR ---
  const handleExportToCSV = () => {
    // Columns for CSV
    const headers = ['Semestre', 'Codigo', 'Asignatura', 'Actividad', 'Grupo', 'Dia', 'HoraInicio', 'DuracionHoras', 'Sede', 'Aula', 'Docente', 'Dependencia', 'HorasTeoria', 'HorasPractica', 'Proyeccion'];
    
    const rows = entries.map(e => [
      e.semester,
      `"${e.code}"`,
      `"${e.subject.replace(/"/g, '""')}"`,
      `"${e.activity}"`,
      `"${e.group}"`,
      `"${e.day}"`,
      `"${e.startTime}"`,
      e.durationHours,
      `"${e.location || 'Por asignar'}"`,
      `"${e.room || 'Por asignar'}"`,
      `"${e.teacher.replace(/"/g, '""')}"`,
      `"${e.department || 'INGENIERÍA'}"`,
      e.hoursTheory || 0,
      e.hoursPractice || 0,
      e.projection || 0
    ]);

    // Add Unicode BOM (\uFEFF) to make Excel parse Spanish accents as UTF-8 immediately
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', 'programacion_horarios_excel.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleAutoResolveConflicts = () => {
    try {
      const resolved = autoResolveConflicts(entries);
      saveEntries(resolved);
      alert('¡Resolución de conflictos completada éxitosamente! Se han reorganizado las franjas horarias respetando las restricciones de semestres (1ro-5to de mañana/tarde, y de 6to-9no de noche) y previniendo cruces de aulas, docentes o semestres.');
    } catch (error) {
      alert('Error de procesamiento al intentar resolver automáticamente.');
    }
  };

  // --- SHIFT CHECKS ---
  const shiftText = () => {
    if (selectedShift === 'morning') return 'Mañana: 7 AM - 1:15 PM';
    if (selectedShift === 'afternoon') return 'Tarde: 2 PM - 5 PM';
    if (selectedShift === 'evening') return 'Nocturna: 6 PM - 9:45 PM';
    return 'Lunes a Sábado • Jornadas Combinadas';
  };

  // --- GRID LIST TABLE FILTERING ---
  const tableFilteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Semester filter
      if (selectedSemester !== 'all' && entry.semester.toString() !== selectedSemester) {
        return false;
      }
      // Sede filter
      if (selectedLocation !== 'all' && entry.location !== selectedLocation) {
        return false;
      }
      // Classroom filter
      if (selectedRoom !== 'all' && entry.room !== selectedRoom) {
        return false;
      }
      // Search phrase filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = entry.subject.toLowerCase().includes(query);
        const matchesCode = entry.code.toLowerCase().includes(query);
        const matchesTeacher = entry.teacher.toLowerCase().includes(query);
        const matchesDay = entry.day.toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesTeacher && !matchesDay) {
          return false;
        }
      }
      // Conflict checkbox isolation
      if (onlyShowConflicts) {
        const hasConflict = conflicts.some(c => c.involvedIds.includes(entry.id));
        if (!hasConflict) return false;
      }

      return true;
    });
  }, [entries, selectedSemester, selectedLocation, selectedRoom, searchTerm, onlyShowConflicts, conflicts]);

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* 1. Header Banner block in Geometric Balance Theme */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-xs no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0">
              <span>U</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800 leading-tight">
                  Programación Académica
                </h1>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded border border-indigo-100">
                  Vercel Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                Semestre 2026-II • Lunes a Sábado
              </p>
            </div>
          </div>

          {/* Quick Global Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:flex gap-4 border-r border-slate-200 pr-4 mr-2 text-right">
              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Facultad</span>
                <span className="text-xs font-bold text-slate-700">Ingeniería de Sistemas</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sede</span>
                <span className="text-xs font-bold text-slate-700">Campus Central</span>
              </div>
            </div>

            {/* CSV Export */}
            <button
              onClick={handleExportToCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200"
              title="Descargar planilla de horarios finales en formato de hoja de cálculo compatible con Excel y Sheets"
            >
              <FileDown className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Exportar a Excel (.csv)</span>
            </button>

            {/* Backups buttons */}
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200"
              title="Descargar base de datos local en JSON"
            >
              <Download className="w-4 h-4 text-sky-600" />
              <span>Descargar JSON</span>
            </button>

            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200"
              title="Cargar archivo JSON guardado"
            >
              <Upload className="w-4 h-4 text-purple-600" />
              <span>Cargar JSON</span>
            </button>

            <input
              type="file"
              ref={uploadInputRef}
              onChange={handleImportJSON}
              accept=".json"
              className="hidden"
            />

            {/* Reset back to pristine data */}
            <button
              onClick={handleResetToPDFData}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 text-xs font-semibold text-rose-700 rounded-lg transition-all cursor-pointer border border-rose-200"
              title="Reestablecer programación de carga original del PDF"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restablecer PDF</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200"
              title="Abrir diálogo de impresión de horarios"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Shifts visual description subbar - "Geometric Balance" layout element */}
      <div className="bg-slate-100/80 backdrop-blur-xs border-b border-slate-200 py-3 px-6 shrink-0 text-xs font-semibold text-slate-600 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Mañana (07:00 - 13:15)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500"></div>
            <span>Tarde (14:00 - 17:00)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-indigo-500"></div>
            <span>Nocturna (18:00 - 21:45)</span>
          </div>
          <div className="ml-auto text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Ingeniería de Sistemas • Campus Central
          </div>
        </div>
      </div>

      {/* Printable page header */}
      <div className="hidden print:block p-6 border-b border-black text-center mb-6">
        <h1 className="text-2xl font-bold">REPORTE OFICIAL DE PROGRAMACIÓN HORARIA</h1>
        <p className="text-sm text-slate-600 mt-1">Universidad Central • Lunes a Sábado • Jornadas de Estudio</p>
        <p className="text-xs text-slate-500 mt-0.5">Emitido el: {new Date().toLocaleDateString()}</p>
      </div>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* KPI Dashboard Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <MetricCard
            title="Total Clases"
            value={entries.length}
            description="Asignaciones totales cargadas"
            icon={Table}
            iconColorClass="text-teal-600"
            bgColorClass="bg-teal-50"
          />
          <MetricCard
            title="Total Carga Horaria"
            value={`${totalHours} hrs`}
            description="Suma acumulada de horas"
            icon={Clock}
            iconColorClass="text-sky-600"
            bgColorClass="bg-sky-50"
          />
          <MetricCard
            title="Aulas Ocupadas"
            value={uniqueRoomsUsed}
            description="Excluye virtuales/por asignar"
            icon={Home}
            iconColorClass="text-purple-600"
            bgColorClass="bg-purple-50"
          />
          <MetricCard
            title="Cruces & Choques"
            value={conflicts.length}
            description={conflicts.length > 0 ? "Requieren atención" : "Cero superposiciones"}
            icon={AlertTriangle}
            iconColorClass={conflicts.length > 0 ? "text-rose-500 animate-pulse" : "text-emerald-500"}
            bgColorClass={conflicts.length > 0 ? "bg-rose-50" : "bg-emerald-50"}
          />
        </section>

        {/* 16-Week Calendar & Academic Hour Conversion Ruler Card */}
        <section className="bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-100 rounded-xl p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start justify-between no-print">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500 shrink-0"></span>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">
                Parámetros de Calendario Semestral 2026-II
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              El periodo lectivo consta de <strong>16 semanas continuas</strong>, iniciando el <strong>3 de agosto de 2026</strong> y finalizando el <strong>28 de noviembre de 2026</strong>. 
              La división de la intensidad total entre las semanas resulta en horas reloj de 60 minutos, las cuales se programan de manera efectiva en bloques o periodos de <strong>45 minutos académicos</strong>.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xs border border-teal-200/50 rounded-lg p-3.5 space-y-2 shrink-0 md:w-80 text-xs font-mono">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Fórmula de Equivalencias
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
              <span className="text-slate-500">Intensidad Semanal (60m)</span>
              <span className="font-bold text-indigo-700">Total / 16</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500">Horas Académicas (45m)</span>
              <span className="font-bold text-teal-700">Total / 12</span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans italic mt-1.5 text-center">
              Ej: 48h totales = 3.0h (60 min) = 4.0h (45 min)
            </div>
          </div>
        </section>

        {/* Semester Status Traffic Light System (Indicator and Selector) */}
        <SemesterStatusMatrix
          entries={entries}
          conflicts={conflicts}
          selectedSemester={selectedSemester}
          onSelectSemester={(sem) => setSelectedSemester(sem)}
          onSelectClassToEdit={handleOpenEdit}
        />

        {/* 3. Primary Workspace Divide Grid (Left Panels + Right Diagnostic) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 8-COLS: Tab controller and active workspace panel */}
          <div className="lg:col-span-8 space-y-4 flex flex-col h-full">
            
            {/* Panel Tabs Controls - Geometric Balance styled */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex flex-wrap gap-1.5 no-print">
              <button
                onClick={() => setSelectedTab('grid')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${selectedTab === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Grid className="w-4 h-4" />
                Matriz de Horarios
              </button>
              <button
                onClick={() => setSelectedTab('list')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${selectedTab === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <List className="w-4 h-4" />
                Planilla de Datos (Spreadsheet)
              </button>
              <button
                onClick={() => setSelectedTab('classrooms')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${selectedTab === 'classrooms' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Home className="w-4 h-4" />
                Disponibilidad de Aulas
              </button>
              <button
                onClick={() => setSelectedTab('teachers')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${selectedTab === 'teachers' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <User className="w-4 h-4" />
                Carga de Docentes
              </button>

              <div className="ml-auto no-print flex items-center gap-2">
                <button
                  onClick={handleAutoResolveConflicts}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Resuelve automáticamente los cruces de aulas, docentes, semestres, y ajusta jornadas"
                >
                  <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>Arreglar Conflictos</span>
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Agregar Clase
                </button>
              </div>
            </div>

            {/* TAB CONTENT RENDERING (Animated fade ins / out) */}
            <div className="flex-1">
              
              {/* --- VIEW 1: GRID WEEKLY VIEW --- */}
              {selectedTab === 'grid' && (
                <div className="space-y-4">
                  {/* Local Filters block unique to calendar matrix */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left no-print">
                    
                    {/* Shift Filter tab buttons */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-sans">Jornadas</label>
                      <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value as ShiftType)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white font-sans font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="all">Todas las jornadas</option>
                        <option value="morning">Mañana (7 AM - 1:15 PM)</option>
                        <option value="afternoon">Tarde (2 PM - 5 PM)</option>
                        <option value="evening">Nocturna (6 PM - 9:45 PM)</option>
                      </select>
                    </div>

                    {/* Semester select */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-sans">Semestre</label>
                      <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white text-slate-700 font-sans cursor-pointer"
                      >
                        <option value="all">Todos los Semestres</option>
                        {[1,2,3,4,5,6,7,8,9].map(num => (
                          <option key={num} value={num}>Semestre {num}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quick informational guidelines note */}
                    <div className="flex items-center text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2 gap-1.5 h-10 col-span-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <strong className="text-slate-600">Jornadas:</strong> {shiftText()}
                      </div>
                    </div>
                  </div>

                  <WeeklyScheduleGrid
                    entries={entries}
                    conflicts={conflicts}
                    onEditEntry={handleOpenEdit}
                    selectedShift={selectedShift}
                    selectedSemester={selectedSemester}
                    onUpdateEntry={handleSaveEntry}
                  />
                </div>
              )}

              {/* --- VIEW 2: LIST SPREADSHEET VIEW --- */}
              {selectedTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 font-sans">
                  
                  {/* Local Database Administration Dashboard Segment */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-7 space-y-1 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                        <Table className="w-4 h-4 text-indigo-600" />
                        <span>Consola de Base de Datos de Horarios (Local)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                        Esta aplicación gestiona la programación de manera local directa. Los datos se guardan de forma permanente y segura en la memoria de su navegador (<code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-650">localStorage</code>) para que no dependa de re-cargar el archivo PDF. Las alteraciones persisten al cerrar la sesión.
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold font-sans">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <span>Base de Datos Activa: {entries.length} clases almacenadas en el equipo</span>
                      </div>
                    </div>
                    <div className="md:col-span-5 flex flex-wrap gap-1.5 justify-end">
                      <button
                        onClick={() => uploadInputRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 text-[11px] font-bold text-indigo-700 rounded-lg transition-all cursor-pointer"
                        title="Importar un archivo de respaldo JSON de horarios"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>Cargar Copia</span>
                      </button>
                      <button
                        onClick={handleExportJSON}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-100 hover:text-sky-850 text-[11px] font-bold text-sky-750 rounded-lg transition-all cursor-pointer"
                        title="Descargar copia de respaldo JSON de la programación"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Exportar JSON</span>
                      </button>
                      <button
                        onClick={handleResetToPDFData}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 text-[11px] font-bold text-amber-700 rounded-lg transition-all cursor-pointer"
                        title="Descargar datos originales leídos del PDF"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Volver al PDF</span>
                      </button>
                      <button
                        onClick={handleClearAllEntries}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 text-[11px] font-bold text-rose-700 rounded-lg transition-all cursor-pointer"
                        title="Eliminar absolutamente todas las asignaturas para editarlas libremente"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                        <span>Vaciar Todo</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Spreadsheet controls */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Table className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-slate-800">Planilla Completa de Asignaturas</h3>
                    </div>
                    
                    {/* Live search input table */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar materia, docente o día..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 pr-3 py-1 border border-slate-200 rounded-lg outline-none text-xs w-48 focus:border-indigo-500 font-sans"
                        />
                      </div>

                      {/* Semester Filter */}
                      <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg outline-none text-xs text-slate-600 bg-white font-sans font-semibold cursor-pointer"
                      >
                        <option value="all">S: Todos</option>
                        {[1,2,3,4,5,6,7,8,9].map(num => (
                          <option key={num} value={num}>Sem {num}</option>
                        ))}
                      </select>

                      {/* Sede Filter */}
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg outline-none text-xs text-slate-600 bg-white font-sans font-semibold cursor-pointer"
                      >
                        <option value="all">Sede: Todas</option>
                        {LOCATIONS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>

                      {/* Conflict Switch */}
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                        <input
                          type="checkbox"
                          checked={onlyShowConflicts}
                          onChange={(e) => setOnlyShowConflicts(e.target.checked)}
                          className="accent-rose-600"
                        />
                        <span>Solo con conflictos</span>
                      </label>
                    </div>
                  </div>

                  {/* Spreadsheet table list */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                          <th className="p-3 pl-4">Sem.</th>
                          <th className="p-3">Asignatura</th>
                          <th className="p-3">Clase / Grupo</th>
                          <th className="p-3">Horario</th>
                          <th className="p-3">Sede / Aula</th>
                          <th className="p-3">Docente</th>
                          <th className="p-3 text-center">Horas Totales</th>
                          <th className="p-3 text-center">Intensidad Semanal (60m / 45m)</th>
                          <th className="p-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {tableFilteredEntries.map(entry => {
                          const hasConflicts = conflicts.some(c => c.involvedIds.includes(entry.id));
                          
                          return (
                            <tr
                              key={entry.id}
                              className={`hover:bg-slate-50/50 transition-colors ${hasConflicts ? 'bg-rose-50/20' : ''}`}
                            >
                              <td className="p-3 pl-4 font-bold text-slate-400 font-mono">
                                S{entry.semester}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{entry.subject}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Cód: {entry.code || 'N/A'} • {entry.activity}</div>
                              </td>
                              <td className="p-3">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold font-mono text-slate-600">{entry.group}</span>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-700">{entry.day}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{entry.startTime} ({entry.durationHours} hrs)</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-700">{entry.room || 'Por asignar'}</div>
                                <div className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">Sede: {entry.location}</div>
                              </td>
                              <td className="p-3">
                                <span className="font-medium text-slate-600">{entry.teacher}</span>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap font-mono">
                                <div className="text-slate-700 font-bold">{entry.intensity}h</div>
                                <div className="text-[9px] text-slate-400">T:{entry.hoursTheory} / P:{entry.hoursPractice}</div>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap font-mono">
                                <div className="text-indigo-600 font-bold">{(entry.intensity / 16).toFixed(2)}h <span className="text-[10px] text-slate-400 font-medium">/sem (60m)</span></div>
                                <div className="text-teal-600 font-semibold">{(entry.intensity / 12).toFixed(2)}h <span className="text-[10px] text-slate-400 font-medium">/sem (45m)</span></div>
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEdit(entry)}
                                  className="p-1.5 rounded-lg border border-slate-205 hover:border-indigo-500 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 transition-colors cursor-pointer"
                                  title="Editar clase"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {tableFilteredEntries.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 italic font-sans">
                              Ninguna asignatura coincide con los filtros especificados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary counts */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 font-mono">
                    <span>Mostrando {tableFilteredEntries.length} de {entries.length} asignaciones</span>
                    {onlyShowConflicts && (
                      <span className="text-rose-600 font-bold">Modo aislamiento de conflictos activo</span>
                    )}
                  </div>
                </div>
              )}

              {/* --- VIEW 3: CLASSROOM MATRIX VIEW --- */}
              {selectedTab === 'classrooms' && (
                <ClassroomMatrix
                  entries={entries}
                  onSelectEntry={handleOpenEdit}
                />
              )}

              {/* --- VIEW 4: TEACHERS WORKLOAD VIEW --- */}
              {selectedTab === 'teachers' && (
                <TeacherSchedules
                  entries={entries}
                  conflicts={conflicts}
                  onSelectEntry={handleOpenEdit}
                />
              )}

            </div>
          </div>

          {/* RIGHT 4-COLS: Real-time conflicts and diagnostic alerts console */}
          <div className="lg:col-span-4 sticky top-6 space-y-4 no-print">
            <ConflictAlerts
              conflicts={conflicts}
              entries={entries}
              onSelectClassToEdit={handleOpenEdit}
            />

            {/* Quick schedule checklist reference panel in Geometric Balance Theme */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-205 p-5 text-left text-xs space-y-3">
              <h4 className="font-bold font-sans text-slate-800 flex items-center gap-1.5">
                <BookmarkCheck className="w-4 h-4 text-indigo-650" />
                Guía de Jornadas Oficiales:
              </h4>
              <p className="text-slate-500 font-sans leading-relaxed">
                El algoritmo de detección valida automáticamente que los horarios estén asignados de lunes a sábado dentro de estos límites:
              </p>
              <ul className="space-y-2 font-sans text-slate-600">
                <li className="flex items-center justify-between p-1.5 bg-sky-50/50 rounded-lg">
                  <span className="font-bold text-sky-800">1. Jornada Mañana:</span>
                  <span className="font-mono text-[11px] font-semibold">7:00 AM - 1:15 PM</span>
                </li>
                <li className="flex items-center justify-between p-1.5 bg-amber-50/50 rounded-lg">
                  <span className="font-bold text-amber-800">2. Jornada Tarde:</span>
                  <span className="font-mono text-[11px] font-semibold">2:00 PM - 5:00 PM</span>
                </li>
                <li className="flex items-center justify-between p-1.5 bg-indigo-50/55 rounded-lg border-indigo-100">
                  <span className="font-bold text-indigo-805">3. Jornada Nocturna:</span>
                  <span className="font-mono text-[11px] font-semibold">6:00 PM - 9:45 PM</span>
                </li>
              </ul>
              <div className="p-3.5 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-150 leading-snug">
                <strong>Nota Sincronizada:</strong> Los cursos importados originalmente de la tabla PDF que inician a las <code className="bg-slate-200 px-1 rounded font-mono text-slate-700">06:00 AM</code> generarán advertencias, invitándole a resolverlas moviéndolas a bloques que comiencen a las <code className="bg-indigo-100/50 px-1 text-indigo-800 rounded font-mono font-bold">07:00 AM</code>.
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* 4. Footer credits information */}
      <footer className="mt-12 bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-sans shrink-0 no-print">
        <p>© 2026 Universidad Central • Coordinación De Ingeniería & Horarios Académicos</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Diseñado sin uso de API ni dependencias de bases de datos externas. Compatible para un despliegue estático ultra-rápido en Vercel.
        </p>
      </footer>

      {/* 5. Master Form Modal Overlay */}
      <ClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        entryToEdit={entryToEdit}
        allEntries={entries}
      />

    </div>
  );
}

// Inline component to edit specific properties
function Edit2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
