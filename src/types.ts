export interface ScheduleEntry {
  id: string; // unique identifier
  semester: number; // 1 to 9
  code: string; // e.g., "1944"
  subject: string; // e.g., "VIDA UNIVERSITARIA I"
  intensity: number; // intensity in hours
  activity: string; // "Teoría", "Práctica", "Teoría - Práctica"
  group: string; // e.g., "G11", "G15", "G1", "SG"
  day: string; // "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
  startTime: string; // "HH:MM", e.g., "08:00", "14:00", "20:00"
  durationHours: number; // duration of this session, defaults to 2 hours
  location: string; // Sede: "MHC", "RN", "institucional", etc.
  room: string; // Aula: "QuantumX", "Matrix", "Horizons", etc.
  teacher: string; // Docente: e.g., "JAIRO ACOSTA SOLANO"
  department: string; // Dependencia
  hoursTheory: number;
  hoursPractice: number;
  projection: number; // Proyección matrícula
  observation?: string; // Observation notes
}

export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'all';

export interface ScheduleConflict {
  type: 'TEACHER' | 'ROOM' | 'GROUP' | 'OUT_OF_SHIFT' | 'GAP';
  message: string;
  involvedIds: string[];
  severity: 'error' | 'warning';
}
