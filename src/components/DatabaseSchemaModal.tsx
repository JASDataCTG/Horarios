import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Download,
  Database,
  Table,
  ShieldCheck,
  Key,
  Layers,
  Terminal,
  ExternalLink,
  Code2,
  FileCode
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../lib/schemaSql';

interface DatabaseSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseSchemaModal({ isOpen, onClose }: DatabaseSchemaModalProps) {
  const [activeTab, setActiveTab] = useState<'sql' | 'tables' | 'guide'>('sql');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/sql;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = 'supabase_academic_schedule_schema.sql';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Órdenes y Script DDL de la Base de Datos
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    PostgreSQL / Supabase
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-sans">
                  Instrucciones SQL completas para recrear las tablas relacionales, llaves foráneas, índices, triggers y RLS.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs & Actions */}
          <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('sql')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sql'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Script SQL Completo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tables')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'tables'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Estructura de Tablas (4)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Guía de Ejecución</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Copiar script SQL al portapapeles"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Descargar archivo .sql"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .sql</span>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-sm font-sans space-y-4">
            {activeTab === 'sql' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-sans">
                  <span>Script DDL listo para ejecutar en el <strong>SQL Editor</strong> de Supabase o PostgreSQL:</span>
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    PostgreSQL 14+ / Supabase
                  </span>
                </div>
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed shadow-inner max-h-[55vh]">
                  <pre>{SUPABASE_SQL_SCHEMA}</pre>
                </div>
              </div>
            )}

            {activeTab === 'tables' && (
              <div className="space-y-6">
                {/* 1. Subjects */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      1. Tabla <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono">public.subjects</code>
                    </h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Catálogo de Asignaturas</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Almacena las materias académicas con sus intensidades, horas teóricas/prácticas y dependencia.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-1.5 px-3">Columna</th>
                          <th className="py-1.5 px-3">Tipo</th>
                          <th className="py-1.5 px-3">Clave / Restricción</th>
                          <th className="py-1.5 px-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-indigo-700">code</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(50)</td>
                          <td className="py-1.5 px-3 text-emerald-700 font-semibold">PRIMARY KEY</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Código único de materia (ej. 24869-G01)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">name</td>
                          <td className="py-1.5 px-3 text-slate-600">TEXT</td>
                          <td className="py-1.5 px-3 text-rose-700 font-semibold">NOT NULL</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Nombre descriptivo de la asignatura</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">intensity</td>
                          <td className="py-1.5 px-3 text-slate-600">INTEGER</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 0</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Intensidad horaria semestral (32, 48, 64)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">hours_theory</td>
                          <td className="py-1.5 px-3 text-slate-600">INTEGER</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 0</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Horas semanales de teoría</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">hours_practice</td>
                          <td className="py-1.5 px-3 text-slate-600">INTEGER</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 0</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Horas semanales de práctica / laboratorio</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">department</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(100)</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 'INGENIERÍA'</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Facultad o programa académico</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Classrooms */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      2. Tabla <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-mono">public.classrooms</code>
                    </h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Espacios e Infraestructura</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Espacios físicos disponibles para clases, con control de capacidad máxima y dominios de uso (Teoria, Práctica, Desarrollo, Hardware).
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-1.5 px-3">Columna</th>
                          <th className="py-1.5 px-3">Tipo</th>
                          <th className="py-1.5 px-3">Clave / Restricción</th>
                          <th className="py-1.5 px-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-emerald-700">name</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(100)</td>
                          <td className="py-1.5 px-3 text-emerald-700 font-semibold">PRIMARY KEY</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Nombre del aula (QuantumX, Matrix, Horizons)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">location</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(50)</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 'RN'</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Sede o bloque universitario</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">domain</td>
                          <td className="py-1.5 px-3 text-slate-600">TEXT[]</td>
                          <td className="py-1.5 px-3 text-slate-500">ARRAY DEFAULT</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Tokens de aptitud técnica y uso</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">capacity</td>
                          <td className="py-1.5 px-3 text-slate-600">INTEGER</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 50</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Capacidad máxima de puestos de estudiantes</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Teachers */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-600" />
                      3. Tabla <code className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-xs font-mono">public.teachers</code>
                    </h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Planta Docente</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Profesores del programa para validación de cargas horarias y no solapamientos en paralelo.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-1.5 px-3">Columna</th>
                          <th className="py-1.5 px-3">Tipo</th>
                          <th className="py-1.5 px-3">Clave / Restricción</th>
                          <th className="py-1.5 px-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-amber-700">name</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(150)</td>
                          <td className="py-1.5 px-3 text-emerald-700 font-semibold">PRIMARY KEY</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Nombre completo del profesor o 'INSTITUCIONAL'</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">department</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(100)</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT ''</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Departamento académico</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Schedule Entries */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-rose-600" />
                      4. Tabla <code className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-xs font-mono">public.schedule_entries</code>
                    </h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Programación Central</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Tabla transaccional relacional que une semestre, asignatura, aula, docente, día, hora y restricciones duras (Columna A fijada, duraciones multi-bloque, dominios).
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-1.5 px-3">Columna</th>
                          <th className="py-1.5 px-3">Tipo</th>
                          <th className="py-1.5 px-3">Relación / Restricción</th>
                          <th className="py-1.5 px-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-rose-700">id</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(100)</td>
                          <td className="py-1.5 px-3 text-emerald-700 font-semibold">PRIMARY KEY</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Identificador único de la franja horaria</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">semester</td>
                          <td className="py-1.5 px-3 text-slate-600">INTEGER</td>
                          <td className="py-1.5 px-3 text-slate-600">CHECK (1..12)</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Semestre académico (1-5 diurno, 6-9 nocturno)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">subject_code</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(50)</td>
                          <td className="py-1.5 px-3 text-indigo-600 font-semibold">FK → subjects(code)</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Llave foránea hacia la materia</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">group</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(20)</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 'G1'</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Grupo académico (G1, G2, SG)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">day</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(20)</td>
                          <td className="py-1.5 px-3 text-rose-700 font-semibold">NOT NULL</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Día de la semana (Lunes .. Sábado)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">start_time</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(10)</td>
                          <td className="py-1.5 px-3 text-rose-700 font-semibold">NOT NULL</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Hora de inicio militar (ej. 07:00, 18:30)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">duration_hours</td>
                          <td className="py-1.5 px-3 text-slate-600">NUMERIC(4,2)</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT 2.0</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Duración K bloques (ej. 1.5, 2.25, 3.0)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">room_name</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(100)</td>
                          <td className="py-1.5 px-3 text-emerald-600 font-semibold">FK → classrooms(name)</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Aula física asignada</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">teacher_name</td>
                          <td className="py-1.5 px-3 text-slate-600">VARCHAR(150)</td>
                          <td className="py-1.5 px-3 text-amber-600 font-semibold">FK → teachers(name)</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Docente responsable</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 font-bold text-slate-800">is_fixed</td>
                          <td className="py-1.5 px-3 text-slate-600">BOOLEAN</td>
                          <td className="py-1.5 px-3 text-slate-500">DEFAULT false</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">Bloqueo Columna A (inamovible por optimizador)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'guide' && (
              <div className="space-y-4">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs space-y-3">
                  <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    Pasos para aplicar el script en Supabase Cloud
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-relaxed font-sans">
                    <li>
                      Acceda a su cuenta en <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a> y abra su proyecto.
                    </li>
                    <li>
                      En el menú lateral izquierdo, seleccione la sección <strong>SQL Editor</strong> (ícono de consola).
                    </li>
                    <li>
                      Haga clic en <strong>New Query</strong> (Nueva Consulta).
                    </li>
                    <li>
                      Copie el script desde la pestaña <strong>Script SQL Completo</strong> de este diálogo y péguelo en el editor de Supabase.
                    </li>
                    <li>
                      Presione el botón verde <strong>RUN</strong> en la esquina inferior derecha. Verá el mensaje <code className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-mono text-[11px]">Success. No rows returned</code>.
                    </li>
                    <li>
                      En el menú lateral de Supabase, vaya a <strong>Project Settings → API</strong> y copie:
                      <ul className="list-disc list-inside pl-4 mt-1 space-y-1 font-mono text-[11px] text-slate-600">
                        <li><strong>Project URL</strong> → para la variable <span className="bg-slate-200 px-1 rounded text-slate-800">VITE_SUPABASE_URL</span></li>
                        <li><strong>Project API Keys (anon public)</strong> → para la variable <span className="bg-slate-200 px-1 rounded text-slate-800">VITE_SUPABASE_ANON_KEY</span></li>
                      </ul>
                    </li>
                    <li>
                      ¡Listo! El sistema conectará automáticamente la base de datos relacional y permitirá sincronización en tiempo real entre múltiples usuarios.
                    </li>
                  </ol>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4 text-xs space-y-2 text-emerald-900">
                  <h4 className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Políticas de Seguridad Row Level Security (RLS) incluidas
                  </h4>
                  <p className="text-emerald-800 font-sans leading-relaxed">
                    El script incluye automáticamente las políticas de seguridad Row Level Security (RLS) para permitir operaciones seguras <code className="font-mono font-semibold">SELECT</code>, <code className="font-mono font-semibold">INSERT</code>, <code className="font-mono font-semibold">UPDATE</code> y <code className="font-mono font-semibold">DELETE</code> desde el cliente web mediante la clave anónima (Anon Key), garantizando que las tablas estén protegidas y accesibles.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans">
            <span className="flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-indigo-600" />
              Archivo generado: <code className="font-mono text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded">/supabase_schema.sql</code>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
