#!/usr/bin/env python3
"""
Motor de Optimización de Horarios Académicos con Google OR-Tools (CP-SAT)
Modelado de Programación con Restricciones (Constraint Programming)
"""

import sys
import json
import math
import time
from ortools.sat.python import cp_model

DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

# Definición de Franjas y Bloques de 45 minutos
# Morning (7:00 - 13:00): 8 bloques
# Afternoon (14:00 - 17:00): 4 bloques
# Evening (18:00 - 21:45): 5 bloques

BLOCK_TIMES = [
    # Mañana (0 .. 7)
    {"shift": "morning", "shift_idx": 0, "time": "07:00", "mins": 420},
    {"shift": "morning", "shift_idx": 1, "time": "07:45", "mins": 465},
    {"shift": "morning", "shift_idx": 2, "time": "08:30", "mins": 510},
    {"shift": "morning", "shift_idx": 3, "time": "09:15", "mins": 555},
    {"shift": "morning", "shift_idx": 4, "time": "10:00", "mins": 600},
    {"shift": "morning", "shift_idx": 5, "time": "10:45", "mins": 645},
    {"shift": "morning", "shift_idx": 6, "time": "11:30", "mins": 690},
    {"shift": "morning", "shift_idx": 7, "time": "12:15", "mins": 735},
    # Tarde (8 .. 11)
    {"shift": "afternoon", "shift_idx": 0, "time": "14:00", "mins": 840},
    {"shift": "afternoon", "shift_idx": 1, "time": "14:45", "mins": 885},
    {"shift": "afternoon", "shift_idx": 2, "time": "15:30", "mins": 930},
    {"shift": "afternoon", "shift_idx": 3, "time": "16:15", "mins": 975},
    # Noche (12 .. 16)
    {"shift": "evening", "shift_idx": 0, "time": "18:00", "mins": 1080},
    {"shift": "evening", "shift_idx": 1, "time": "18:45", "mins": 1125},
    {"shift": "evening", "shift_idx": 2, "time": "19:30", "mins": 1170},
    {"shift": "evening", "shift_idx": 3, "time": "20:15", "mins": 1215},
    {"shift": "evening", "shift_idx": 4, "time": "21:00", "mins": 1260},
]

NUM_BLOCKS = len(BLOCK_TIMES)  # 17 bloques por día

def get_block_index(day_str, start_time_str):
    try:
        parts = start_time_str.split(":")
        mins = int(parts[0]) * 60 + int(parts[1])
        # Find closest block
        best_idx = 0
        min_diff = 999999
        for idx, blk in enumerate(BLOCK_TIMES):
            diff = abs(blk["mins"] - mins)
            if diff < min_diff:
                min_diff = diff
                best_idx = idx
        return best_idx
    except Exception:
        return 0

