import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Cpu,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Code2,
  Sliders,
  Sparkles,
  RefreshCw,
  Server,
  Activity,
  Layers,
  Lock,
  Clock,
  ExternalLink
} from 'lucide-react';
import { ScheduleEntry, DBClassroom } from '../types';
import {
  solveScheduleWithOrtools,
  generateOrtoolsPythonScript,
  checkOrtoolsStatus,
  OrtoolsSolverResult,
  OrtoolsSolveOptions
} from '../lib/ortoolsService';

interface OrtoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ScheduleEntry[];
  classrooms: DBClassroom[];
  onApplySolution: (solvedEntries: ScheduleEntry[], summary: string) => void;
}

export default function OrtoolsModal({
  isOpen,
  onClose,
  entries,
  classrooms,
  onApplySolution,
}: OrtoolsModalProps) {
  const [activeTab, setActiveTab] = useState<'solver' | 'python' | 'rules'>('solver');
  const [isSolving, setIsSolving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Solver parameters
  const [targetSemester, setTargetSemester] = useState<string>('all');
  const [timeLimit, setTimeLimit] = useState<number>(10);
  const [respectFixed, setRespectFixed] = useState<boolean>(true);
  const [minimizeGapsWeight, setMinimizeGapsWeight] = useState<number>(3);
  const [compactDaysWeight, setCompactDaysWeight] = useState<number>(2);

  // Result state
  const [lastResult, setLastResult] = useState<OrtoolsSolverResult | null>(null);
  const [ortoolsStatus, setOrtoolsStatus] = useState<{ ready: boolean; version?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkOrtoolsStatus().then(status => {
        setOrtoolsStatus(status);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSolve = async () => {
    setIsSolving(true);
    try {
      const options: OrtoolsSolveOptions = {
        timeLimitSeconds: timeLimit,
        targetSemester: targetSemester === 'all' ? null : parseInt(targetSemester, 10),
        respectFixed,
        minimizeGapsWeight,
        compactDaysWeight,
      };

      const result = await solveScheduleWithOrtools(entries, classrooms, options);
      setLastResult(result);
    } catch (err: any) {
      console.error('Error ejecutando OR-Tools:', err);
    } finally {
      setIsSolving(false);
    }
  };

  const handleApply = () => {
    if (lastResult && lastResult.entries) {
      onApplySolution(lastResult.entries, lastResult.message);
      onClose();
    }
  };

  const pythonScript = generateOrtoolsPythonScript(entries, classrooms, {
    timeLimitSeconds: timeLimit,
    targetSemester: targetSemester === 'all' ? null : parseInt(targetSemester, 10),
    respectFixed,
    minimizeGapsWeight,
    compactDaysWeight,
  });

  const handleCopyPython = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPython = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academic_schedule_ortools_cpsat.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Motor de Optimización Google OR-Tools
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                    CP-SAT Solver v{ortoolsStatus?.version || '9.15'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Resolución matemática de restricciones duras, asignación óptima de aulas, franjas y docentes en paralelo.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Bar */}
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('solver')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'solver'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Panel de Optimización</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('python')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'python'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Script Python CP-SAT</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'rules'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Restricciones Modeladas (11)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {ortoolsStatus?.ready && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <Server className="w-3 h-3 text-emerald-600" />
                  Backend OR-Tools Activo
                </span>
              )}
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-sm font-sans space-y-5">
            {activeTab === 'solver' && (
              <div className="space-y-6">
                {/* Configuration Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Target Scope */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Alcance de Optimización
                    </label>
                    <select
                      value={targetSemester}
                      onChange={(e) => setTargetSemester(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">Todos los Semestres (1 al 9)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
                        <option key={s} value={s}>
                          Solo Semestre {s} (Congelar los demás)
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Permite optimizar toda la malla o ajustar un único semestre sin alterar los otros.
                    </p>
                  </div>

                  {/* Solver Timeout */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Tiempo Límite CP-SAT
                    </label>
                    <select
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={5}>5 Segundos (Rápido)</option>
                      <option value={10}>10 Segundos (Recomendado)</option>
                      <option value={20}>20 Segundos (Profundo)</option>
                      <option value={45}>45 Segundos (Exhaustivo)</option>
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Tiempo máximo que el solver CP-SAT explorará ramas de búsqueda.
                    </p>
                  </div>

                  {/* Hard Lock Rule */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 flex flex-col justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        Bloqueo Columna A
                      </label>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Respetar estrictamente clases con candado (no mover día, hora ni aula).
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={respectFixed}
                        onChange={(e) => setRespectFixed(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Preservar Asignaciones Fijas
                      </span>
                    </label>
                  </div>
                </div>

                {/* Soft Preferences Weights */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Ponderación de Objetivos Secundarios (Función Objetivo)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Minimizar Huecos / Horas Libres entre Clases</span>
                        <span className="text-indigo-600 font-bold">{minimizeGapsWeight}x</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        value={minimizeGapsWeight}
                        onChange={(e) => setMinimizeGapsWeight(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Compactar Días de Asistencia Semestral</span>
                        <span className="text-indigo-600 font-bold">{compactDaysWeight}x</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        value={compactDaysWeight}
                        onChange={(e) => setCompactDaysWeight(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Trigger */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <div className="text-xs text-indigo-950 space-y-0.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      Listo para resolver {entries.length} clases y {classrooms.length} aulas
                    </p>
                    <p className="text-indigo-700">
                      OR-Tools procesará el modelo matemático CP-SAT garantizando cero colisiones.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSolve}
                    disabled={isSolving}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Resolviendo CP-SAT...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Ejecutar Optimización OR-Tools</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Results Section */}
                {lastResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        {lastResult.status === 'OPTIMAL' ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : lastResult.status === 'FEASIBLE' ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            Resultado de Optimización: {lastResult.status}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {lastResult.message}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleApply}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aplicar al Horario Activo</span>
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Tiempo de Cómputo</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">{lastResult.wallTimeMs} ms</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Clases Procesadas</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">{lastResult.totalEntries}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Sin Asignar (Slack)</span>
                        <span className={`text-sm font-bold font-mono ${lastResult.unassignedCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {lastResult.unassignedCount}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Motor</span>
                        <span className="text-xs font-bold text-indigo-700 font-mono">
                          {lastResult.source === 'backend_ortools_cpsat' ? 'Google CP-SAT' : 'Hybrid Engine'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === 'python' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600">
                    Script Python autónomo con el modelo CP-SAT y los datos actuales del horario listos:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPython}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copiar Script</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPython}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar .py</span>
                    </button>
                  </div>
                </div>

                <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed shadow-inner max-h-[55vh]">
                  <pre>{pythonScript}</pre>
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-4">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs space-y-3">
                  <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Restricciones Duras Modeladas en Google OR-Tools CP-SAT
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">1. Asignación Única:</span>
                      <p className="text-[11px] text-slate-600">Cada clase debe tener exactamente 1 franja (o slack penalizado).</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">2. Bloqueo Columna A:</span>
                      <p className="text-[11px] text-slate-600">Clases marcadas como fijas no se mueven de día, hora ni aula.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">3. Multi-bloque K Consecutivo:</span>
                      <p className="text-[11px] text-slate-600">K bloques de 45m consecutivos según intensidad (32h→2, 48h→3, 64h→4).</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">4. Compatibilidad de Aula:</span>
                      <p className="text-[11px] text-slate-600">Capacidad ≥ Proyección y Dominios requeridos ⊆ Dominios del aula.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">5. Regla de Jornadas:</span>
                      <p className="text-[11px] text-slate-600">Sem 1-5 diurnos (Mañana/Tarde); Sem 6-9 nocturnos (Noche o Sáb Mañana).</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">6. No Solapamiento de Aulas:</span>
                      <p className="text-[11px] text-slate-600">Máx 1 clase por aula física en cualquier franja horaria.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">7. No Solapamiento de Docentes:</span>
                      <p className="text-[11px] text-slate-600">Un docente no puede dictar dos materias simultáneas.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">8. No Cruce de Semestres:</span>
                      <p className="text-[11px] text-slate-600">Estudiantes del mismo semestre/grupo no tienen materias cruzadas.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">9. Exclusión QuantumX:</span>
                      <p className="text-[11px] text-slate-600">QuantumX bloquea simultaneidad con QuantumAlpha y QuantumBeta.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <span className="font-bold text-indigo-700">10. Máximo 2 Jornadas por Docente:</span>
                      <p className="text-[11px] text-slate-600">Ningún profesor puede dictar en Mañana + Tarde + Noche el mismo día.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" />
              Algoritmo: <strong className="text-slate-700">Constraint Programming SATisfiability (CP-SAT)</strong>
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
