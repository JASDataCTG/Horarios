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
  Clock,
  Eye,
  EyeOff,
  ShieldAlert,
  Database,
  Trash2,
  Copy,
  GraduationCap,
  X
} from 'lucide-react';

import { ScheduleEntry, ShiftType, DBSubject, DBClassroom, DBTeacher } from './types';
import { INITIAL_ENTRIES, detectConflicts, DAYS, CLASSROOMS, LOCATIONS, autoResolveConflicts } from './data';
import { 
  isSupabaseConfigured, 
  getSupabaseEntries, 
  saveAllSupabaseEntries,
  getSupabaseSubjects,
  saveSupabaseSubject,
  deleteSupabaseSubject,
  getSupabaseClassrooms,
  saveSupabaseClassroom,
  deleteSupabaseClassroom,
  getSupabaseTeachers,
  saveSupabaseTeacher,
  deleteSupabaseTeacher
} from './lib/supabaseClient';
import MetricCard from './components/MetricCard';
import ClassModal from './components/ClassModal';
import WeeklyScheduleGrid from './components/WeeklyScheduleGrid';
import ConflictAlerts from './components/ConflictAlerts';
import ClassroomMatrix from './components/ClassroomMatrix';
import TeacherSchedules from './components/TeacherSchedules';
import SemesterStatusMatrix from './components/SemesterStatusMatrix';

