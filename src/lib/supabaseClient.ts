import { createClient } from '@supabase/supabase-js';
import { ScheduleEntry } from '../types';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return typeof supabaseUrl === 'string' && 
         supabaseUrl !== '' && 
         (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
         typeof supabaseAnonKey === 'string' && 
         supabaseAnonKey !== '';
};

let supabaseInstance: ReturnType<typeof createClient> | null = null;
try {
  if (isSupabaseConfigured()) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) {
  console.error('Supabase initialization failed:', e);
}

export const supabase = supabaseInstance;

/**
 * Fetch all entries from relational Supabase database with joins.
 */
export async function getSupabaseEntries(): Promise<ScheduleEntry[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select(`
        id,
        semester,
        group,
        day,
        start_time,
        duration_hours,
        projection,
        observation,
        activity,
        subjects (code, name, intensity, hours_theory, hours_practice, department),
        classrooms (name, location),
        teachers (name, department)
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching from Supabase (relational model):', error);
      throw error;
    }
    
    if (data) {
      // Map database relational structure back to ScheduleEntry
      return data.map((item: any) => {
        const subject = item.subjects || {};
        const classroom = item.classrooms || {};
        const teacher = item.teachers || {};

        return {
          id: String(item.id),
          semester: Number(item.semester || 1),
          code: String(subject.code || item.subject_code || ''),
          subject: String(subject.name || ''),
          intensity: Number(subject.intensity || 2),
          activity: String(item.activity || 'Teoría'),
          group: String(item.group || 'G1'),
          day: String(item.day || 'Lunes'),
          startTime: String(item.start_time || '07:00'),
          durationHours: Number(item.duration_hours !== undefined ? item.duration_hours : 2),
          location: String(classroom.location || 'RN'),
          room: String(classroom.name || 'Por asignar'),
          teacher: String(teacher.name || 'INSTITUCIONAL'),
          department: String(subject.department || teacher.department || ''),
          hoursTheory: Number(subject.hours_theory !== undefined ? subject.hours_theory : 0),
          hoursPractice: Number(subject.hours_practice !== undefined ? subject.hours_practice : 0),
          projection: Number(item.projection || 0),
          observation: String(item.observation || '')
        };
      });
    }
    return [];
  } catch (err) {
    console.error('Failed to get Supabase entries:', err);
    return null;
  }
}

/**
 * Persist the entire relational schedule state to Supabase.
 * It inserts parent table entities (subjects, classrooms, teachers) first 
 * via upserts, then deletes old entries and batch inserts new schedule_entries 
 * linked by relational foreign key constraints.
 */
export async function saveAllSupabaseEntries(entries: ScheduleEntry[]): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Extract and map unique parent entities to secure referential integrity
    const uniqueSubjectsMap = new Map<string, any>();
    const uniqueClassroomsMap = new Map<string, any>();
    const uniqueTeachersMap = new Map<string, any>();

    entries.forEach(item => {
      // Extract subjects
      if (item.code) {
        uniqueSubjectsMap.set(item.code, {
          code: item.code,
          name: item.subject || 'Materia sin nombre',
          intensity: Number(item.intensity || 0),
          hours_theory: Number(item.hoursTheory || 0),
          hours_practice: Number(item.hoursPractice || 0),
          department: item.department || 'INGENIERÍA'
        });
      }
      
      // Extract classrooms
      const roomName = item.room || 'Por asignar';
      uniqueClassroomsMap.set(roomName, {
        name: roomName,
        location: item.location || 'RN'
      });

      // Extract teachers
      const teacherName = item.teacher || 'INSTITUCIONAL';
      uniqueTeachersMap.set(teacherName, {
        name: teacherName,
        department: item.department || ''
      });
    });

    const subjectsToUpsert = Array.from(uniqueSubjectsMap.values());
    const classroomsToUpsert = Array.from(uniqueClassroomsMap.values());
    const teachersToUpsert = Array.from(uniqueTeachersMap.values());

    // 2. Perform upserts with safe defaults & ignore conflict resolutions on primary key matches
    if (classroomsToUpsert.length > 0) {
      const { error: rErr } = await (supabase.from('classrooms') as any).upsert(classroomsToUpsert);
      if (rErr) {
        console.error('Error upserting classrooms:', rErr);
        throw rErr;
      }
    }

    if (teachersToUpsert.length > 0) {
      const { error: tErr } = await (supabase.from('teachers') as any).upsert(teachersToUpsert);
      if (tErr) {
        console.error('Error upserting teachers:', tErr);
        throw tErr;
      }
    }

    if (subjectsToUpsert.length > 0) {
      const { error: sErr } = await (supabase.from('subjects') as any).upsert(subjectsToUpsert);
      if (sErr) {
        console.error('Error upserting subjects:', sErr);
        throw sErr;
      }
    }

    // 3. Clear existing schedule entries
    const { error: deleteError } = await (supabase
      .from('schedule_entries') as any)
      .delete()
      .neq('id', 'placeholder_non_existent_id'); // deletes all rows

    if (deleteError) {
      console.error('Error cleansing schedule entries:', deleteError);
      throw deleteError;
    }

    if (entries.length === 0) return true;

    // 4. Prepare relational entries linked with parents
    const dbEntries = entries.map(item => ({
      id: item.id,
      semester: item.semester,
      subject_code: item.code || null,
      group: item.group || 'G1',
      day: item.day,
      start_time: item.startTime,
      duration_hours: item.durationHours,
      room_name: item.room || 'Por asignar',
      teacher_name: item.teacher || 'INSTITUCIONAL',
      projection: item.projection !== undefined ? item.projection : 0,
      observation: item.observation || '',
      activity: item.activity || 'Teoría'
    }));

    // 5. Bulk insert child schedule entries
    const { error: insertError } = await (supabase
      .from('schedule_entries') as any)
      .insert(dbEntries);

    if (insertError) {
      console.error('Error batch inserting relational entries:', insertError);
      throw insertError;
    }

    return true;
  } catch (err) {
    console.error('Failed to sync relational state to Supabase:', err);
    return false;
  }
}