def solve_timetabling(input_data):
    start_time_proc = time.time()
    
    entries = input_data.get("entries", [])
    classrooms = input_data.get("classrooms", [])
    target_semester = input_data.get("targetSemester", None)
    options = input_data.get("options", {})
    
    time_limit_sec = float(options.get("timeLimitSeconds", 10))
    respect_fixed = bool(options.get("respectFixed", True))
    min_gaps_weight = int(options.get("minimizeGapsWeight", 3))
    compact_weight = int(options.get("compactDaysWeight", 2))
    
    # Pre-parse classrooms
    room_names = [c["name"] for c in classrooms if c.get("name") not in ["Por asignar", "Institucional"]]
    if not room_names:
        room_names = ["QuantumX", "QuantumAlpha", "QuantumBeta", "Matrix", "Horizons", "Sala ocasional"]
    
    # Fallback / overflow room
    all_rooms = list(room_names) + ["Por asignar"]
    
    room_dict = {c["name"]: c for c in classrooms}
    
    # Create CP-SAT Model
    model = cp_model.CpModel()
    
    # Variables:
    # Para cada entrada e, y para cada opción válida (d, b, r)
    # x[e_idx, d_idx, b_idx, r_idx] es booleana
    # slack[e_idx] booleana (si no se pudo asignar)
    
    entry_vars = {}  # (e_idx, d_idx, b_idx, r_idx) -> BoolVar
    entry_options = {} # e_idx -> list of (d_idx, b_idx, r_idx)
    slack_vars = {}  # e_idx -> BoolVar
    
    # Map for constant lookups
    num_days = len(DAYS)
    
    for e_idx, e in enumerate(entries):
        is_frozen = False
        if target_semester is not None and e.get("semester") != target_semester:
            is_frozen = True
        
        is_fixed = bool(e.get("isFixed", False)) and respect_fixed
        
        # Calculate duration in 45-min blocks: K = round(intensity / 16)
        intensity = int(e.get("intensity", 32) or 32)
        num_blocks_k = max(1, round(intensity / 16))
        
        sem = int(e.get("semester", 1) or 1)
        projection = int(e.get("projection", 0) or 0)
        domain_req = [t.strip().lower() for t in str(e.get("domain", "")).split(",") if t.strip()]
        
        entry_options[e_idx] = []
        
        # If frozen or fixed, restrict strictly to its current slot
        if is_frozen or is_fixed:
            cur_day = e.get("day", "Lunes")
            d_idx = DAYS.index(cur_day) if cur_day in DAYS else 0
            b_idx = get_block_index(cur_day, e.get("startTime", "07:00"))
            cur_room = e.get("room", "Por asignar")
            r_idx = all_rooms.index(cur_room) if cur_room in all_rooms else len(all_rooms) - 1
            
            # Make sure duration fits in day
            if b_idx + num_blocks_k > NUM_BLOCKS:
                b_idx = max(0, NUM_BLOCKS - num_blocks_k)
                
            var = model.NewBoolVar(f"x_fixed_{e_idx}_{d_idx}_{b_idx}_{r_idx}")
            model.Add(var == 1)
            entry_vars[(e_idx, d_idx, b_idx, r_idx)] = var
            entry_options[e_idx].append((d_idx, b_idx, r_idx))
            continue
        
        # Candidate generation based on Semester & Shifts
        # Semestres 1 a 5: Diurno (Mañana: 0..7, Tarde: 8..11)
        # Semestres 6 a 9: Nocturno (Noche: 12..16, o Sábado Mañana: 0..7)
        for d_idx, day_name in enumerate(DAYS):
            is_saturday = (day_name == "Sábado")
            
            for b_idx in range(NUM_BLOCKS - num_blocks_k + 1):
                blk_info = BLOCK_TIMES[b_idx]
                end_blk_info = BLOCK_TIMES[b_idx + num_blocks_k - 1]
                
                # Must stay inside the same shift!
                if blk_info["shift"] != end_blk_info["shift"]:
                    continue
                
                shift = blk_info["shift"]
                
                # Rule: Sábado solo Mañana o Tarde (no noche)
                if is_saturday and shift == "evening":
                    continue
                
                # Shift compatibility by semester
                if sem <= 5:
                    if shift not in ["morning", "afternoon"]:
                        continue
                elif sem >= 6:
                    if shift != "evening":
                        if not (is_saturday and shift == "morning"):
                            continue
                
                # Room compatibility
                for r_idx, r_name in enumerate(all_rooms):
                    if r_name != "Por asignar":
                        r_def = room_dict.get(r_name, {})
                        r_cap = int(r_def.get("capacity", 50) or 50)
                        if r_cap < projection:
                            continue
                        
                        # Domain token subset check
                        r_domains = [str(d).lower() for d in r_def.get("domain", [])]
                        if domain_req and r_domains:
                            if not all(t in r_domains for t in domain_req):
                                continue
                    
                    var = model.NewBoolVar(f"x_{e_idx}_{d_idx}_{b_idx}_{r_idx}")
                    entry_vars[(e_idx, d_idx, b_idx, r_idx)] = var
                    entry_options[e_idx].append((d_idx, b_idx, r_idx))
        
        # Slack variable (unassigned class with heavy penalty)
        slack = model.NewBoolVar(f"slack_{e_idx}")
        slack_vars[e_idx] = slack
        
        # Exact 1 assignment: sum(candidate_vars) + slack == 1
        all_candidate_vars = [entry_vars[(e_idx, d, b, r)] for (d, b, r) in entry_options[e_idx]]
        if all_candidate_vars:
            model.Add(sum(all_candidate_vars) + slack == 1)
        else:
            model.Add(slack == 1)
            
    # -------------------------------------------------------------
    # CONFLICT CONSTRAINTS
    # -------------------------------------------------------------
    
    # 1. No Classroom Overlap: at most 1 class per (room != 'Por asignar', day, block)
    for r_idx, r_name in enumerate(all_rooms):
        if r_name == "Por asignar":
            continue
        for d_idx in range(num_days):
            for b in range(NUM_BLOCKS):
                active_in_slot = []
                for e_idx, e in enumerate(entries):
                    k = max(1, round(int(e.get("intensity", 32) or 32) / 16))
                    for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                        if d_opt == d_idx and r_opt == r_idx and b_opt <= b < b_opt + k:
                            active_in_slot.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                if len(active_in_slot) > 1:
                    model.Add(sum(active_in_slot) <= 1)
                    
    # 2. No Teacher Overlap: at most 1 class per (teacher != 'INSTITUCIONAL', day, block)
    teachers = set(e.get("teacher", "INSTITUCIONAL") for e in entries if e.get("teacher") and e.get("teacher") != "INSTITUCIONAL")
    for teacher in teachers:
        teacher_entry_indices = [idx for idx, e in enumerate(entries) if e.get("teacher") == teacher]
        for d_idx in range(num_days):
            for b in range(NUM_BLOCKS):
                active_in_slot = []
                for e_idx in teacher_entry_indices:
                    k = max(1, round(int(entries[e_idx].get("intensity", 32) or 32) / 16))
                    for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                        if d_opt == d_idx and b_opt <= b < b_opt + k:
                            active_in_slot.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                if len(active_in_slot) > 1:
                    model.Add(sum(active_in_slot) <= 1)
                    
    # 3. No Semester/Group Overlap: at most 1 class per (semester, group != 'SG', day, block)
    sem_groups = set((e.get("semester", 1), e.get("group", "G1")) for e in entries if e.get("group") != "SG")
    for (sem, grp) in sem_groups:
        sg_entry_indices = [idx for idx, e in enumerate(entries) if e.get("semester") == sem and e.get("group") == grp]
        for d_idx in range(num_days):
            for b in range(NUM_BLOCKS):
                active_in_slot = []
                for e_idx in sg_entry_indices:
                    k = max(1, round(int(entries[e_idx].get("intensity", 32) or 32) / 16))
                    for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                        if d_opt == d_idx and b_opt <= b < b_opt + k:
                            active_in_slot.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                if len(active_in_slot) > 1:
                    model.Add(sum(active_in_slot) <= 1)
                    
    # 4. QuantumX Exclusion Rule:
    # Si QuantumX está ocupada en (d, b), QuantumAlpha y QuantumBeta NO pueden estar ocupadas
    if "QuantumX" in all_rooms and ("QuantumAlpha" in all_rooms or "QuantumBeta" in all_rooms):
        qx_idx = all_rooms.index("QuantumX")
        qa_idx = all_rooms.index("QuantumAlpha") if "QuantumAlpha" in all_rooms else None
        qb_idx = all_rooms.index("QuantumBeta") if "QuantumBeta" in all_rooms else None
        
        for d_idx in range(num_days):
            for b in range(NUM_BLOCKS):
                qx_active = []
                qa_active = []
                qb_active = []
                for e_idx, e in enumerate(entries):
                    k = max(1, round(int(e.get("intensity", 32) or 32) / 16))
                    for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                        if d_opt == d_idx and b_opt <= b < b_opt + k:
                            if r_opt == qx_idx:
                                qx_active.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                            elif qa_idx is not None and r_opt == qa_idx:
                                qa_active.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                            elif qb_idx is not None and r_opt == qb_idx:
                                qb_active.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                
                # qx + qa <= 1 and qx + qb <= 1
                if qx_active and qa_active:
                    model.Add(sum(qx_active) + sum(qa_active) <= 1)
                if qx_active and qb_active:
                    model.Add(sum(qx_active) + sum(qb_active) <= 1)
                    
    # 5. Regla de las 2 jornadas máximas por Docente al día
    # Morning (0..7), Afternoon (8..11), Evening (12..16)
    for teacher in teachers:
        teacher_entry_indices = [idx for idx, e in enumerate(entries) if e.get("teacher") == teacher]
        for d_idx in range(num_days):
            has_morning = model.NewBoolVar(f"t_{teacher}_{d_idx}_m")
            has_afternoon = model.NewBoolVar(f"t_{teacher}_{d_idx}_a")
            has_evening = model.NewBoolVar(f"t_{teacher}_{d_idx}_e")
            
            m_vars = []
            a_vars = []
            e_vars = []
            
            for e_idx in teacher_entry_indices:
                for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                    if d_opt == d_idx:
                        v = entry_vars[(e_idx, d_opt, b_opt, r_opt)]
                        shift = BLOCK_TIMES[b_opt]["shift"]
                        if shift == "morning":
                            m_vars.append(v)
                        elif shift == "afternoon":
                            a_vars.append(v)
                        elif shift == "evening":
                            e_vars.append(v)
            
            if m_vars:
                model.AddMaxEquality(has_morning, m_vars)
            else:
                model.Add(has_morning == 0)
                
            if a_vars:
                model.AddMaxEquality(has_afternoon, a_vars)
            else:
                model.Add(has_afternoon == 0)
                
            if e_vars:
                model.AddMaxEquality(has_evening, e_vars)
            else:
                model.Add(has_evening == 0)
                
            model.Add(has_morning + has_afternoon + has_evening <= 2)

    # -------------------------------------------------------------
    # OBJECTIVE FUNCTION (Hierarchical / Weighted)
    # -------------------------------------------------------------
    objective_terms = []
    
    # High Penalty for unassigned classes
    for e_idx, slack in slack_vars.items():
        objective_terms.append(100000 * slack)
        
    # Penalty for "Por asignar" room (encourage assigning real rooms)
    por_asignar_idx = all_rooms.index("Por asignar") if "Por asignar" in all_rooms else -1
    if por_asignar_idx >= 0:
        for e_idx in range(len(entries)):
            for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                if r_opt == por_asignar_idx:
                    objective_terms.append(500 * entry_vars[(e_idx, d_opt, b_opt, r_opt)])
    
    # Soft preference: Keep original room if possible
    for e_idx, e in enumerate(entries):
        orig_room = e.get("room")
        if orig_room and orig_room in all_rooms and orig_room != "Por asignar":
            orig_r_idx = all_rooms.index(orig_room)
            for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                if r_opt != orig_r_idx:
                    objective_terms.append(10 * entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                    
    # Soft preference: Compact days for each semester/group
    if compact_weight > 0:
        for (sem, grp) in sem_groups:
            sg_entry_indices = [idx for idx, e in enumerate(entries) if e.get("semester") == sem and e.get("group") == grp]
            for d_idx in range(num_days):
                day_used = model.NewBoolVar(f"day_used_{sem}_{grp}_{d_idx}")
                day_vars = []
                for e_idx in sg_entry_indices:
                    for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                        if d_opt == d_idx:
                            day_vars.append(entry_vars[(e_idx, d_opt, b_opt, r_opt)])
                if day_vars:
                    model.AddMaxEquality(day_used, day_vars)
                    objective_terms.append(compact_weight * 20 * day_used)

    model.Minimize(sum(objective_terms))
    
    # -------------------------------------------------------------
    # SOLVER EXECUTION
    # -------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.num_workers = 4
    solver.parameters.log_search_progress = False
    
    solve_status = solver.Solve(model)
    elapsed_ms = int((time.time() - start_time_proc) * 1000)
    
    status_str = "UNKNOWN"
    if solve_status == cp_model.OPTIMAL:
        status_str = "OPTIMAL"
    elif solve_status == cp_model.FEASIBLE:
        status_str = "FEASIBLE"
    elif solve_status == cp_model.INFEASIBLE:
        status_str = "INFEASIBLE"
    elif solve_status == cp_model.MODEL_INVALID:
        status_str = "MODEL_INVALID"
        
    solved_entries = []
    unassigned_count = 0
    
    if solve_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for e_idx, e in enumerate(entries):
            e_copy = dict(e)
            intensity = int(e.get("intensity", 32) or 32)
            k = max(1, round(intensity / 16))
            e_copy["durationHours"] = k * 0.75
            
            assigned = False
            for (d_opt, b_opt, r_opt) in entry_options[e_idx]:
                if solver.Value(entry_vars[(e_idx, d_opt, b_opt, r_opt)]) == 1:
                    e_copy["day"] = DAYS[d_opt]
                    e_copy["startTime"] = BLOCK_TIMES[b_opt]["time"]
                    e_copy["room"] = all_rooms[r_opt]
                    assigned = True
                    break
                    
            if not assigned:
                unassigned_count += 1
                e_copy["room"] = "Por asignar"
                
            solved_entries.append(e_copy)
    else:
        solved_entries = list(entries)
        
    return {
        "status": status_str,
        "wallTimeMs": elapsed_ms,
        "unassignedCount": unassigned_count,
        "totalEntries": len(entries),
        "targetSemester": target_semester,
        "objectiveValue": solver.ObjectiveValue() if solve_status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
        "numVariables": len(entry_vars),
        "numConstraints": len(model.Proto().constraints),
        "entries": solved_entries,
        "message": f"OR-Tools CP-SAT completó la optimización con estado: {status_str} en {elapsed_ms} ms."
    }

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--test":
            test_payload = {
                "entries": [
                    {"id": "1", "semester": 1, "group": "G1", "subject": "Cálculo I", "day": "Lunes", "startTime": "07:00", "intensity": 64, "projection": 35, "teacher": "Docente A", "room": "Matrix"},
                    {"id": "2", "semester": 1, "group": "G1", "subject": "Física I", "day": "Lunes", "startTime": "07:00", "intensity": 48, "projection": 30, "teacher": "Docente B", "room": "Matrix"}
                ],
                "classrooms": [
                    {"name": "Matrix", "capacity": 45, "domain": ["Teoria", "Práctica"]},
                    {"name": "QuantumX", "capacity": 60, "domain": ["Teoria", "Práctica", "Hardware"]}
                ]
            }
            res = solve_timetabling(test_payload)
            print(json.dumps(res, indent=2, ensure_ascii=False))
            sys.exit(0)
            
        raw_input = sys.stdin.read()
        if raw_input:
            data = json.loads(raw_input)
            result = solve_timetabling(data)
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps({"error": "No input provided"}))
    except Exception as exc:
        print(json.dumps({"error": str(exc), "status": "ERROR"}))
        sys.exit(1)
