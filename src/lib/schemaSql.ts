export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SISTEMA DE PROGRAMACIÓN ACADÉMICA Y GESTIÓN DE HORARIOS UNIVERSITARIOS
-- Script DDL de Creación y Configuración de Base de Datos para PostgreSQL / Supabase
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 2. TABLA: ASIGNATURAS (subjects)
-- Almacena el catálogo oficial de materias, códigos, intensidades y créditos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    code VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    intensity INTEGER NOT NULL DEFAULT 0,
    hours_theory INTEGER NOT NULL DEFAULT 0,
    hours_practice INTEGER NOT NULL DEFAULT 0,
    department VARCHAR(100) NOT NULL DEFAULT 'INGENIERÍA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.subjects IS 'Catálogo de asignaturas del programa académico';
COMMENT ON COLUMN public.subjects.code IS 'Código identificador único de la asignatura (ej. 24869-G01)';
COMMENT ON COLUMN public.subjects.intensity IS 'Intensidad horaria total del semestre (ej. 32, 48, 64)';

-- ------------------------------------------------------------------------------
-- 3. TABLA: AULAS Y ESPACIOS FÍSICOS (classrooms)
-- Registra aulas, laboratorios, sedes, capacidades y dominios de uso
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classrooms (
    name VARCHAR(100) PRIMARY KEY,
    location VARCHAR(50) NOT NULL DEFAULT 'RN',
    domain TEXT[] NOT NULL DEFAULT ARRAY['Teoria', 'Práctica']::TEXT[],
    capacity INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.classrooms IS 'Aulas, laboratorios y salas físicas disponibles para la docencia';
COMMENT ON COLUMN public.classrooms.name IS 'Nombre único del aula o sala (ej. QuantumX, Matrix, Horizons)';
COMMENT ON COLUMN public.classrooms.domain IS 'Lista de tokens de aptitud técnica y uso (Teoria, Práctica, Desarrollo, Hardware)';
COMMENT ON COLUMN public.classrooms.capacity IS 'Capacidad máxima de estudiantes';

-- ------------------------------------------------------------------------------
-- 4. TABLA: DOCENTES (teachers)
-- Registra los profesores y personal académico asignado
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
    name VARCHAR(150) PRIMARY KEY,
    department VARCHAR(100) NOT NULL DEFAULT 'INGENIERÍA',
    email VARCHAR(150),
    max_weekly_hours INTEGER DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.teachers IS 'Docentes e instructores del programa académico';
COMMENT ON COLUMN public.teachers.name IS 'Nombre completo del docente o INSTITUCIONAL';

-- ------------------------------------------------------------------------------
-- 5. TABLA: PROGRAMACIÓN HORARIA Y CLASES (schedule_entries)
-- Tabla principal de asignaciones horarias, grupos, días y franjas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_entries (
    id VARCHAR(100) PRIMARY KEY,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
    subject_code VARCHAR(50) REFERENCES public.subjects(code) ON UPDATE CASCADE ON DELETE SET NULL,
    "group" VARCHAR(20) NOT NULL DEFAULT 'G1',
    day VARCHAR(20) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    duration_hours NUMERIC(4,2) NOT NULL DEFAULT 2.00,
    room_name VARCHAR(100) REFERENCES public.classrooms(name) ON UPDATE CASCADE ON DELETE SET NULL,
    teacher_name VARCHAR(150) REFERENCES public.teachers(name) ON UPDATE CASCADE ON DELETE SET NULL,
    projection INTEGER NOT NULL DEFAULT 0,
    observation TEXT DEFAULT '',
    activity VARCHAR(50) NOT NULL DEFAULT 'Teoría',
    is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
    domain VARCHAR(100) DEFAULT 'Teoria',
    capacity INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.schedule_entries IS 'Entradas de horarios asignados a asignaturas, grupos, aulas y profesores';
COMMENT ON COLUMN public.schedule_entries.is_fixed IS 'Bloqueo Columna A: si es TRUE, el optimizador no mueve la clase';
COMMENT ON COLUMN public.schedule_entries.duration_hours IS 'Duración en horas reloj (ej. 1.5, 2.0, 3.0)';

-- ------------------------------------------------------------------------------
-- 6. ÍNDICES DE RENDIMIENTO PARA CONSULTAS Y CRUCES EN TIEMPO REAL
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedule_semester ON public.schedule_entries(semester);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON public.schedule_entries(day);
CREATE INDEX IF NOT EXISTS idx_schedule_subject_code ON public.schedule_entries(subject_code);
CREATE INDEX IF NOT EXISTS idx_schedule_room_name ON public.schedule_entries(room_name);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher_name ON public.schedule_entries(teacher_name);
CREATE INDEX IF NOT EXISTS idx_schedule_day_start ON public.schedule_entries(day, start_time);

-- ------------------------------------------------------------------------------
-- 7. FUNCIÓN Y TRIGGER AUTOMÁTICO PARA ACTUALIZAR updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_subjects_updated_at ON public.subjects;
CREATE TRIGGER tr_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_classrooms_updated_at ON public.classrooms;
CREATE TRIGGER tr_classrooms_updated_at
    BEFORE UPDATE ON public.classrooms
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_teachers_updated_at ON public.teachers;
CREATE TRIGGER tr_teachers_updated_at
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_schedule_entries_updated_at ON public.schedule_entries;
CREATE TRIGGER tr_schedule_entries_updated_at
    BEFORE UPDATE ON public.schedule_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. SEGURIDAD Y PERMISOS: ROW LEVEL SECURITY (RLS)
-- Políticas para permitir operaciones desde el cliente frontend web (Anon Key)
-- ------------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

-- Políticas para subjects
DROP POLICY IF EXISTS "Permitir lectura publica subjects" ON public.subjects;
CREATE POLICY "Permitir lectura publica subjects" ON public.subjects
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura anon subjects" ON public.subjects;
CREATE POLICY "Permitir escritura anon subjects" ON public.subjects
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para classrooms
DROP POLICY IF EXISTS "Permitir lectura publica classrooms" ON public.classrooms;
CREATE POLICY "Permitir lectura publica classrooms" ON public.classrooms
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura anon classrooms" ON public.classrooms;
CREATE POLICY "Permitir escritura anon classrooms" ON public.classrooms
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para teachers
DROP POLICY IF EXISTS "Permitir lectura publica teachers" ON public.teachers;
CREATE POLICY "Permitir lectura publica teachers" ON public.teachers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura anon teachers" ON public.teachers;
CREATE POLICY "Permitir escritura anon teachers" ON public.teachers
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para schedule_entries
DROP POLICY IF EXISTS "Permitir lectura publica schedule_entries" ON public.schedule_entries;
CREATE POLICY "Permitir lectura publica schedule_entries" ON public.schedule_entries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura anon schedule_entries" ON public.schedule_entries;
CREATE POLICY "Permitir escritura anon schedule_entries" ON public.schedule_entries
    FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. DATOS SEMILLA BÁSICOS (SEED DATA)
-- Espacios e Infraestructura Física
-- ------------------------------------------------------------------------------
INSERT INTO public.classrooms (name, location, domain, capacity)
VALUES 
    ('QuantumX', 'RN', ARRAY['Teoria', 'Práctica', 'Desarrollo', 'Hardware'], 60),
    ('QuantumAlpha', 'RN', ARRAY['Teoria', 'Práctica', 'Desarrollo'], 35),
    ('QuantumBeta', 'RN', ARRAY['Teoria', 'Práctica', 'Desarrollo'], 35),
    ('Matrix', 'RN', ARRAY['Teoria', 'Práctica'], 45),
    ('Horizons', 'RN', ARRAY['Teoria'], 45),
    ('Sala ocasional', 'RN', ARRAY['Teoria'], 40),
    ('Institucional', 'RN', ARRAY['Teoria', 'Práctica'], 100),
    ('Por asignar', 'RN', ARRAY['Teoria', 'Práctica'], 999)
ON CONFLICT (name) DO UPDATE SET 
    location = EXCLUDED.location,
    domain = EXCLUDED.domain,
    capacity = EXCLUDED.capacity;

-- Docente por defecto para materias no asignadas
INSERT INTO public.teachers (name, department)
VALUES 
    ('INSTITUCIONAL', 'INGENIERÍA'),
    ('Por asignar', 'INGENIERÍA')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. VISTAS ANALÍTICAS ÚTILES
-- Vista para consultar la programación completa con relaciones legibles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_horarios_completos AS
SELECT 
    se.id,
    se.is_fixed AS asignacion_fija,
    se.semester AS semestre,
    s.code AS codigo_asignatura,
    s.name AS asignatura,
    s.intensity AS intensidad_horaria,
    se.activity AS actividad,
    se.day AS dia,
    se.group AS grupo,
    se.start_time AS hora_inicio,
    se.duration_hours AS duracion_horas,
    se.room_name AS aula,
    c.location AS sede,
    se.teacher_name AS docente,
    s.department AS dependencia,
    s.hours_theory AS horas_teoria,
    s.hours_practice AS horas_practica,
    c.capacity AS capacidad_aula,
    se.projection AS proyeccion_matricula,
    se.domain AS dominio_uso
FROM public.schedule_entries se
LEFT JOIN public.subjects s ON se.subject_code = s.code
LEFT JOIN public.classrooms c ON se.room_name = c.name
ORDER BY se.semester ASC, se.day ASC, se.start_time ASC;
`;
