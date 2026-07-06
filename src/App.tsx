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
  FileUp,
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
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => {
    try {
      const stored = localStorage.getItem('pca_entries');
      return stored ? JSON.parse(stored) : INITIAL_ENTRIES;
    } catch {
      return INITIAL_ENTRIES;
    }
  });
  const [subjects, setSubjects] = useState<DBSubject[]>(() => {
    try {
      const stored = localStorage.getItem('pca_subjects');
      return stored ? JSON.parse(stored) : getInitialSubjects();
    } catch {
      return getInitialSubjects();
    }
  });
  const [teachers, setTeachers] = useState<DBTeacher[]>(() => {
    try {
      const stored = localStorage.getItem('pca_teachers');
      return stored ? JSON.parse(stored) : getInitialTeachers();
    } catch {
      return getInitialTeachers();
    }
  });
  const [classrooms, setClassrooms] = useState<DBClassroom[]>(() => {
    try {
      const stored = localStorage.getItem('pca_classrooms');
      return stored ? JSON.parse(stored) : getInitialClassrooms();
    } catch {
      return getInitialClassrooms();
    }
  });

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
            try {
              localStorage.setItem('pca_subjects', JSON.stringify(cloudSubjects));
            } catch (e) {
              console.warn(e);
            }
          } else {
            const defaults = getInitialSubjects();
            setSubjects(defaults);
            try {
              localStorage.setItem('pca_subjects', JSON.stringify(defaults));
            } catch (e) {
              console.warn(e);
            }
            for (const sub of defaults) {
              await saveSupabaseSubject(sub);
            }
          }

          if (cloudClassrooms && cloudClassrooms.length > 0) {
            setClassrooms(cloudClassrooms);
            try {
              localStorage.setItem('pca_classrooms', JSON.stringify(cloudClassrooms));
            } catch (e) {
              console.warn(e);
            }
          } else {
            const defaults = getInitialClassrooms();
            setClassrooms(defaults);
            try {
              localStorage.setItem('pca_classrooms', JSON.stringify(defaults));
            } catch (e) {
              console.warn(e);
            }
            for (const cl of defaults) {
              await saveSupabaseClassroom(cl);
            }
          }

          if (cloudTeachers && cloudTeachers.length > 0) {
            setTeachers(cloudTeachers);
            try {
              localStorage.setItem('pca_teachers', JSON.stringify(cloudTeachers));
            } catch (e) {
              console.warn(e);
            }
          } else {
            const defaults = getInitialTeachers();
            setTeachers(defaults);
            try {
              localStorage.setItem('pca_teachers', JSON.stringify(defaults));
            } catch (e) {
              console.warn(e);
            }
            for (const tc of defaults) {
              await saveSupabaseTeacher(tc);
            }
          }

          if (cloudEntries !== null && cloudEntries.length > 0) {
            setEntries(cloudEntries);
            try {
              localStorage.setItem('pca_entries', JSON.stringify(cloudEntries));
            } catch (e) {
              console.warn(e);
            }
            setSupabaseMessage('✓ Sincronizado: Base de Datos Relacional de Supabase Conectada');
          } else {
            // First time load or empty in cloud: Check if user already had custom entries in localStorage
            let storedEntries: ScheduleEntry[] | null = null;
            try {
              const str = localStorage.getItem('pca_entries');
              if (str) {
                const parsed = JSON.parse(str);
                if (parsed && parsed.length > 0) {
                  storedEntries = parsed;
                }
              }
            } catch (e) {
              console.warn(e);
            }

            if (storedEntries && storedEntries.length > 0) {
              // Migrate local user entries to cloud database! Keep user adjustments intact.
              await saveAllSupabaseEntries(storedEntries);
              setEntries(storedEntries);
              setSupabaseMessage('✓ Sincronizado: Base de Datos Inicializada con tus Datos Locales');
            } else {
              // No local data either, initialize with default entries
              await saveAllSupabaseEntries(INITIAL_ENTRIES);
              setEntries(INITIAL_ENTRIES);
              try {
                localStorage.setItem('pca_entries', JSON.stringify(INITIAL_ENTRIES));
              } catch (e) {
                console.warn(e);
              }
              setSupabaseMessage('Conectado: Base de Datos Inicializada con Datos Base');
            }
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
    try {
      localStorage.setItem('pca_entries', JSON.stringify(newEntries));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

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

  const handleForceDownloadFromCloud = async () => {
    if (!isSupabaseConfigured()) {
      alert("La Base de Datos Nube (Supabase) no está configurada por variables de entorno.");
      return;
    }
    const confirmDownload = window.confirm("¿Está seguro que desea descargar todos los datos de la Nube? Esto sobreescribirá por completo todo el contenido en su pantalla y en el almacenamiento local del navegador.");
    if (!confirmDownload) return;

    setSupabaseLoading(true);
    setSupabaseMessage('Descargando datos desde la nube...');
    try {
      const [cloudEntries, cloudSubjects, cloudClassrooms, cloudTeachers] = await Promise.all([
        getSupabaseEntries(),
        getSupabaseSubjects(),
        getSupabaseClassrooms(),
        getSupabaseTeachers()
      ]);

      if (cloudEntries !== null) {
        setEntries(cloudEntries);
        localStorage.setItem('pca_entries', JSON.stringify(cloudEntries));
      }
      if (cloudSubjects !== null) {
        setSubjects(cloudSubjects);
        localStorage.setItem('pca_subjects', JSON.stringify(cloudSubjects));
      }
      if (cloudClassrooms !== null) {
        setClassrooms(cloudClassrooms);
        localStorage.setItem('pca_classrooms', JSON.stringify(cloudClassrooms));
      }
      if (cloudTeachers !== null) {
        setTeachers(cloudTeachers);
        localStorage.setItem('pca_teachers', JSON.stringify(cloudTeachers));
      }
      setSupabaseMessage('✓ Descarga Exitosa. Datos en Sincronía.');
      alert('¡Descarga Exitosa! Se recuperaron todos los datos de Supabase y el navegador se actualizó.');
    } catch (err) {
      console.error(err);
      setSupabaseMessage('⚠ Fallo en descarga');
      alert('Error de red: No se pudieron descargar los datos de la Base de Datos Nube.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleForceUploadToCloud = async () => {
    if (!isSupabaseConfigured()) {
      alert("La Base de Datos Nube (Supabase) no está configurada.");
      return;
    }
    const confirmUpload = window.confirm("¿Está seguro que desea subir su versión actual de pantalla a la Nube? Esto reemplazará TODA la base de datos de Supabase con lo que usted tiene en pantalla.");
    if (!confirmUpload) return;

    setSupabaseLoading(true);
    setSupabaseMessage('Subiendo datos locales a la nube...');
    try {
      const success = await saveAllSupabaseEntries(entries);
      if (success) {
        setSupabaseMessage('✓ Subida Exitosa. Sincronizado.');
        alert('¡Subida Exitosa! Los horarios en pantalla han sido guardados de manera persistente en la Base de Datos Nube.');
      } else {
        setSupabaseMessage('⚠ Fallo al guardar en Supabase.');
        alert('Error: No se pudo registrar la información local en la base de datos remota.');
      }
    } catch (err) {
      console.error(err);
      setSupabaseMessage('⚠ Error de red al subir');
      alert('Error de red: No se pudo establecer conexión con Supabase.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleMergeWithCloud = async () => {
    if (!isSupabaseConfigured()) {
      alert("Supabase no está configurado.");
      return;
    }
    setSupabaseLoading(true);
    setSupabaseMessage('Iniciando fusión inteligente...');
    try {
      const [cloudEntries, cloudSubjects, cloudClassrooms, cloudTeachers] = await Promise.all([
        getSupabaseEntries(),
        getSupabaseSubjects(),
        getSupabaseClassrooms(),
        getSupabaseTeachers()
      ]);

      // 1. Merge entries by ID
      const mergedEntriesMap = new Map<string, ScheduleEntry>();
      if (cloudEntries) {
        cloudEntries.forEach(e => mergedEntriesMap.set(e.id, e));
      }
      entries.forEach(e => {
        mergedEntriesMap.set(e.id, e);
      });
      const mergedEntries = Array.from(mergedEntriesMap.values());

      // 2. Merge subjects by code
      const mergedSubjectsMap = new Map<string, DBSubject>();
      if (cloudSubjects) {
        cloudSubjects.forEach(s => mergedSubjectsMap.set(s.code, s));
      }
      subjects.forEach(s => mergedSubjectsMap.set(s.code, s));
      const mergedSubjects = Array.from(mergedSubjectsMap.values());

      // 3. Merge classrooms by name
      const mergedClassroomsMap = new Map<string, DBClassroom>();
      if (cloudClassrooms) {
        cloudClassrooms.forEach(c => {
          if (c.name) mergedClassroomsMap.set(c.name, c);
        });
      }
      classrooms.forEach(c => {
        if (c.name) mergedClassroomsMap.set(c.name, c);
      });
      const mergedClassrooms = Array.from(mergedClassroomsMap.values());

      // 4. Merge teachers by name
      const mergedTeachersMap = new Map<string, DBTeacher>();
      if (cloudTeachers) {
        cloudTeachers.forEach(t => {
          if (t.name) mergedTeachersMap.set(t.name, t);
        });
      }
      teachers.forEach(t => {
        if (t.name) mergedTeachersMap.set(t.name, t);
      });
      const mergedTeachers = Array.from(mergedTeachersMap.values());

      // Update local states
      setEntries(mergedEntries);
      setSubjects(mergedSubjects);
      setClassrooms(mergedClassrooms);
      setTeachers(mergedTeachers);

      // Save to localStorage
      try {
        localStorage.setItem('pca_entries', JSON.stringify(mergedEntries));
        localStorage.setItem('pca_subjects', JSON.stringify(mergedSubjects));
        localStorage.setItem('pca_classrooms', JSON.stringify(mergedClassrooms));
        localStorage.setItem('pca_teachers', JSON.stringify(mergedTeachers));
      } catch (e) {
        console.warn(e);
      }

      // Save merged state to cloud
      await saveAllSupabaseEntries(mergedEntries);

      setSupabaseMessage('✓ Datos Fusionados y Sincronizados');
      alert('¡Fusión Completada con Éxito! Se combinaron todos los registros locales y remotos para evitar cualquier pérdida de planificación.');
    } catch (err) {
      console.error(err);
      setSupabaseMessage('⚠ Fallo en fusión');
      alert('Error de sincronización durante la fusión de datos.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleClearLocalStorage = () => {
    const confirmClear = window.confirm("¿Está seguro de querer borrar la caché local de este navegador? Esto borrará solo la memoria temporal de esta computadora y forzará la recarga limpia de lo que está guardado en Supabase. No perderá los datos que ya estén ingresados en la nube.");
    if (!confirmClear) return;

    try {
      localStorage.removeItem('pca_entries');
      localStorage.removeItem('pca_subjects');
      localStorage.removeItem('pca_classrooms');
      localStorage.removeItem('pca_teachers');
      
      setSupabaseMessage('✓ Caché Local Purga. Reiniciando...');
      alert('La memoria temporal ha sido purgada. La aplicación se recargará para descargar la versión original de la nube.');
      window.location.reload();
    } catch (e) {
      console.error(e);
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
    try {
      localStorage.setItem('pca_subjects', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    try {
      localStorage.setItem('pca_subjects', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    try {
      localStorage.setItem('pca_teachers', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    try {
      localStorage.setItem('pca_teachers', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    try {
      localStorage.setItem('pca_classrooms', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    try {
      localStorage.setItem('pca_classrooms', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

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
    // Helper to calculate end time
    const getEndTimeString = (startTimeStr: string, durationHrs: number): string => {
      if (!startTimeStr) return '';
      const [hStr, mStr] = startTimeStr.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h) || isNaN(m)) return '';
      const totalMins = h * 60 + m + Math.round(durationHrs * 60);
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    };

    // Exact column headers requested by user
    const headers = [
      'AsignaciónFija',
      'Semestre',
      'Codigo (#####-G##)',
      'Asignatura',
      'Intensidad horaria',
      'Actividad',
      'DiaPropuesto',
      'Grupo',
      'HoraInicio Propuesta',
      'Sede',
      'Requerimiento Aula',
      'DocentePropuesto',
      'Dependencia',
      'Horas Teoria',
      'Horas Practica',
      'Cap de Estudiantes',
      'Proyección Matricula 2026-02',
      'HoraFinPropuesta',
      'DominioUso',
      'NumDia'
    ];
    
    const rows = entries.map(e => {
      // NumDia calculation: Lunes = 1, Martes = 2, Miércoles = 3, Jueves = 4, Viernes = 5, Sábado = 6
      let numDia = '#N/A';
      if (e.day) {
        const d = e.day.trim().toLowerCase();
        if (d.startsWith('lun')) numDia = '1';
        else if (d.startsWith('mar')) numDia = '2';
        else if (d.startsWith('mie') || d.startsWith('mié')) numDia = '3';
        else if (d.startsWith('jue')) numDia = '4';
        else if (d.startsWith('vie')) numDia = '5';
        else if (d.startsWith('sab') || d.startsWith('sáb')) numDia = '6';
      }

      const endTime = getEndTimeString(e.startTime, e.durationHours);
      const timeRangeStr = e.startTime ? `${e.startTime} - ${endTime}` : '';
      const activityType = e.activity || 'Teoría';
      const dominioUso = activityType.toLowerCase().includes('práctica') ? 'Práctica' : 'Teoria';

      return [
        '', // AsignaciónFija
        e.semester, // Semestre
        e.code || '', // Codigo
        e.subject || '', // Asignatura
        e.intensity || 0, // Intensidad horaria
        activityType, // Actividad
        e.day === 'Por asignar' ? '' : e.day, // DiaPropuesto
        e.group || '', // Grupo
        timeRangeStr, // HoraInicio Propuesta
        e.location === 'Por asignar' ? '' : e.location, // Sede
        e.room === 'Por asignar' ? '' : e.room, // Requerimiento Aula
        e.teacher === 'Por asignar' ? 'INSTITUCIONAL' : e.teacher, // DocentePropuesto
        e.department || 'INGENIERÍA', // Dependencia
        e.hoursTheory || 0, // Horas Teoria
        e.hoursPractice || 0, // Horas Practica
        50, // Cap de Estudiantes
        e.projection || 0, // Proyección Matricula 2026-02
        '', // HoraFinPropuesta
        dominioUso, // DominioUso
        numDia // NumDia
      ];
    });

    const formatRow = (row: any[]) => {
      return row.map(val => {
        const str = String(val === null || val === undefined ? '' : val);
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(';');
    };

    // Add Unicode BOM (\uFEFF) to make Excel parse Spanish accents as UTF-8 immediately
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(formatRow)].join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', 'programacion_academica.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const normalizeDay = (dayStr: string): string => {
    if (!dayStr) return 'Por asignar';
    const cleaned = dayStr.trim().toLowerCase();
    if (cleaned.startsWith('lun')) return 'Lunes';
    if (cleaned.startsWith('mar')) return 'Martes';
    if (cleaned.startsWith('mie') || cleaned.startsWith('mié')) return 'Miércoles';
    if (cleaned.startsWith('jue')) return 'Jueves';
    if (cleaned.startsWith('vie')) return 'Viernes';
    if (cleaned.startsWith('sab') || cleaned.startsWith('sáb')) return 'Sábado';
    return 'Por asignar';
  };

  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          alert('El archivo cargado está vacío o no tiene el formato correcto.');
          return;
        }

        const parsedEntries: ScheduleEntry[] = [];
        let skippedRowsCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseCSVRow(line);
          if (cols.length < 12) {
            skippedRowsCount++;
            continue;
          }

          const semester = parseInt(cols[1], 10) || 1;
          const code = cols[2] || '';
          const subject = cols[3] || '';
          
          if (!subject) {
            skippedRowsCount++;
            continue;
          }

          const intensity = parseInt(cols[4], 10) || 32;
          const activity = cols[5] || 'Teoría';
          const day = normalizeDay(cols[6]);
          const group = cols[7] || 'G1';
          const timeRange = cols[8] || '';
          const location = cols[9] || 'RN';
          const room = cols[10] || 'Por asignar';
          const teacher = cols[11] || 'INSTITUCIONAL';
          const department = cols[12] || 'INGENIERÍA';
          const hoursTheory = parseInt(cols[13], 10) || 0;
          const hoursPractice = parseInt(cols[14], 10) || 0;
          const projection = parseInt(cols[16], 10) || parseInt(cols[15], 10) || 50;

          let startTime = '08:00';
          let durationHours = 2;

          if (timeRange && timeRange.includes('-')) {
            const parts = timeRange.split('-');
            if (parts.length === 2) {
              const startStr = parts[0].trim();
              const endStr = parts[1].trim();
              
              const startMatch = startStr.match(/^(\d{1,2}):(\d{2})$/);
              const endMatch = endStr.match(/^(\d{1,2}):(\d{2})$/);
              if (startMatch && endMatch) {
                startTime = `${startMatch[1].padStart(2, '0')}:${startMatch[2]}`;
                const startMins = parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10);
                const endMins = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);
                if (endMins > startMins) {
                  durationHours = (endMins - startMins) / 60;
                }
              }
            }
          } else if (timeRange && timeRange.trim()) {
            const startMatch = timeRange.trim().match(/^(\d{1,2}):(\d{2})$/);
            if (startMatch) {
              startTime = `${startMatch[1].padStart(2, '0')}:${startMatch[2]}`;
            }
          } else {
            startTime = '';
            durationHours = 2;
          }

          const entryId = `imported-${semester}-${code}-${group}-${activity.split(' ')[0].replace(/[^a-zA-Z]/g, '')}-${i}`;

          parsedEntries.push({
            id: entryId,
            semester,
            code,
            subject,
            intensity,
            activity,
            group,
            day,
            startTime,
            durationHours,
            location: location || 'RN',
            room: room || 'Por asignar',
            teacher: teacher || 'INSTITUCIONAL',
            department: department || 'INGENIERÍA',
            hoursTheory,
            hoursPractice,
            projection
          });
        }

        if (parsedEntries.length === 0) {
          alert('No se encontraron registros de programación válidos en el archivo.');
          return;
        }

        const confirmMessage = `¿Desea cargar ${parsedEntries.length} registros desde el archivo CSV?\nEsto sobreescribirá la programación actual y sincronizará en la base de datos (Supabase/Local).${skippedRowsCount > 0 ? `\n\nSe omitieron ${skippedRowsCount} filas incompletas.` : ''}`;
        
        if (!window.confirm(confirmMessage)) {
          return;
        }

        setSupabaseLoading(true);
        setSupabaseMessage('Procesando e importando datos...');

        const importedSubjectsMap = new Map<string, DBSubject>();
        const importedTeachersMap = new Map<string, DBTeacher>();
        const importedClassroomsMap = new Map<string, DBClassroom>();

        parsedEntries.forEach(item => {
          if (item.code && item.subject) {
            importedSubjectsMap.set(item.code, {
              code: item.code,
              name: item.subject,
              intensity: item.intensity,
              hours_theory: item.hoursTheory,
              hours_practice: item.hoursPractice,
              department: item.department
            });
          }
          if (item.teacher && item.teacher !== 'INSTITUCIONAL' && item.teacher !== 'Por asignar') {
            importedTeachersMap.set(item.teacher.toLowerCase(), {
              name: item.teacher,
              department: item.department
            });
          }
          if (item.room && item.room !== 'Por asignar' && item.room !== 'Institucional') {
            importedClassroomsMap.set(item.room.toLowerCase(), {
              name: item.room,
              location: item.location
            });
          }
        });

        const mergedSubjectsMap = new Map<string, DBSubject>();
        subjects.forEach(s => mergedSubjectsMap.set(s.code, s));
        importedSubjectsMap.forEach((s, code) => mergedSubjectsMap.set(code, s));
        const finalSubjects = Array.from(mergedSubjectsMap.values());

        const mergedTeachersMap = new Map<string, DBTeacher>();
        teachers.forEach(t => mergedTeachersMap.set(t.name.toLowerCase(), t));
        importedTeachersMap.forEach((t, nameLower) => mergedTeachersMap.set(nameLower, t));
        const finalTeachers = Array.from(mergedTeachersMap.values());

        const mergedClassroomsMap = new Map<string, DBClassroom>();
        classrooms.forEach(c => mergedClassroomsMap.set(c.name.toLowerCase(), c));
        importedClassroomsMap.forEach((c, nameLower) => mergedClassroomsMap.set(nameLower, c));
        const finalClassrooms = Array.from(mergedClassroomsMap.values());

        setSubjects(finalSubjects);
        setTeachers(finalTeachers);
        setClassrooms(finalClassrooms);

        try {
          localStorage.setItem('pca_subjects', JSON.stringify(finalSubjects));
          localStorage.setItem('pca_teachers', JSON.stringify(finalTeachers));
          localStorage.setItem('pca_classrooms', JSON.stringify(finalClassrooms));
        } catch (err) {
          console.warn(err);
        }

        await saveEntries(parsedEntries);

        setSupabaseMessage('✓ Importación y Sincronización Exitosa');
        alert(`¡Importación completada con éxito!\nSe cargaron:\n- ${parsedEntries.length} Clases programadas\n- ${importedSubjectsMap.size} Asignaturas\n- ${importedTeachersMap.size} Docentes\n- ${importedClassroomsMap.size} Aulas`);
        
        if (uploadInputRef.current) {
          uploadInputRef.current.value = '';
        }
      } catch (err) {
        console.error('Error parsing uploaded file:', err);
        setSupabaseMessage('⚠ Error en carga de archivo');
        alert('Error al procesar el archivo. Verifique que sea un archivo de texto separado por punto y coma (;) con codificación UTF-8.');
      } finally {
        setSupabaseLoading(false);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleAutoResolveConflicts = () => {
    try {
      const resolved = autoResolveConflicts(entries);
      saveEntries(resolved);
      alert('¡Resolución de conflictos general completada exitosamente! Se han reorganizado todas las franjas horarias respetando las restricciones de semestres (1-5 de mañana/tarde, y de 6-9 de noche) y previniendo cruces de aulas, docentes o semestres.');
    } catch (error) {
      alert('Error de procesamiento al intentar resolver automáticamente.');
    }
  };

  const handleAutoResolveConflictsBySemester = (semester: number) => {
    try {
      const resolved = autoResolveConflicts(entries, semester);
      saveEntries(resolved);
      alert(`¡Reorganización del Semestre ${semester} completada con éxito! Se han recalculado sus franjas horarias congelando los demás semestres para evitar cualquier cruce.`);
    } catch (error) {
      alert(`Error de procesamiento al intentar resolver automáticamente el Semestre ${semester}.`);
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

            {/* Hidden Input for CSV Upload */}
            <input
              type="file"
              ref={uploadInputRef}
              onChange={handleImportFromCSV}
              accept=".csv,.txt"
              className="hidden animate-none"
            />

            {/* CSV Import */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200 shadow-xs"
              title="Subir archivo de planilla de horarios en formato de texto separado por punto y coma (;) para alimentar la programación"
            >
              <FileUp className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>Importar de Excel (.csv)</span>
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportToCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition-all cursor-pointer border border-slate-200 shadow-xs"
              title="Descargar planilla de horarios finales en formato de hoja de cálculo compatible con Excel y Sheets"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
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
                                   <div className="flex items-center gap-1.5 bg-amber-50/65 border border-amber-200/55 rounded-lg p-1 text-left no-print">
                    <select
                      id="opt-reprogram-select"
                      className="bg-transparent border-none text-[11px] font-bold text-amber-900 outline-none pr-1.5 cursor-pointer font-sans"
                      defaultValue="all"
                    >
                      <option value="all">Programación General</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(sem => (
                        <option key={sem} value={sem.toString()}>Semestre {sem}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const sel = document.getElementById('opt-reprogram-select') as HTMLSelectElement;
                        const val = sel ? sel.value : 'all';
                        if (val === 'all') {
                          handleAutoResolveConflicts();
                        } else {
                          handleAutoResolveConflictsBySemester(parseInt(val, 10));
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-md shadow-xs transition-all cursor-pointer whitespace-nowrap"
                      title="Reprogramar automáticamente el espectro seleccionado sin alterar otros"
                    >
                      <Sparkles className="w-3 h-3 shrink-0 animate-pulse text-amber-100" />
                      <span>Reorganizar</span>
                    </button>
                  </div>
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
                  classrooms={classrooms}
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
                  
                  {/* CENTRAL DE CONTROL DE PERSISTENCIA Y SINCRONIZACIÓN NUBE */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Database className="w-5 h-5 text-indigo-600" />
                          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                            Centro de Sincronización & Persistencia de Horarios
                          </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Consulte y controle dónde se guardan sus datos en tiempo real. Puede forzar la carga, subida o fusionar datos entre este dispositivo y la base de datos centralizada de Supabase.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold leading-none border ${
                          isSupabaseActive 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isSupabaseActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                          {isSupabaseActive ? 'Supabase Nube Sincronizado' : 'Solo Almacenamiento Local (LocalStorage)'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="space-y-1">
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Estado de Conexión</span>
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          {isSupabaseActive ? '✓ Conexión Activa' : '⚠ Desconectado (Modo Offline)'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Registros en Pantalla (Navegador)</span>
                        <span className="text-xs font-bold text-slate-700">
                          {entries.length} clases, {subjects.length} asignaturas, {teachers.length} docentes
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Canal de Sincronización</span>
                        <span className="text-xs font-bold text-indigo-600">
                          {isSupabaseActive ? 'Supabase PostgreSQL Client' : 'Caché Web Local'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Salud de Sincronización</span>
                        <span className="text-xs font-semibold text-slate-600">
                          {supabaseMessage}
                        </span>
                      </div>
                    </div>

                    {isSupabaseActive ? (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={handleForceDownloadFromCloud}
                          disabled={supabaseLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 cursor-pointer transition-all"
                          title="Descargar la planificación guardada en Supabase y sobreescribir la memoria de tu navegador"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Bajar de la Nube</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleForceUploadToCloud}
                          disabled={supabaseLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 cursor-pointer transition-all"
                          title="Subir la planificación actual de tu navegador y sobreescribir la base de datos de Supabase"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir a la Nube</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleMergeWithCloud}
                          disabled={supabaseLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100 cursor-pointer transition-all"
                          title="Combinar de forma inteligente los horarios de tu navegador con los de Supabase"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Fusionar Datos (Sincronización Inteligente)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleClearLocalStorage}
                          disabled={supabaseLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-100 cursor-pointer transition-all ml-auto"
                          title="Borrar la memoria temporal de este navegador para recargar fresco desde Supabase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Limpiar Almacenamiento Local (Reset)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 text-xs text-amber-800">
                        <p className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          ¿Por qué estoy usando la versión local?
                        </p>
                        <p className="mt-1 font-sans text-slate-600 leading-normal">
                          La base de datos de Supabase no ha sido configurada en este entorno, por lo que la aplicación está funcionando con almacenamiento local aislado en su navegador. Para activar la base de datos compartida y persistente, asegurese de añadir <code className="bg-white/80 px-1 py-0.5 rounded text-amber-900 border border-amber-100 font-mono text-[10px]">VITE_SUPABASE_URL</code> y <code className="bg-white/80 px-1 py-0.5 rounded text-amber-900 border border-amber-100 font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code> en las Variables de Entorno (Secrets) desde AI Studio y compilar de nuevo.
                        </p>
                      </div>
                    )}

                    {/* CSV IMPORT/EXPORT SECTION */}
                    <div className="bg-indigo-50/20 border border-indigo-100 rounded-xl p-4 mt-3 text-left space-y-3">
                      <div className="flex items-center gap-2">
                        <FileUp className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                          Carga y Descarga Masiva (CSV Excel)
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                        Cargue un archivo CSV estructurado (delimitado por punto y coma, UTF-8) para alimentar instantáneamente la programación y las tablas relacionales de asignaturas, docentes y aulas, o descargue la programación actual en el formato oficial.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => uploadInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                          title="Seleccionar archivo CSV para subir al sistema"
                        >
                          <FileUp className="w-3.5 h-3.5 shrink-0" />
                          <span>Subir Horarios (.csv)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportToCSV}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer transition-colors"
                          title="Descargar la programación actual en formato oficial CSV"
                        >
                          <FileDown className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span>Descargar Horarios (.csv)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
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
                                    <div>{sub.name}</div>
                                    <div className="flex items-center gap-1.5 mt-1 font-sans">
                                      <span className="text-[9px] text-slate-450 uppercase font-extrabold tracking-wider shrink-0">Grupos programados:</span>
                                      {(() => {
                                        const matchingEntries = entries.filter(e => e.code === sub.code);
                                        const activeGroups = Array.from(new Set(matchingEntries.map(e => e.group).filter(Boolean)));
                                        if (activeGroups.length > 0) {
                                          return (
                                            <div className="flex flex-wrap gap-1">
                                              {activeGroups.sort().map(grp => (
                                                <span key={grp} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-mono font-extrabold">
                                                  {grp}
                                                </span>
                                              ))}
                                            </div>
                                          );
                                        }
                                        return <span className="text-[9px] text-slate-400 italic font-medium">Ninguno activo aún</span>;
                                      })()}
                                    </div>
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
                    <li className="flex items-center justify-between p-1.5 bg-sky-50/50 rounded-lg border border-sky-100/40">
                      <span className="font-bold text-sky-800">1. Jornada Mañana:</span>
                      <span className="font-mono text-[11px] font-semibold">7:00 AM - 1:15 PM</span>
                    </li>
                    <li className="flex items-center justify-between p-1.5 bg-amber-50/50 rounded-lg border border-amber-100/40">
                      <span className="font-bold text-amber-800">2. Jornada Tarde:</span>
                      <span className="font-mono text-[11px] font-semibold">2:00 PM - 5:00 PM</span>
                    </li>
                    <li className="flex items-center justify-between p-1.5 bg-indigo-50/55 rounded-lg border border-indigo-100/40">
                      <span className="font-bold text-indigo-805">3. Jornada Nocturna:</span>
                      <span className="font-mono text-[11px] font-semibold">6:00 PM - 9:45 PM</span>
                    </li>
                  </ul>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-[11px] text-emerald-805 space-y-1.5 leading-snug">
                    <div>
                      <strong className="text-emerald-900">🎓 Semestres 1 y 2:</strong> Programados estrictamente en la <strong>Mañana</strong> por el algoritmo automático. Se permiten pocas excepciones manuales en la <strong>Tarde</strong> (marcada como advertencia).
                    </div>
                    <div className="border-t border-emerald-200/50 pt-1.5">
                      <strong className="text-emerald-900">🌙 Semestres 6 a 9 (Nocturnos):</strong> Programados estrictamente en la <strong>Noche</strong> por el algoritmo automático. Se permite excepcionalmente moverlos a la <strong>Tarde</strong> de manera manual (marcada como advertencia).
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-150 leading-snug">
                    <strong>Nota Sincronizada:</strong> Los cursos importados originalmente de la tabla PDF que inician a las <code className="bg-slate-200 px-1 rounded font-mono text-slate-705">06:00 AM</code> generarán advertencias, invitándole a resolverlas moviéndolas a bloques que comiencen a las <code className="bg-indigo-100/50 px-1 text-indigo-800 rounded font-mono font-bold">07:00 AM</code>.
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
