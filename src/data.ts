import { ScheduleEntry, ScheduleConflict } from './types';

// Standard constant options
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const DEPARTMENTS = ['INGENIERÍA', 'INSTITUCIONAL'];

export const LOCATIONS = ['MHC', 'RN', 'institucional'];

export const CLASSROOMS = [
  'QuantumX',
  'QuantumBeta',
  'QuantumAlpha',
  'Matrix',
  'Horizons',
  'Sala ocasional',
  'Institucional',
  'Por asignar'
];

export const SHIFTS = {
  morning: { name: 'Mañana', start: '07:00', end: '13:15', label: '7:00 AM - 1:15 PM' },
  afternoon: { name: 'Tarde', start: '14:00', end: '17:00', label: '2:00 PM - 5:00 PM' },
  evening: { name: 'Nocturna', start: '18:00', end: '21:45', label: '6:00 PM - 9:45 PM' }
};

// Helper to convert "HH:MM" to minutes from midnight
export function timeToMinutes(timeString: string): number {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

// Helper to convert minutes back to "HH:MM"
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Check if a specific time is within a shift range
export function getShiftForTime(timeString: string): 'morning' | 'afternoon' | 'evening' | 'none' {
  const mins = timeToMinutes(timeString);
  const mStart = timeToMinutes('07:00');
  const mEnd = timeToMinutes('13:15');
  const aStart = timeToMinutes('14:00');
  const aEnd = timeToMinutes('17:00');
  const eStart = timeToMinutes('18:00');
  const eEnd = timeToMinutes('21:45');

  if (mins >= mStart && mins <= mEnd) return 'morning';
  if (mins >= aStart && mins <= aEnd) return 'afternoon';
  if (mins >= eStart && mins <= eEnd) return 'evening';
  return 'none';
}

// Detection of conflicts
export function detectConflicts(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  
  // 1. Shift range & Semester Journey Restrictions
  entries.forEach(entry => {
    const mins = timeToMinutes(entry.startTime);
    const shift = getShiftForTime(entry.startTime);
    
    if (shift === 'none') {
      conflicts.push({
        type: 'OUT_OF_SHIFT',
        message: `La clase de "${entry.subject}" (${entry.startTime}) inicia fuera de los rangos oficiales de jornadas.`,
        involvedIds: [entry.id],
        severity: 'warning'
      });
    } else {
      // Check if it ends after the shift ends
      const endMins = mins + (entry.durationHours * 60);
      let limitMins = 0;
      let limitStr = '';
      if (shift === 'morning') { limitMins = timeToMinutes('13:15'); limitStr = '1:15 PM'; }
      else if (shift === 'afternoon') { limitMins = timeToMinutes('17:00'); limitStr = '5:00 PM'; }
      else if (shift === 'evening') { limitMins = timeToMinutes('21:45'); limitStr = '9:45 PM'; }

      if (endMins > limitMins) {
        conflicts.push({
          type: 'OUT_OF_SHIFT',
          message: `La clase de "${entry.subject}" finaliza después del límite de la jornada ${shift === 'morning' ? 'Mañana' : shift === 'afternoon' ? 'Tarde' : 'Nocturna'} (${limitStr}).`,
          involvedIds: [entry.id],
          severity: 'warning'
        });
      }

      // Rule: Los sábados la única opción permitida de programación es en la jornada de la mañana (7:00 AM - 1:15 PM)
      if (entry.day === 'Sábado' && shift !== 'morning') {
        conflicts.push({
          type: 'OUT_OF_SHIFT',
          message: `Jornada de Sábado Incorrecta: Los sábados la única opción permitida de programación es en la jornada de la mañana (7:00 AM - 1:15 PM), pero se encuentra en ${shift === 'afternoon' ? 'Jornada Tarde' : 'Jornada Nocturna'} (${entry.startTime}).`,
          involvedIds: [entry.id],
          severity: 'error'
        });
      }

      // Rule: Los semestres 1er y 2do semestre deben programarse en la mañana.
      // Excepcionalmente se pueden programar pocas clases en la tarde (permitido solo manualmente como advertencia/warning).
      if (entry.semester === 1 || entry.semester === 2) {
        if (shift === 'afternoon') {
          conflicts.push({
            type: 'OUT_OF_SHIFT',
            message: `Jornada Excepcional (Manual): El semestre ${entry.semester} (1er y 2do) está programado en la jornada de la tarde (${entry.startTime}). Se permite solo excepcionalmente como opción de asignación manual.`,
            involvedIds: [entry.id],
            severity: 'warning'
          });
        } else if (shift === 'evening') {
          conflicts.push({
            type: 'OUT_OF_SHIFT',
            message: `Jornada Incorrecta: El semestre ${entry.semester} (1er y 2do) NO puede programarse en la jornada nocturna (${entry.startTime}).`,
            involvedIds: [entry.id],
            severity: 'error'
          });
        }
      } else if (entry.semester >= 3 && entry.semester <= 5) {
        if (shift === 'evening') {
          conflicts.push({
            type: 'OUT_OF_SHIFT',
            message: `Jornada Incorrecta: El semestre ${entry.semester} (3ro a 5to) debe programarse en la mañana o tarde, pero está en la jornada nocturna (${entry.startTime}).`,
            involvedIds: [entry.id],
            severity: 'error'
          });
        }
      } else if (entry.semester >= 6 && entry.semester <= 9) {
        if (shift === 'morning' || shift === 'afternoon') {
          conflicts.push({
            type: 'OUT_OF_SHIFT',
            message: `Jornada Incorrecta: El semestre ${entry.semester} (6to a 9no) debe programarse en la jornada nocturna, pero está en la jornada ${shift === 'morning' ? 'Mañana' : 'Tarde'} (${entry.startTime}).`,
            involvedIds: [entry.id],
            severity: 'error'
          });
        }
      }
    }
  });

  // Compare each pair for timing overlaps on the same day
  for (let i = 0; i < entries.length; i++) {
    const e1 = entries[i];
    const mins1_start = timeToMinutes(e1.startTime);
    const mins1_end = mins1_start + (e1.durationHours * 60);

    for (let j = i + 1; j < entries.length; j++) {
      const e2 = entries[j];
      
      // Only overlap if on same day
      if (e1.day !== e2.day) continue;

      const mins2_start = timeToMinutes(e2.startTime);
      const mins2_end = mins2_start + (e2.durationHours * 60);

      // Check if times overlap
      const hasOverlap = mins1_start < mins2_end && mins2_start < mins1_end;
      if (!hasOverlap) continue;

      // Conflict 2: Same Teacher (Docente duplicado)
      if (e1.teacher !== 'INSTITUCIONAL' && e1.teacher === e2.teacher) {
        conflicts.push({
          type: 'TEACHER',
          message: `Conflicto Docente: El docente "${e1.teacher}" tiene cruce de clases el ${e1.day} entre "${e1.subject}" (${e1.startTime}) y "${e2.subject}" (${e2.startTime}).`,
          involvedIds: [e1.id, e2.id],
          severity: 'error'
        });
      }

      // Conflict 3: Same Room (Aula duplicada)
      if (e1.room && e1.room !== 'Institucional' && e1.room !== 'Por asignar' && e1.room === e2.room) {
        conflicts.push({
          type: 'ROOM',
          message: `Conflicto Aula: El aula "${e1.room}" está ocupada simultáneamente el ${e1.day} por "${e1.subject}" (${e1.startTime}) y "${e2.subject}" (${e2.startTime}).`,
          involvedIds: [e1.id, e2.id],
          severity: 'error'
        });
      }

      // Conflict 4: Cruces de horas en el mismo semestre y grupo
      // Rule: No puede haber cruces de horas en el mismo semestre y grupo académico
      if (e1.semester === e2.semester && e1.group === e2.group && e1.group !== 'SG' && e2.group !== 'SG' && e1.teacher !== 'INSTITUCIONAL' && e2.teacher !== 'INSTITUCIONAL') {
        conflicts.push({
          type: 'GROUP',
          message: `Conflicto Semestre: El Semestre ${e1.semester} de grupo ${e1.group} tiene cruce de clases el ${e1.day} entre "${e1.subject}" (${e1.startTime}) y "${e2.subject}" (${e2.startTime}).`,
          involvedIds: [e1.id, e2.id],
          severity: 'error'
        });
      }
    }
  }

  // 5. Gaps between classes of the same semester and group on the same day
  const semesterDayEntries: Record<string, ScheduleEntry[]> = {};
  entries.forEach(entry => {
    if (entry.group === 'SG' || entry.teacher === 'INSTITUCIONAL') return;
    const key = `${entry.semester}-${entry.group}-${entry.day}`;
    if (!semesterDayEntries[key]) {
      semesterDayEntries[key] = [];
    }
    semesterDayEntries[key].push(entry);
  });

  Object.entries(semesterDayEntries).forEach(([key, dayEntries]) => {
    if (dayEntries.length <= 1) return;
    const parts = key.split('-');
    const sem = parseInt(parts[0], 10);
    const grp = parts[1];
    const sorted = [...dayEntries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    for (let k = 0; k < sorted.length - 1; k++) {
      const e1 = sorted[k];
      const e2 = sorted[k + 1];
      const end1 = timeToMinutes(e1.startTime) + (e1.durationHours * 60);
      const start2 = timeToMinutes(e2.startTime);
      const gapMins = start2 - end1;
      if (gapMins > 45) {
        conflicts.push({
          type: 'GAP',
          message: `Tiempo Libre Excesivo: Espera larga de ${gapMins} min el ${e1.day} para el Semestre ${sem} (Grupo ${grp}) entre "${e1.subject}" y "${e2.subject}".`,
          involvedIds: [e1.id, e2.id],
          severity: 'warning'
        });
      }
    }
  });

  return conflicts;
}

// Automatic scheduling resolver algorithm to clean conflicts optimally
export function autoResolveConflicts(entries: ScheduleEntry[]): ScheduleEntry[] {
  // Deep clone to prevent mutations
  const result: ScheduleEntry[] = entries.map(e => ({ ...e }));

  const lowSemesters = result.filter(e => e.semester >= 1 && e.semester <= 5);
  const highSemesters = result.filter(e => e.semester >= 6 && e.semester <= 9);
  const otherSemesters = result.filter(e => !(e.semester >= 1 && e.semester <= 9));

  const lowSolved = solveGroup(lowSemesters, [
    { shift: 'morning', maxBlocks: 8, baseHour: 7 },
    { shift: 'afternoon', maxBlocks: 4, baseHour: 14 }
  ]);

  const highSolved = solveGroup(highSemesters, [
    { shift: 'evening', maxBlocks: 5, baseHour: 18 }
  ]);

  return [...lowSolved, ...highSolved, ...otherSemesters];
}

function solveGroup(
  groupEntries: ScheduleEntry[],
  shifts: { shift: 'morning' | 'afternoon' | 'evening'; maxBlocks: number; baseHour: number }[]
): ScheduleEntry[] {
  // Sort: largest duration in blocks first
  const sorted = [...groupEntries].sort((a, b) => {
    const blocksA = Math.ceil((a.durationHours * 60) / 45);
    const blocksB = Math.ceil((b.durationHours * 60) / 45);
    return blocksB - blocksA;
  });

  const ASSIGNABLE_CLASSROOMS = ['QuantumX', 'QuantumBeta', 'QuantumAlpha', 'Matrix', 'Horizons', 'Sala ocasional', 'Institucional'];

  // Occupancy grids (mapped relative to DAYS & unified block indices in a day)
  const semesterOccupancy: Record<string, Record<string, boolean[]>> = {};
  const roomOccupancy: Record<string, Record<string, boolean[]>> = {};
  const teacherOccupancy: Record<string, Record<string, boolean[]>> = {};

  const getSemesterDayBlocks = (sem: number, group: string, day: string) => {
    const key = `${sem}-${group}`;
    if (!semesterOccupancy[key]) semesterOccupancy[key] = {};
    if (!semesterOccupancy[key][day]) semesterOccupancy[key][day] = new Array(24).fill(false);
    return semesterOccupancy[key][day];
  };

  const getRoomDayBlocks = (room: string, day: string) => {
    if (!roomOccupancy[room]) roomOccupancy[room] = {};
    if (!roomOccupancy[room][day]) roomOccupancy[room][day] = new Array(24).fill(false);
    return roomOccupancy[room][day];
  };

  const getTeacherDayBlocks = (teacher: string, day: string) => {
    if (!teacherOccupancy[teacher]) teacherOccupancy[teacher] = {};
    if (!teacherOccupancy[teacher][day]) teacherOccupancy[teacher][day] = new Array(24).fill(false);
    return teacherOccupancy[teacher][day];
  };

  const getUnifiedIndex = (shift: 'morning' | 'afternoon' | 'evening', shiftBlock: number): number => {
    if (shift === 'morning') return shiftBlock;
    if (shift === 'afternoon') return 9 + shiftBlock;
    return 14 + shiftBlock;
  };

  const isSpanFree = (
    entry: ScheduleEntry,
    day: string,
    shift: 'morning' | 'afternoon' | 'evening',
    startBlock: number,
    numBlocks: number,
    room: string
  ): boolean => {
    const semBlocks = getSemesterDayBlocks(entry.semester, entry.group, day);
    const rBlocks = getRoomDayBlocks(room, day);
    const tBlocks = entry.teacher !== 'INSTITUCIONAL' ? getTeacherDayBlocks(entry.teacher, day) : null;

    for (let i = 0; i < numBlocks; i++) {
      const unifiedIdx = getUnifiedIndex(shift, startBlock + i);
      if (entry.group !== 'SG' && entry.teacher !== 'INSTITUCIONAL' && semBlocks[unifiedIdx]) return false;
      if (room !== 'Por asignar' && rBlocks[unifiedIdx]) return false;
      if (tBlocks && tBlocks[unifiedIdx]) return false;
    }
    return true;
  };

  const setSpanOccupancy = (
    entry: ScheduleEntry,
    day: string,
    shift: 'morning' | 'afternoon' | 'evening',
    startBlock: number,
    numBlocks: number,
    room: string,
    status: boolean
  ) => {
    const semBlocks = getSemesterDayBlocks(entry.semester, entry.group, day);
    const rBlocks = getRoomDayBlocks(room, day);
    const tBlocks = entry.teacher !== 'INSTITUCIONAL' ? getTeacherDayBlocks(entry.teacher, day) : null;

    for (let i = 0; i < numBlocks; i++) {
      const unifiedIdx = getUnifiedIndex(shift, startBlock + i);
      if (entry.group !== 'SG' && entry.teacher !== 'INSTITUCIONAL') {
        semBlocks[unifiedIdx] = status;
      }
      if (room !== 'Por asignar') {
        rBlocks[unifiedIdx] = status;
      }
      if (tBlocks) {
        tBlocks[unifiedIdx] = status;
      }
    }
  };

  const getClosenessPenalty = (
    entry: ScheduleEntry,
    day: string,
    shift: 'morning' | 'afternoon' | 'evening',
    startBlock: number,
    numBlocks: number
  ): number => {
    const uStart = getUnifiedIndex(shift, startBlock);
    const uEnd = uStart + numBlocks - 1;

    const semBlocks = getSemesterDayBlocks(entry.semester, entry.group, day);
    const occupiedIndices: number[] = [];
    for (let j = 0; j < semBlocks.length; j++) {
      if (semBlocks[j]) {
        occupiedIndices.push(j);
      }
    }

    if (occupiedIndices.length === 0) {
      return startBlock * 1.0;
    }

    let minDist = 999;
    for (const j of occupiedIndices) {
      if (j < uStart) {
        minDist = Math.min(minDist, uStart - j);
      } else if (j > uEnd) {
        minDist = Math.min(minDist, j - uEnd);
      } else {
        minDist = 0;
      }
    }

    const emptyBlocksSeparating = Math.max(0, minDist - 1);
    const dayCohesionBonus = emptyBlocksSeparating <= 1 ? -5.0 : 0.0;

    return (emptyBlocksSeparating * 15) + (startBlock * 0.5) + dayCohesionBonus;
  };

  interface CandidateOption {
    day: string;
    room: string;
    shiftConfig: { shift: 'morning' | 'afternoon' | 'evening'; maxBlocks: number; baseHour: number };
    startBlock: number;
    penalty: number;
  }

  for (let idx = 0; idx < sorted.length; idx++) {
    const entry = sorted[idx];
    const numBlocks = Math.ceil((entry.durationHours * 60) / 45);

    const dayCandidates = [entry.day, ...DAYS.filter(d => d !== entry.day)];
    const originalRoomVal = entry.room || 'Por asignar';
    const roomCandidates = [
      originalRoomVal,
      ...ASSIGNABLE_CLASSROOMS.filter(r => r !== originalRoomVal && r !== 'Institucional')
    ];

    const allowedShifts = (entry.semester === 1 || entry.semester === 2)
      ? shifts.filter(s => s.shift === 'morning')
      : shifts;

    const options: CandidateOption[] = [];

    for (const day of dayCandidates) {
      for (const room of roomCandidates) {
        for (const shiftConfig of allowedShifts) {
          if (day === 'Sábado' && shiftConfig.shift !== 'morning') continue;
          if (numBlocks > shiftConfig.maxBlocks) continue;
          const maxStart = shiftConfig.maxBlocks - numBlocks;

          for (let startBlock = 0; startBlock <= maxStart; startBlock++) {
            if (isSpanFree(entry, day, shiftConfig.shift, startBlock, numBlocks, room)) {
              const penalty = getClosenessPenalty(entry, day, shiftConfig.shift, startBlock, numBlocks);
              options.push({
                day,
                room,
                shiftConfig,
                startBlock,
                penalty
              });
            }
          }
        }
      }
    }

    if (options.length > 0) {
      options.sort((a, b) => {
        if (Math.abs(a.penalty - b.penalty) > 0.01) {
          return a.penalty - b.penalty;
        }
        const aIsOriginalDay = a.day === entry.day ? 0 : 1;
        const bIsOriginalDay = b.day === entry.day ? 0 : 1;
        if (aIsOriginalDay !== bIsOriginalDay) return aIsOriginalDay - bIsOriginalDay;

        const aIsOriginalRoom = a.room === originalRoomVal ? 0 : 1;
        const bIsOriginalRoom = b.room === originalRoomVal ? 0 : 1;
        return aIsOriginalRoom - bIsOriginalRoom;
      });

      const opt = options[0];
      setSpanOccupancy(entry, opt.day, opt.shiftConfig.shift, opt.startBlock, numBlocks, opt.room, true);

      const startOffsetMinutes = opt.shiftConfig.baseHour * 60 + opt.startBlock * 45;
      const startH = Math.floor(startOffsetMinutes / 60);
      const startM = startOffsetMinutes % 60;
      const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

      entry.day = opt.day;
      entry.room = opt.room;
      entry.startTime = startTimeStr;
    } else {
      const fallbackRooms = ['Por asignar', 'Institucional'];
      const fallbackOptions: CandidateOption[] = [];

      for (const day of dayCandidates) {
        for (const room of fallbackRooms) {
          for (const shiftConfig of allowedShifts) {
            if (day === 'Sábado' && shiftConfig.shift !== 'morning') continue;
            if (numBlocks > shiftConfig.maxBlocks) continue;
            const maxStart = shiftConfig.maxBlocks - numBlocks;

            for (let startBlock = 0; startBlock <= maxStart; startBlock++) {
              if (isSpanFree(entry, day, shiftConfig.shift, startBlock, numBlocks, room)) {
                const penalty = getClosenessPenalty(entry, day, shiftConfig.shift, startBlock, numBlocks);
                fallbackOptions.push({
                  day,
                  room,
                  shiftConfig,
                  startBlock,
                  penalty
                });
              }
            }
          }
        }
      }

      if (fallbackOptions.length > 0) {
        fallbackOptions.sort((a, b) => a.penalty - b.penalty);
        const opt = fallbackOptions[0];
        setSpanOccupancy(entry, opt.day, opt.shiftConfig.shift, opt.startBlock, numBlocks, opt.room, true);

        const startOffsetMinutes = opt.shiftConfig.baseHour * 60 + opt.startBlock * 45;
        const startH = Math.floor(startOffsetMinutes / 60);
        const startM = startOffsetMinutes % 60;
        const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        entry.day = opt.day;
        entry.room = opt.room;
        entry.startTime = startTimeStr;
      } else {
        const currentShift = getShiftForTime(entry.startTime);
        if (currentShift !== 'none') {
          const shiftConf = shifts.find(s => s.shift === currentShift);
          if (shiftConf) {
            const startMins = timeToMinutes(entry.startTime);
            const baseMins = shiftConf.baseHour * 60;
            const startBlk = Math.max(0, Math.floor((startMins - baseMins) / 45));
            setSpanOccupancy(entry, entry.day, currentShift, startBlk, numBlocks, originalRoomVal, true);
          }
        }
      }
    }
  }

  return sorted;
}

// Initial records built from the PDF screens
export const INITIAL_ENTRIES: ScheduleEntry[] = [
  // --- SEMESTRE 1 ---
  {
    id: '1-1944',
    semester: 1,
    code: '1944',
    subject: 'VIDA UNIVERSITARIA I',
    intensity: 32,
    activity: 'Teoría',
    group: 'G11',
    day: 'Miércoles',
    startTime: '10:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Institucional',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 51
  },
  {
    id: '1-1222',
    semester: 1,
    code: '1222',
    subject: 'EPISTEMOLOGÍA DE LA INVESTIGACIÓN',
    intensity: 32,
    activity: 'Teoría',
    group: 'G15',
    day: 'Jueves',
    startTime: '14:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JAIRO ACOSTA SOLANO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 52
  },
  {
    id: '1-2013',
    semester: 1,
    code: '2013',
    subject: 'MATEMÁTICAS I',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '06:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 59
  },
  {
    id: '1-3197',
    semester: 1,
    code: '3197',
    subject: 'ALGEBRA LINEAL',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '08:00',
    durationHours: 2.5,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'RODOLFO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 16,
    projection: 52
  },
  {
    id: '1-2016',
    semester: 1,
    code: '2016',
    subject: 'LÓGICA Y TEORÍA DE CONJUNTOS',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Martes',
    startTime: '10:00',
    durationHours: 2.5,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 55
  },
  {
    id: '1-3198',
    semester: 1,
    code: '3198',
    subject: 'PROGRAMACIÓN I',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '14:00',
    durationHours: 3,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'RODOLFO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 52
  },
  {
    id: '1-3199-G1',
    semester: 1,
    code: '3199',
    subject: 'COMUNICACIONES Y REDES',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '06:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 27
  },
  {
    id: '1-3199-G2',
    semester: 1,
    code: '3199',
    subject: 'COMUNICACIONES Y REDES',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G2',
    day: 'Viernes',
    startTime: '08:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 27
  },
  {
    id: '1-2592-G1',
    semester: 1,
    code: '2592',
    subject: 'ELECTIVA TECNOLÓGICA I',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '10:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 25
  },
  {
    id: '1-2592-G2',
    semester: 1,
    code: '2592',
    subject: 'ELECTIVA TECNOLÓGICA I',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G2',
    day: 'Martes',
    startTime: '14:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 25
  },

  // --- SEMESTRE 2 ---
  {
    id: '2-172',
    semester: 2,
    code: '172',
    subject: 'COMPETENCIAS COMUNICATIVAS I',
    intensity: 32,
    activity: 'TeorÍa',
    group: 'G3',
    day: 'Miércoles',
    startTime: '06:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Institucional',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 42
  },
  {
    id: '2-1223',
    semester: 2,
    code: '1223',
    subject: 'METODOLOGÍA DE LA INVESTIGACIÓN',
    intensity: 32,
    activity: 'Teoría',
    group: 'G13',
    day: 'Jueves',
    startTime: '08:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JAIRO ACOSTA SOLANO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 50
  },
  {
    id: '2-2034',
    semester: 2,
    code: '2034',
    subject: 'MATEMÁTICAS II',
    intensity: 48,
    activity: 'TeorÍa',
    group: 'G1',
    day: 'Viernes',
    startTime: '10:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Sala ocasional',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 62
  },
  {
    id: '2-1611',
    semester: 2,
    code: '1611',
    subject: 'INGLÉS I',
    intensity: 32,
    activity: 'TeorÍa',
    group: 'G31',
    day: 'Lunes',
    startTime: '14:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 62
  },
  {
    id: '2-3209-T',
    semester: 2,
    code: '3209',
    subject: 'FÍSICA I (TEORÍA)',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '06:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARCELO CALVO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 56
  },
  {
    id: '2-3209-P1',
    semester: 2,
    code: '3209',
    subject: 'FÍSICA I (PRÁCTICA)',
    intensity: 16,
    activity: 'Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '08:00',
    durationHours: 1.5,
    location: 'RN',
    room: 'Horizons',
    teacher: 'MARCELO CALVO',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 16,
    projection: 28
  },
  {
    id: '2-3209-P2',
    semester: 2,
    code: '3209',
    subject: 'FÍSICA I (PRÁCTICA)',
    intensity: 16,
    activity: 'Práctica',
    group: 'G2',
    day: 'Jueves',
    startTime: '10:00',
    durationHours: 1.5,
    location: 'RN',
    room: 'Horizons',
    teacher: 'MARCELO CALVO',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 16,
    projection: 28
  },
  {
    id: '2-3210-G1',
    semester: 2,
    code: '3210',
    subject: 'PROGRAMACIÓN II',
    intensity: 64,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '14:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'YAIR CARDONA ACUÑA',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 33
  },
  {
    id: '2-3210-G2',
    semester: 2,
    code: '3210',
    subject: 'PROGRAMACIÓN II',
    intensity: 64,
    activity: 'Teoría',
    group: 'G2',
    day: 'Lunes',
    startTime: '06:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'YAIR CARDONA ACUÑA',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 33
  },
  {
    id: '2-3211',
    semester: 2,
    code: '3211',
    subject: 'ESTRUCTURA DE DATOS',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Martes',
    startTime: '08:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 16,
    projection: 50
  },

  // --- SEMESTRE 3 ---
  {
    id: '3-2036',
    semester: 3,
    code: '2036',
    subject: 'DISEÑO DE BASE DE DATOS',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '10:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 44
  },
  {
    id: '3-2103',
    semester: 3,
    code: '2103',
    subject: 'PROGRAMACIÓN III',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G2',
    day: 'Jueves',
    startTime: '14:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumBeta',
    teacher: 'YAIR CARDONA ACUÑA',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 27
  },
  {
    id: '3-88',
    semester: 3,
    code: '88',
    subject: 'ESTRUCTURA DE DATOS II',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Viernes',
    startTime: '06:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumAlpha',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 27
  },
  {
    id: '3-180',
    semester: 3,
    code: '180',
    subject: 'COMPORTAMIENTO HUMANO I',
    intensity: 32,
    activity: 'Teoría',
    group: 'G19',
    day: 'Lunes',
    startTime: '08:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARIA VICTORIA ZUMAQUE CASTILLO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '3-1248-T',
    semester: 3,
    code: '1248',
    subject: 'FÍSICA II (TEORÍA)',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '10:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 13
  },
  {
    id: '3-1248-L',
    semester: 3,
    code: '1248',
    subject: 'FÍSICA II (LABORATORIO)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '14:00',
    durationHours: 2,
    location: 'RN',
    room: 'Horizons',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 13
  },
  {
    id: '3-179',
    semester: 3,
    code: '179',
    subject: 'COMPETENCIAS COMUNICATIVAS II',
    intensity: 32,
    activity: 'Teoría',
    group: 'G24',
    day: 'Jueves',
    startTime: '06:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 35
  },
  {
    id: '3-1612',
    semester: 3,
    code: '1612',
    subject: 'INGLÉS II',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Viernes',
    startTime: '08:00',
    durationHours: 2,
    location: 'institucional',
    room: 'Institucional',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },
  {
    id: '3-N',
    semester: 3,
    code: 'N',
    subject: 'EXPERIENCIA EN EL USUARIO',
    intensity: 48,
    activity: 'Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '10:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'QuantumBeta',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 30
  },
  {
    id: '3-2102',
    semester: 3,
    code: '2102',
    subject: 'MATEMÁTICAS III',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '14:00',
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 43,
    durationHours: 3
  },

  // --- SEMESTRE 4 ---
  {
    id: '4-2110',
    semester: 4,
    code: '2110',
    subject: 'ELECTIVA TECNOLÓGICA II',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G2',
    day: 'Miércoles',
    startTime: '06:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'JAIRO ACOSTA SOLANO',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 40
  },
  {
    id: '4-3200',
    semester: 4,
    code: '3200',
    subject: 'ELECTIVA TECNOLÓGICA II',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '08:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 42
  },
  {
    id: '4-2107',
    semester: 4,
    code: '2107',
    subject: 'MATEMÁTICAS IV',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '10:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '4-1473-G1',
    semester: 4,
    code: '1473',
    subject: 'SISTEMAS OPERATIVOS I',
    intensity: 48,
    activity: 'Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '14:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 20
  },
  {
    id: '4-1473-G2',
    semester: 4,
    code: '1473',
    subject: 'SISTEMAS OPERATIVOS I',
    intensity: 48,
    activity: 'Práctica',
    group: 'G2',
    day: 'Martes',
    startTime: '06:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 22
  },
  {
    id: '4-188',
    semester: 4,
    code: '188',
    subject: 'COMPETENCIAS COMUNICATIVAS III',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Miércoles',
    startTime: '08:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 42
  },
  {
    id: '4-2104',
    semester: 4,
    code: '2104',
    subject: 'PROGRAMACIÓN DE BASES DE DATOS',
    intensity: 64,
    activity: 'Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '10:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'YAIR CARDONA ACUÑA',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 57
  },
  {
    id: '4-1641',
    semester: 4,
    code: '1641',
    subject: 'APLICACIONES WEB I',
    intensity: 64,
    activity: 'Práctica',
    group: 'G1',
    day: 'Viernes',
    startTime: '14:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 43
  },
  {
    id: '4-2017-T',
    semester: 4,
    code: '2017',
    subject: 'COMUNICACIONES Y REDES (TEORÍA)',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Lunes',
    startTime: '06:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 41
  },
  {
    id: '4-2017-P1',
    semester: 4,
    code: '2017',
    subject: 'COMUNICACIONES Y REDES (PRÁCTICA)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G1',
    day: 'Martes',
    startTime: '08:00',
    durationHours: 2,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 21
  },
  {
    id: '4-2017-P2',
    semester: 4,
    code: '2017',
    subject: 'COMUNICACIONES Y REDES (PRÁCTICA)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G2',
    day: 'Miércoles',
    startTime: '10:00',
    durationHours: 2,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 20
  },
  {
    id: '4-1613',
    semester: 4,
    code: '1613',
    subject: 'INGLÉS III',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Jueves',
    startTime: '14:00',
    durationHours: 2,
    location: 'institucional',
    room: 'Institucional',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },

  // --- SEMESTRE 5 ---
  {
    id: '5-2113',
    semester: 5,
    code: '2113',
    subject: 'ELECTIVA TECNOLÓGICA III',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Viernes',
    startTime: '06:00',
    durationHours: 2.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 31
  },
  {
    id: '5-2109',
    semester: 5,
    code: '2109',
    subject: 'ELECTRÓNICA DEL COMPUTADOR',
    intensity: 64,
    activity: 'Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '08:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'Horizons',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 31
  },
  {
    id: '5-189',
    semester: 5,
    code: '189',
    subject: 'COMPORTAMIENTO HUMANO II',
    intensity: 32,
    activity: 'Teoría',
    group: '24',
    day: 'Martes',
    startTime: '10:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },
  {
    id: '5-2111',
    semester: 5,
    code: '2111',
    subject: 'DISEÑO DE SOFTWARE',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '14:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 31
  },
  {
    id: '5-2593',
    semester: 5,
    code: '2593',
    subject: 'APLICACIONES WEB II',
    intensity: 64,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '06:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumBeta',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 23
  },
  {
    id: '5-2108',
    semester: 5,
    code: '2108',
    subject: 'PROBABILIDAD Y ESTADÍSTICA',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '08:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARCELO CALVO',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '5-1614',
    semester: 5,
    code: '1614',
    subject: 'INGLÉS IV',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Lunes',
    startTime: '10:00',
    durationHours: 2,
    location: 'institucional',
    room: 'Institucional',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },

  // --- SEMESTRE 6 ---
  {
    id: '6-93-T',
    semester: 6,
    code: '93',
    subject: 'CIRCUITOS DIGITALES (TEORÍA)',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 49
  },
  {
    id: '6-93-P1',
    semester: 6,
    code: '93',
    subject: 'CIRCUITOS DIGITALES (PRÁCTICA)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G1',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Horizons',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 25
  },
  {
    id: '6-93-P2',
    semester: 6,
    code: '93',
    subject: 'CIRCUITOS DIGITALES (PRÁCTICA)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G2',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Horizons',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 24
  },
  {
    id: '6-2475',
    semester: 6,
    code: '2475',
    subject: 'PRÁCTICA PROFESIONAL',
    intensity: 40,
    activity: 'Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARIA VICTORIA ZUMAQUE CASTILLO',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 40,
    projection: 53
  },
  {
    id: '6-1630',
    semester: 6,
    code: '1630',
    subject: 'GESTIÓN DE NEGOCIOS',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 53
  },
  {
    id: '6-2115',
    semester: 6,
    code: '2115',
    subject: 'DESARROLLO DE SOFTWARE',
    intensity: 64,
    activity: 'Práctica',
    group: 'G1',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 3.5,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'JOAQUIN SILVA ROMERO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 32,
    projection: 49
  },
  {
    id: '6-2594',
    semester: 6,
    code: '2594',
    subject: 'SOPORTE TI',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 53
  },
  {
    id: '6-1476',
    semester: 6,
    code: '1476',
    subject: 'SISTEMAS OPERATIVOS II',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'Matrix',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 33
  },

  // --- SEMESTRE 7 ---
  {
    id: '7-2472',
    semester: 7,
    code: '2472',
    subject: 'ELECTIVA PROFESIONAL I',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'JAIRO ACOSTA SOLANO',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 47
  },
  {
    id: '7-1433',
    semester: 7,
    code: '1433',
    subject: 'INTRODUCCIÓN A LA INGENIERÍA DE SOFTWARE',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MIGUEL ALBERTO CARO ÁLVAREZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 47
  },
  {
    id: '9-99-G1',
    semester: 7,
    code: '99',
    subject: 'ARQUITECTURA DEL COMPUTADOR',
    intensity: 48,
    activity: 'Práctica',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Horizons',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 23
  },
  {
    id: '9-99-G2',
    semester: 7,
    code: '99',
    subject: 'ARQUITECTURA DEL COMPUTADOR',
    intensity: 48,
    activity: 'Práctica',
    group: 'G2',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'Horizons',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 24
  },
  {
    id: '7-2018-G1',
    semester: 7,
    code: '2018',
    subject: 'ADMINISTRACIÓN DE SISTEMAS OPERATIVOS',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Matrix',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 24
  },
  {
    id: '7-2018-G2',
    semester: 7,
    code: '2018',
    subject: 'ADMINISTRACIÓN DE SISTEMAS OPERATIVOS',
    intensity: 32,
    activity: 'Teoría',
    group: 'G2',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'Matrix',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 23
  },
  {
    id: '7-1508-G1',
    semester: 7,
    code: '1508',
    subject: 'ÉNFASIS I',
    intensity: 48,
    activity: 'Práctica',
    group: 'G1',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Matrix',
    teacher: 'JOSUE RIVERA MUÑOZ',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 48,
    projection: 24
  },
  {
    id: '7-1508-G2',
    semester: 7,
    code: '1508',
    subject: 'ÉNFASIS I',
    intensity: 48,
    activity: 'Práctica',
    group: 'G2',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'Matrix',
    teacher: 'JOSUE RIVERA MUÑOZ',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 48,
    projection: 23
  },
  {
    id: '7-1474',
    semester: 7,
    code: '1474',
    subject: 'MATEMÁTICA COMPUTACIONAL',
    intensity: 64,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 64,
    hoursPractice: 0,
    projection: 50
  },
  {
    id: '7-2468',
    semester: 7,
    code: '2468',
    subject: 'GERENCIA DE PROYECTOS DE SOFTWARE',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'QuantumBeta',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 32
  },
  {
    id: '7-2471',
    semester: 7,
    code: '2471',
    subject: 'NEGOCIOS EN INTERNET',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'QuantumBeta',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 32
  },
  {
    id: '7-1615',
    semester: 7,
    code: '1615',
    subject: 'INGLÉS V',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },

  // --- SEMESTRE 8 ---
  {
    id: '8-2476',
    semester: 8,
    code: '2476',
    subject: 'AUDITORIA DE SISTEMAS',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '8-112',
    semester: 8,
    code: '112',
    subject: 'ELECTIVA PROFESIONAL II',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 38
  },
  {
    id: '8-2953',
    semester: 8,
    code: '2953',
    subject: 'LEGISLACIÓN INFORMÁTICA',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '8-95-T',
    semester: 8,
    code: '95',
    subject: 'TÉCNICAS DE PROGRAMACIÓN (TEORÍA)',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 39
  },
  {
    id: '8-95-P',
    semester: 8,
    code: '95',
    subject: 'TÉCNICAS DE PROGRAMACIÓN (PRÁCTICA)',
    intensity: 32,
    activity: 'Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'ANDERSON RODRIGUEZ',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 32,
    projection: 39
  },
  {
    id: '8-1509-T',
    semester: 8,
    code: '1509',
    subject: 'ÉNFASIS II',
    intensity: 24,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 2,
    location: 'RN',
    room: 'Matrix',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 24,
    hoursPractice: 0,
    projection: 46
  },
  {
    id: '8-1509-P1',
    semester: 8,
    code: '1509',
    subject: 'ÉNFASIS II (PRÁCTICA)',
    intensity: 24,
    activity: 'Práctica',
    group: 'G1',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Matrix',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 24,
    projection: 23
  },
  {
    id: '8-1509-P2',
    semester: 8,
    code: '1509',
    subject: 'ÉNFASIS II (PRÁCTICA)',
    intensity: 24,
    activity: 'Práctica',
    group: 'G2',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 3,
    location: 'RN',
    room: 'Matrix',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 24,
    projection: 23
  },
  {
    id: '8-1511',
    semester: 8,
    code: '1511',
    subject: 'TEORÍA DE LA COMPUTACIÓN',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'CARLOS GARZÓN MERCADO',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '8-2467',
    semester: 8,
    code: '2467',
    subject: 'TEORÍA GENERAL DE SISTEMAS',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'JORGE MANUEL BARRIOS SÁNCHEZ',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '8-1615',
    semester: 8,
    code: '1615',
    subject: 'INGLÉS VI',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },

  // --- SEMESTRE 9 ---
  {
    id: '9-2469',
    semester: 9,
    code: '2469',
    subject: 'ÉTICA PROFESIONAL',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Viernes',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARIA VICTORIA ZUMAQUE CASTILLO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 34
  },
  {
    id: '9-2954',
    semester: 9,
    code: '2954',
    subject: 'DESARROLLO SOSTENIBLE',
    intensity: 32,
    activity: 'Teoría',
    group: 'G1',
    day: 'Sábado',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'MARIA VICTORIA ZUMAQUE CASTILLO',
    department: 'INGENIERÍA',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 38
  },
  {
    id: '9-2117',
    semester: 9,
    code: '2117',
    subject: 'INVESTIGACIÓN DE OPERACIONES',
    intensity: 48,
    activity: 'Teoría',
    group: 'G1',
    day: 'Lunes',
    startTime: '18:00',
    durationHours: 3,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'UDUALDO JOSÉ HERRERA GARCÍA',
    department: 'INGENIERÍA',
    hoursTheory: 48,
    hoursPractice: 0,
    projection: 34
  },
  {
    id: '9-2474',
    semester: 9,
    code: '2474',
    subject: 'ELECTIVA PROFESIONAL III',
    intensity: 48,
    activity: 'Teoría - Práctica',
    group: 'G1',
    day: 'Martes',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'QuantumX',
    teacher: 'MAYBELLINE CASTRO PÉREZ',
    department: 'INGENIERÍA',
    hoursTheory: 16,
    hoursPractice: 32,
    projection: 37
  },
  {
    id: '9-1617',
    semester: 9,
    code: '1617',
    subject: 'INGLÉS VII',
    intensity: 32,
    activity: 'Teoría',
    group: 'SG',
    day: 'Miércoles',
    startTime: '18:00',
    durationHours: 2,
    location: 'MHC',
    room: 'Por asignar',
    teacher: 'INSTITUCIONAL',
    department: 'INSTITUCIONAL',
    hoursTheory: 32,
    hoursPractice: 0,
    projection: 0
  },
  {
    id: '9-1510',
    semester: 9,
    code: '1510',
    subject: 'ÉNFASIS III',
    intensity: 48,
    activity: 'Práctica',
    group: 'G1',
    day: 'Jueves',
    startTime: '20:00',
    durationHours: 1.75,
    location: 'RN',
    room: 'Matrix',
    teacher: 'GUSTAVO MONTERROSA',
    department: 'INGENIERÍA',
    hoursTheory: 0,
    hoursPractice: 48,
    projection: 35
  }
];