// Relational database default seeding helper functions
const getInitialSubjects = (): DBSubject[] => {
  const list: DBSubject[] = [];
  const seen = new Set<string>();
  INITIAL_ENTRIES.forEach(e => {
    if (e.code && !seen.has(e.code)) {
      seen.add(e.code);
      list.push({
        code: e.code,
        name: e.subject,
        intensity: e.intensity || 32,
        hours_theory: e.hoursTheory || 0,
        hours_practice: e.hoursPractice || 0,
        department: e.department || 'INGENIERÍA'
      });
    }
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
};

const getInitialTeachers = (): DBTeacher[] => {
  const list: DBTeacher[] = [];
  const seen = new Set<string>();
  INITIAL_ENTRIES.forEach(e => {
    const name = e.teacher || 'INSTITUCIONAL';
    if (!seen.has(name)) {
      seen.add(name);
      list.push({
        name,
        department: e.department || 'INGENIERÍA'
      });
    }
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
};

const getInitialClassrooms = (): DBClassroom[] => {
  const list: DBClassroom[] = [];
  const seen = new Set<string>();
  classroomsSeed.forEach(rm => {
    if (rm && !seen.has(rm)) {
      seen.add(rm);
      const matched = INITIAL_ENTRIES.find(e => e.room === rm);
      list.push({
        name: rm,
        location: matched ? matched.location : 'RN'
      });
    }
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
};

const classroomsSeed = [
  'QuantumX',
  'QuantumBeta',
  'QuantumAlpha',
  'Matrix',
  'Horizons',
  'Sala ocasional',
  'Institucional',
  'Por asignar'
];

export default function App() {
  // --- STATE ---
  const [entries, setEntries] = useState<ScheduleEntry[]>(INITIAL_ENTRIES);
  const [subjects, setSubjects] = useState<DBSubject[]>(() => getInitialSubjects());
  const [teachers, setTeachers] = useState<DBTeacher[]>(() => getInitialTeachers());
  const [classrooms, setClassrooms] = useState<DBClassroom[]>(() => getInitialClassrooms());

  // Related CRUD tab states
  const [crudSubTab, setCrudSubTab] = useState<'entries' | 'subjects' | 'teachers' | 'classrooms'>('entries');
  
  // Entity Form states
  const [isSubjectFormOpen, setIsSubjectFormOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<DBSubject | null>(null);
  const [subjectFormState, setSubjectFormState] = useState<DBSubject>({
    code: '',
    name: '',
    intensity: 32,
    hours_theory: 32,
    hours_practice: 0,
    department: 'INGENIERÍA'
  });

  const [isTeacherFormOpen, setIsTeacherFormOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<DBTeacher | null>(null);
  const [teacherFormState, setTeacherFormState] = useState<DBTeacher>({
    name: '',
    department: 'INGENIERÍA'
  });

  const [isClassroomFormOpen, setIsClassroomFormOpen] = useState(false);
  const [classroomToEdit, setClassroomToEdit] = useState<DBClassroom | null>(null);
  const [classroomFormState, setClassroomFormState] = useState<DBClassroom>({
    name: '',
    location: 'RN'
  });

  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(true);

  const toggleDiagnostics = () => {
    setShowDiagnostics(prev => !prev);
  };

  const [selectedTab, setSelectedTab] = useState<'grid' | 'list' | 'classrooms' | 'teachers' | 'crud'>('grid');
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

  // --- SUPABASE CONNECTIVITY STATES ---
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(false);
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(false);
  const [supabaseMessage, setSupabaseMessage] = useState<string>('Detectando base de datos...');

  // Sync load from Supabase if configured at startup
  useEffect(() => {
    const initDatabase = async () => {
      const isConfigured = isSupabaseConfigured();
      setIsSupabaseActive(isConfigured);
      if (isConfigured) {
        setSupabaseLoading(true);
        setSupabaseMessage('Conectando con Supabase...');
        try {
          const [cloudEntries, cloudSubjects, cloudClassrooms, cloudTeachers] = await Promise.all([
            getSupabaseEntries(),
            getSupabaseSubjects(),
            getSupabaseClassrooms(),
            getSupabaseTeachers()
          ]);

          if (cloudSubjects && cloudSubjects.length > 0) {
            setSubjects(cloudSubjects);
          } else {
            const defaults = getInitialSubjects();
            setSubjects(defaults);
            for (const sub of defaults) {
              await saveSupabaseSubject(sub);
            }
          }

          if (cloudClassrooms && cloudClassrooms.length > 0) {
            setClassrooms(cloudClassrooms);
          } else {
            const defaults = getInitialClassrooms();
            setClassrooms(defaults);
            for (const cl of defaults) {
              await saveSupabaseClassroom(cl);
            }
          }

          if (cloudTeachers && cloudTeachers.length > 0) {
            setTeachers(cloudTeachers);
          } else {
            const defaults = getInitialTeachers();
            setTeachers(defaults);
            for (const tc of defaults) {
              await saveSupabaseTeacher(tc);
            }
          }

          if (cloudEntries !== null && cloudEntries.length > 0) {
            setEntries(cloudEntries);
            setSupabaseMessage('✓ Sincronizado: Base de Datos Relacional de Supabase Conectada');
          } else {
            // First time load or empty, let's push the existing state to initialize cloud
            await saveAllSupabaseEntries(INITIAL_ENTRIES);
            setEntries(INITIAL_ENTRIES);
            setSupabaseMessage('Conectado: Base de Datos Inicializada con Datos Base');
          }
        } catch (err) {
          console.error(err);
          setSupabaseMessage('Error de Sincronización con la Base de Datos Nube');
        } finally {
          setSupabaseLoading(false);
        }
      } else {
        setSupabaseMessage('Base de Datos Nube no configurada. Usando Datos en Memoria.');
      }
    };
    initDatabase();
  }, []);

  // Save changes and push to Supabase cloud if active
  const saveEntries = async (newEntries: ScheduleEntry[]) => {
    setEntries(newEntries);

    if (isSupabaseConfigured()) {
      setSupabaseLoading(true);
      setSupabaseMessage('Sincronizando cambios en Supabase...');
      try {
        const success = await saveAllSupabaseEntries(newEntries);
        if (success) {
          setSupabaseMessage('✓ Sincronizado en Supabase Cloud');
        } else {
          setSupabaseMessage('⚠ Fallo al guardar en Supabase.');
        }
      } catch (e) {
        console.error(e);
        setSupabaseMessage('⚠ Sin conexión con la Base de Datos Nube.');
      } finally {
        setSupabaseLoading(false);
      }
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

  const handleDuplicateEntry = (entry: ScheduleEntry) => {
    const duplicated: ScheduleEntry = {
      ...entry,
      id: `class-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      group: `${entry.group}-COP`,
    };
    saveEntries([...entries, duplicated]);
  };

  // --- RELATED TABLES CRUD MUTATORS ---
  const handleSaveSubject = async (sub: DBSubject) => {
    const exists = subjects.some(s => s.code === sub.code);
    const updated = exists
      ? subjects.map(s => s.code === sub.code ? sub : s)
      : [...subjects, sub];
    setSubjects(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Guardando asignatura en Supabase...');
      const success = await saveSupabaseSubject(sub);
      if (success) {
        setSupabaseMessage('✓ Asignatura guardada con éxito.');
      } else {
        setSupabaseMessage('⚠ Error al sincronizar asignatura.');
      }
      setSupabaseLoading(false);
    }
  };

  const handleDeleteSubject = async (code: string) => {
    const updated = subjects.filter(s => s.code !== code);
    setSubjects(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Eliminando asignatura de Supabase...');
      const success = await deleteSupabaseSubject(code);
      if (success) {
        setSupabaseMessage('✓ Asignatura eliminada.');
      } else {
        setSupabaseMessage('⚠ Error al eliminar asignatura.');
      }
      setSupabaseLoading(false);
    }
  };

  const handleSaveTeacher = async (tch: DBTeacher) => {
    const exists = teachers.some(t => t.name.toLowerCase() === tch.name.toLowerCase());
    const updated = exists
      ? teachers.map(t => t.name.toLowerCase() === tch.name.toLowerCase() ? tch : t)
      : [...teachers, tch];
    setTeachers(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Guardando docente en Supabase...');
      const success = await saveSupabaseTeacher(tch);
      if (success) {
        setSupabaseMessage('✓ Docente guardado con éxito.');
      } else {
        setSupabaseMessage('⚠ Error al sincronizar docente.');
      }
      setSupabaseLoading(false);
    }
  };

  const handleDeleteTeacher = async (name: string) => {
    const updated = teachers.filter(t => t.name !== name);
    setTeachers(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Eliminando docente de Supabase...');
      const success = await deleteSupabaseTeacher(name);
      if (success) {
        setSupabaseMessage('✓ Docente eliminado.');
      } else {
        setSupabaseMessage('⚠ Error al eliminar docente.');
      }
      setSupabaseLoading(false);
    }
  };

  const handleSaveClassroom = async (rm: DBClassroom) => {
    const exists = classrooms.some(c => c.name.toLowerCase() === rm.name.toLowerCase());
    const updated = exists
      ? classrooms.map(c => c.name.toLowerCase() === rm.name.toLowerCase() ? rm : c)
      : [...classrooms, rm];
    setClassrooms(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Guardando aula en Supabase...');
      const success = await saveSupabaseClassroom(rm);
      if (success) {
        setSupabaseMessage('✓ Aula guardada con éxito.');
      } else {
        setSupabaseMessage('⚠ Error al sincronizar aula.');
      }
      setSupabaseLoading(false);
    }
  };

  const handleDeleteClassroom = async (name: string) => {
    const updated = classrooms.filter(c => c.name !== name);
    setClassrooms(updated);

    if (isSupabaseActive) {
      setSupabaseLoading(true);
      setSupabaseMessage('Eliminando aula de Supabase...');
      const success = await deleteSupabaseClassroom(name);
      if (success) {
        setSupabaseMessage('✓ Aula eliminada.');
      } else {
        setSupabaseMessage('⚠ Error al eliminar aula.');
      }
      setSupabaseLoading(false);
    }
  };

  // --- DATABASE PURGE ---
  const handleClearAllEntries = () => {
    if (confirm('¿Está absolutamente seguro de vaciar toda la base de datos de horarios de clases? Esto borrará permanentemente todos los registros y le permitirá ingresar sus propias clases y configurar la programación desde cero.')) {
      saveEntries([]);
    }
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
                  Vercel & Supabase Ready
                </span>
              </div>
              <p className="text-xs text-slate-505 uppercase tracking-widest font-semibold mt-0.5">
                Semestre 2026-II • Lunes a Sábado
              </p>
              
              {/* Dynamic Database Status Banner */}
              <div className="flex items-center gap-1.5 mt-1 border border-slate-100 bg-slate-50/50 px-2 py-0.5 rounded-md w-fit">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  isSupabaseActive 
                    ? (supabaseLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse') 
                    : 'bg-slate-400'
                }`}></span>
                <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                  {supabaseMessage}
                  {isSupabaseActive && (
                    <button 
                      onClick={async () => {
                        setSupabaseLoading(true);
                        setSupabaseMessage('Sincronizando manualmente...');
                        try {
                          const cloudEntries = await getSupabaseEntries();
                          if (cloudEntries !== null && cloudEntries.length > 0) {
                            setEntries(cloudEntries);
                            setSupabaseMessage('✓ Sincronizado con Supabase');
                          } else {
                            await saveAllSupabaseEntries(entries);
                            setSupabaseMessage('✓ Repoblado y sincronizado');
                          }
                        } catch (e) {
                          setSupabaseMessage('⚠ Fallo en sincronización');
                        } finally {
                          setSupabaseLoading(false);
                        }
                      }}
                      className="ml-1 text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-[10px] font-bold"
                      title="Forzar actualización manual recargando los datos de la base de datos Supabase"
                    >
                      (Actualizar Nube)
                    </button>
                  )}
                </span>
              </div>
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

        {/* 3. Primary Full-Width Workspace Panel */}
        <div className="space-y-4 flex flex-col w-full">
            
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
              <button
                onClick={() => setSelectedTab('crud')}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${selectedTab === 'crud' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-100' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Database className="w-4 h-4" />
                Gestión CRUD (Nube)
              </button>
 
               <div className="ml-auto no-print flex items-center gap-2 flex-wrap sm:flex-nowrap">
                 <button
                   onClick={toggleDiagnostics}
                   className={`flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold rounded-lg border shadow-xs transition-all cursor-pointer ${
                     showDiagnostics 
                       ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700' 
                       : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
                   }`}
                   title={showDiagnostics ? 'Ocultar consola de diagnósticos y alertas en la parte inferior' : 'Mostrar consola de diagnósticos y alertas en la parte inferior'}
                 >
                   {showDiagnostics ? (
                     <>
                       <EyeOff className="w-3.5 h-3.5 shrink-0" />
                       <span>Ocultar Alertas ({conflicts.length})</span>
                     </>
                   ) : (
                     <>
                       <Eye className="w-3.5 h-3.5 shrink-0 animate-pulse text-emerald-600" />
                       <span>Mostrar Alertas ({conflicts.length})</span>
                     </>
                   )}
                 </button>
                 <button
                   onClick={handleAutoResolveConflicts}
                   className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                   title="Resuelve automáticamente los cruces de aulas, docentes, semestres, y ajusta jornadas"
                 >
                   <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                   <span>Arreglar Conflictos</span>
                 </button>
                 <button
                   onClick={handleOpenCreate}
                   className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                 >
                   <Plus className="w-3.5 h-3.5 shrink-0" />
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
                  
                  {/* Supabase Cloud Database Administration Panel */}
                  <div className="bg-emerald-50/40 border border-emerald-200/50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-1 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider font-sans">
                        <Database className="w-4.5 h-4.5 text-emerald-600" />
                        <span>Sincronización de Base de Datos (Supabase Cloud Active)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-sans leading-relaxed">
                        Esta aplicación utiliza **Supabase** como persistencia oficial. Cada cambio realizado (crear, modificar o eliminar clases) se sincroniza automáticamente en la nube en tiempo real, garantizando la consistencia absoluta de los horarios para todo el equipo.
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold font-sans">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <span>Estado: Sincronización en la nube configurada con {entries.length} clases activas</span>
                      </div>
                    </div>
                    <div className="md:col-span-4 flex flex-wrap gap-1.5 justify-end">
                      <button
                        onClick={handleClearAllEntries}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 text-[11px] font-bold text-rose-700 rounded-lg transition-all cursor-pointer"
                        title="Eliminar absolutamente todas las asignaturas de la base de datos Supabase"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                        <span>Vaciar Base de Datos</span>
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

              {/* --- VIEW 5: DATABASE CRUD MANAGEMENT TAB --- */}
              {selectedTab === 'crud' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6 font-sans">
                  
                  {/* Related Tables Selector */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCrudSubTab('entries');
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        crudSubTab === 'entries'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Asignaciones de Horarios ({entries.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCrudSubTab('subjects');
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        crudSubTab === 'subjects'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Asignaturas (Materias) ({subjects.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCrudSubTab('teachers');
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        crudSubTab === 'teachers'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Banco de Docentes ({teachers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCrudSubTab('classrooms');
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        crudSubTab === 'classrooms'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Catálogo de Aulas ({classrooms.length})
                    </button>
                  </div>

                  {/* 1. VIEW FOR SCHEDULE ENTRIES TAB */}
                  {crudSubTab === 'entries' && (
                    <div className="space-y-6 text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 rounded-2xl border border-emerald-100/80">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-emerald-500 text-white shadow-xs">
                              <Database className="w-5 h-5" />
                            </span>
                            <div>
                              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                Consola de Operaciones CRUD
                              </h3>
                              <p className="text-xs text-slate-500 font-sans mt-0.5">
                                Cree, edite, duplique y elimine asignaturas en tiempo real con sincronización directa en Supabase Cloud.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex sm:items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                          <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02]"
                          >
                            <Plus className="w-4 h-4 shrink-0" />
                            <span>Añadir Nueva Asignatura</span>
                          </button>
                        </div>
                      </div>

                      {/* Search and filter controls inside CRUD workspace */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2">
                        <div className="md:col-span-4 relative">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar materia, docente o día..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none text-xs w-full focus:bg-slate-50/50 focus:border-emerald-500 font-sans transition-colors"
                          />
                        </div>

                        <div className="md:col-span-8 flex flex-wrap gap-2 justify-start md:justify-end">
                          <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs text-slate-600 bg-white font-sans font-semibold cursor-pointer focus:border-emerald-500"
                          >
                            <option value="all">S: Todos los Semestres</option>
                            {[1,2,3,4,5,6,7,8,9].map(num => (
                              <option key={num} value={num}>Semestre {num}</option>
                            ))}
                          </select>

                          <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs text-slate-600 bg-white font-sans font-semibold cursor-pointer focus:border-emerald-500"
                          >
                            <option value="all">Sede: Todas</option>
                            {LOCATIONS.map(loc => (
                              <option key={loc} value={loc}>Sede: {loc}</option>
                            ))}
                          </select>

                          {(searchTerm !== '' || selectedSemester !== 'all' || selectedLocation !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm('');
                                setSelectedSemester('all');
                                setSelectedLocation('all');
                              }}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer font-sans"
                            >
                              Limpiar Filtros
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Main CRUD Table Container */}
                      <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3 pl-4">Sem.</th>
                              <th className="p-3">Materia & Código</th>
                              <th className="p-3">Grupo</th>
                              <th className="p-3">Horario</th>
                              <th className="p-3">Sede & Aula</th>
                              <th className="p-3">Docente</th>
                              <th className="p-3 text-center">Intensidad</th>
                              <th className="p-3 text-right pr-6">Acciones CRUD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-left">
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
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      Cód: {entry.code || 'N/A'} • {entry.activity}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold font-mono">
                                      {entry.group}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-700">{entry.day}</div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {entry.startTime} ({entry.durationHours} hrs)
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-700">{entry.room || 'Por asignar'}</div>
                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                                      Sede: {entry.location}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className="font-medium text-slate-600">{entry.teacher}</span>
                                  </td>
                                  <td className="p-3 text-center whitespace-nowrap font-mono">
                                    <div className="text-slate-700 font-bold">{entry.intensity}h</div>
                                  </td>
                                  <td className="p-3 text-right pr-6 whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      
                                      {/* Duplicate */}
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateEntry(entry)}
                                        className="p-1.5 rounded-lg border border-emerald-100 hover:border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                                        title="Duplicar materia / Crear grupo alternativo"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Edit */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(entry)}
                                        className="p-1.5 rounded-lg border border-slate-205 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-500 hover:text-indigo-700 transition-colors cursor-pointer"
                                        title="Editar materia"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Delete */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`¿Está seguro de eliminar permanentemente la materia "${entry.subject}" (${entry.group}) del profesor ${entry.teacher}?`)) {
                                            handleDeleteEntry(entry.id);
                                          }
                                        }}
                                        className="p-1.5 rounded-lg border border-rose-100 hover:border-rose-300 bg-rose-50/40 hover:bg-rose-100 text-rose-600 hover:text-rose-705 transition-colors cursor-pointer"
                                        title="Eliminar materia de la base de datos"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {tableFilteredEntries.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-12 text-center text-slate-400 italic font-sans bg-slate-50/10">
                                  No se encontraron asignaciones que coincidan con los filtros. Use el botón "Añadir Nueva Asignatura" para registrar una.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary counts */}
                      <div className="flex items-center justify-between text-xs text-slate-505 pt-1 font-mono">
                        <span>Panel de Control de Horarios</span>
                        <span className="font-bold text-slate-600">Total: {tableFilteredEntries.length} asignaturas filtradas</span>
                      </div>
                    </div>
                  )}

                  {/* 2. VIEW FOR RELATED SUBJECTS TABLE */}
                  {crudSubTab === 'subjects' && (
                    <div className="space-y-6 text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-indigo-50/60 to-blue-50/40 rounded-2xl border border-indigo-100/80">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                              <GraduationCap className="w-5 h-5" />
                            </span>
                            <div>
                              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                Catálogo de Asignaturas (Materias)
                              </h3>
                              <p className="text-xs text-slate-500 font-sans mt-0.5 font-medium">
                                Configure, modifique y elimine los detalles base de las materias del programa académico.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectToEdit(null);
                            setSubjectFormState({
                              code: '',
                              name: '',
                              intensity: 64,
                              hours_theory: 32,
                              hours_practice: 32,
                              department: 'INGENIERÍA'
                            });
                            setIsSubjectFormOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02] font-sans"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Crear Materia Base</span>
                        </button>
                      </div>

                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar asignatura por nombre o código..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none text-xs w-full focus:bg-slate-50/50 focus:border-indigo-500 font-sans font-medium transition-colors"
                        />
                      </div>

                      <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 text-slate-505 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3 pl-4">Código</th>
                              <th className="p-3">Nombre Materia</th>
                              <th className="p-3">Departamento</th>
                              <th className="p-3 text-center">Horas Totales</th>
                              <th className="p-3 text-center">H. Teoría</th>
                              <th className="p-3 text-center">H. Práctica</th>
                              <th className="p-3 text-right pr-6">Acciones CRUD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-left">
                            {subjects
                              .filter(sub => 
                                sub.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                sub.code.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .map(sub => (
                                <tr key={sub.code} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 pl-4 font-mono font-bold text-indigo-700">
                                    {sub.code}
                                  </td>
                                  <td className="p-3 font-bold text-slate-800">
                                    {sub.name}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">
                                      {sub.department}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-bold font-mono text-slate-705">
                                    {sub.intensity}h
                                  </td>
                                  <td className="p-3 text-center text-slate-600 font-mono">
                                    {sub.hours_theory}h
                                  </td>
                                  <td className="p-3 text-center text-slate-600 font-mono">
                                    {sub.hours_practice}h
                                  </td>
                                  <td className="p-3 text-right pr-6 whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubjectToEdit(sub);
                                          setSubjectFormState(sub);
                                          setIsSubjectFormOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                        title="Editar asignatura"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`¿Eliminar la asignatura "${sub.name}" (${sub.code})? Las clases programadas mantendrán los valores previos.`)) {
                                            handleDeleteSubject(sub.code);
                                          }
                                        }}
                                        className="p-1.5 rounded-lg border border-rose-100 hover:border-rose-400 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                                        title="Eliminar asignatura"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. VIEW FOR RELATED TEACHERS TAB */}
                  {crudSubTab === 'teachers' && (
                    <div className="space-y-6 text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-50/40 to-teal-50/30 rounded-2xl border border-emerald-100/60">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                              <User className="w-5 h-5" />
                            </span>
                            <div>
                              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                Registro de Docentes
                              </h3>
                              <p className="text-xs text-slate-505 font-sans mt-0.5">
                                Gestione la plantilla oficial de profesores con su respectiva adscripción departamental.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setTeacherToEdit(null);
                            setTeacherFormState({
                              name: '',
                              department: 'INGENIERÍA'
                            });
                            setIsTeacherFormOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02] font-sans"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Crear Nuevo Profesor</span>
                        </button>
                      </div>

                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre de docente..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none text-xs w-full focus:bg-slate-50/50 focus:border-emerald-500 font-sans font-medium transition-colors"
                        />
                      </div>

                      <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs max-w-2xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3 pl-4">Docente / Coordinador</th>
                              <th className="p-3">Adscripción Departamental</th>
                              <th className="p-3 text-right pr-6">Acciones CRUD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-left">
                            {teachers
                              .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(tea => (
                                <tr key={tea.name} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 pl-4 font-bold text-slate-800">
                                    {tea.name}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase font-sans">
                                      {tea.department || 'INGENIERÍA'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right pr-6 whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTeacherToEdit(tea);
                                          setTeacherFormState(tea);
                                          setIsTeacherFormOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:border-emerald-400 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                                        title="Editar departamento del docente"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      {tea.name !== 'INSTITUCIONAL' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`¿Eliminar al docente "${tea.name}" del catálogo?`)) {
                                              handleDeleteTeacher(tea.name);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg border border-rose-100 hover:border-rose-400 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Eliminar docente"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4. VIEW FOR RELATED CLASSROOMS TAB */}
                  {crudSubTab === 'classrooms' && (
                    <div className="space-y-6 text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-slate-700 text-white shadow-xs">
                              <Home className="w-5 h-5" />
                            </span>
                            <div>
                              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                CRUD • Catálogo de Aulas Físicas
                              </h3>
                              <p className="text-xs text-slate-500 font-sans mt-0.5">
                                Ajuste los salones y laboratorios de aprendizaje disponibles vinculándolos a sedes específicas.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setClassroomToEdit(null);
                            setClassroomFormState({
                              name: '',
                              location: 'RN'
                            });
                            setIsClassroomFormOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02] font-sans"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Crear Aula Física</span>
                        </button>
                      </div>

                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar aula..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none text-xs w-full focus:bg-slate-50/50 focus:border-slate-500 font-sans font-medium transition-colors"
                        />
                      </div>

                      <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs max-w-md text-left">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 text-slate-505 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3 pl-4">Salón / Aula</th>
                              <th className="p-3">Sede Académica</th>
                              <th className="p-3 text-right pr-6">Acciones CRUD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {classrooms
                              .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(rm => (
                                <tr key={rm.name} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 pl-4 font-bold text-slate-800 font-mono">
                                    {rm.name}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-mono font-bold font-sans">
                                      {rm.location}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right pr-6 whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setClassroomToEdit(rm);
                                          setClassroomFormState(rm);
                                          setIsClassroomFormOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-150 hover:border-slate-400 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                                        title="Editar sede del aula"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      {rm.name !== 'Por asignar' && rm.name !== 'Institucional' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`¿Eliminar el aula "${rm.name}"?`)) {
                                              handleDeleteClassroom(rm.name);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg border border-rose-100 hover:border-rose-450 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Eliminar aula"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

        </div>

        {/* Section: Diagnóstico & Consistencia Académica (Integrated bottom workspace) */}
        {showDiagnostics && (
          <div className="mt-8 pt-8 border-t border-slate-200/80 space-y-6 no-print animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-650">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-slate-800 font-sans">Panel de Diagnóstico & Consistencia Integrado</h3>
                <p className="text-xs text-slate-500 font-sans">Análisis automático de solapamientos, cruces de aulas, carga curricular docente y consistencia de jornadas para el periodo 2026-II</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8">
                <ConflictAlerts
                  conflicts={conflicts}
                  entries={entries}
                  onSelectClassToEdit={handleOpenEdit}
                />
              </div>
              
              <div className="lg:col-span-4">
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
          </div>
        )}

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
        subjects={subjects}
        teachers={teachers}
        classrooms={classrooms}
      />

      {/* 6. Relational Subjects Form Modal */}
      {isSubjectFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs font-sans p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 text-left animate-fadeIn">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                {subjectToEdit ? 'Editar Asignatura Base' : 'Añadir Nueva Asignatura Base'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsSubjectFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Código de Materia *</label>
                <input
                  type="text"
                  required
                  disabled={!!subjectToEdit}
                  value={subjectFormState.code}
                  onChange={e => setSubjectFormState(prev => ({ ...prev, code: e.target.value.trim() }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:bg-slate-50/50 outline-none font-mono"
                  placeholder="E.g., 3192"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre de Asignatura *</label>
                <input
                  type="text"
                  required
                  value={subjectFormState.name}
                  onChange={e => setSubjectFormState(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:bg-slate-50/50 outline-none"
                  placeholder="E.g., SISTEMAS DIGITALES"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas Totales</label>
                  <input
                    type="number"
                    value={subjectFormState.intensity || 0}
                    onChange={e => setSubjectFormState(prev => ({ ...prev, intensity: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none font-mono text-center"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas Teoría</label>
                  <input
                    type="number"
                    value={subjectFormState.hours_theory || 0}
                    onChange={e => setSubjectFormState(prev => ({ ...prev, hours_theory: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none font-mono text-center"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas Práctica</label>
                  <input
                    type="number"
                    value={subjectFormState.hours_practice || 0}
                    onChange={e => setSubjectFormState(prev => ({ ...prev, hours_practice: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none font-mono text-center"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Departamento Adscrito</label>
                <select
                  value={subjectFormState.department || 'INGENIERÍA'}
                  onChange={e => setSubjectFormState(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none cursor-pointer"
                >
                  <option value="INGENIERÍA">INGENIERÍA</option>
                  <option value="CIENCIAS BÁSICAS">CIENCIAS BÁSICAS</option>
                  <option value="ESTUDIOS SOCIALES">ESTUDIOS SOCIALES</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSubjectFormOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer font-sans"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!subjectFormState.code || !subjectFormState.name) {
                    alert('Complete todos los campos obligatorios');
                    return;
                  }
                  handleSaveSubject(subjectFormState);
                  setIsSubjectFormOpen(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer font-sans"
              >
                Guardar Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Relational Teachers Form Modal */}
      {isTeacherFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs font-sans p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 text-left animate-fadeIn">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                {teacherToEdit ? 'Editar Especialidad Docente' : 'Registrar Nuevo Docente'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsTeacherFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo del Profesor *</label>
                <input
                  type="text"
                  required
                  disabled={!!teacherToEdit}
                  value={teacherFormState.name}
                  onChange={e => setTeacherFormState(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:bg-slate-50/50 outline-none"
                  placeholder="E.g., DR. CARLOS ROBERTO"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Departamento de Adscripción</label>
                <select
                  value={teacherFormState.department || 'INGENIERÍA'}
                  onChange={e => setTeacherFormState(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none cursor-pointer"
                >
                  <option value="INGENIERÍA">INGENIERÍA</option>
                  <option value="CIENCIAS BÁSICAS">CIENCIAS BÁSICAS</option>
                  <option value="ESTUDIOS SOCIALES">ESTUDIOS SOCIALES</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTeacherFormOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!teacherFormState.name) {
                    alert('Complete el nombre correspondiente');
                    return;
                  }
                  handleSaveTeacher(teacherFormState);
                  setIsTeacherFormOpen(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
              >
                Guardar Docente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Relational Classroom Form Modal */}
      {isClassroomFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs font-sans p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 text-left animate-fadeIn">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                {classroomToEdit ? 'Editar Ubicación de Aula' : 'Registrar Nueva Aula Física'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsClassroomFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre o Código de Salón *</label>
                <input
                  type="text"
                  required
                  disabled={!!classroomToEdit}
                  value={classroomFormState.name}
                  onChange={e => setClassroomFormState(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-500 focus:bg-slate-50/50 outline-none font-mono"
                  placeholder="E.g., Aula 201"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sede Universitaria</label>
                <select
                  value={classroomFormState.location || 'RN'}
                  onChange={e => setClassroomFormState(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none cursor-pointer"
                >
                  <option value="RN">RN (Sede Norte)</option>
                  <option value="MHC">MHC (Sede Centro)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClassroomFormOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!classroomFormState.name) {
                    alert('Escriba el nombre del aula');
                    return;
                  }
                  handleSaveClassroom(classroomFormState);
                  setIsClassroomFormOpen(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
              >
                Guardar Aula
              </button>
            </div>
          </div>
        </div>
      )}

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
