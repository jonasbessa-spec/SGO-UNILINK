/*
# SHIFT MASTER — Schema for Port Operations Shift Management

## Purpose
Complete database schema for the SHIFT MASTER module of the SGO (Sistema de Gestão Operacional) platform used by UNILINK Operações Portuárias. Manages work shifts, employees, shift assignments, swaps, leave/absences, coverage analysis, change history, operational alerts, and saved filters.

## New Tables

1. **shift_scales** — Scale/shift pattern configurations (e.g., 12x36, Diurno, Noturno)
   - id, name, type, start_time, end_time, break_minutes, work_days, off_days, shift_group, start_date, end_date, is_active, created_at

2. **employees** — Port operation workers
   - id, name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes, created_at, updated_at

3. **shift_assignments** — Individual shift assignments per employee per day
   - id, employee_id, date, shift_group, shift_type, start_time, end_time, role, team, status, notes, created_at, updated_at

4. **shift_swaps** — Shift swap requests between employees
   - id, requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags, created_at, updated_at

5. **leave_records** — Vacations, absences, licenses, programmed time-off
   - id, employee_id, leave_type, start_date, end_date, notes, status, created_at, updated_at

6. **coverage_requirements** — Expected headcount per shift per role per day
   - id, date, shift_group, role, required_count, assigned_count, created_at

7. **change_history** — Audit log of all changes made in SHIFT MASTER
   - id, user_name, change_date, change_time, employee_name, field_changed, old_value, new_value, reason, created_at

8. **operational_alerts** — System-generated operational alerts
   - id, alert_type, severity, title, description, employee_id, shift_group, date, is_resolved, created_at

9. **saved_filters** — User-saved filter configurations
   - id, name, filter_config (jsonb), created_at

## Security
- RLS enabled on all tables.
- Single-tenant app (no auth) — policies allow anon + authenticated full CRUD on all tables.
- USING (true) is acceptable because this is intentionally shared operational data with no sign-in screen.
*/

-- Shift scale configurations
CREATE TABLE IF NOT EXISTS shift_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT '12x36',
  start_time text NOT NULL DEFAULT '06:00',
  end_time text NOT NULL DEFAULT '18:00',
  break_minutes integer NOT NULL DEFAULT 60,
  work_days integer NOT NULL DEFAULT 1,
  off_days integer NOT NULL DEFAULT 1,
  shift_group text NOT NULL DEFAULT 'DIA - A',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shift_scales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_shift_scales_sel" ON shift_scales;
CREATE POLICY "anon_crud_shift_scales_sel" ON shift_scales FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_shift_scales_ins" ON shift_scales;
CREATE POLICY "anon_crud_shift_scales_ins" ON shift_scales FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_shift_scales_upd" ON shift_scales;
CREATE POLICY "anon_crud_shift_scales_upd" ON shift_scales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_shift_scales_del" ON shift_scales;
CREATE POLICY "anon_crud_shift_scales_del" ON shift_scales FOR DELETE TO anon, authenticated USING (true);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'Operador',
  sector text NOT NULL DEFAULT 'TMUT/NAVIO',
  shift_group text NOT NULL DEFAULT 'DIA - A',
  schedule_start text NOT NULL DEFAULT '06:00',
  schedule_end text NOT NULL DEFAULT '18:00',
  status text NOT NULL DEFAULT 'Ativo',
  hire_date date,
  scale_status text NOT NULL DEFAULT 'Em escala',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_employees_sel" ON employees;
CREATE POLICY "anon_crud_employees_sel" ON employees FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_employees_ins" ON employees;
CREATE POLICY "anon_crud_employees_ins" ON employees FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_employees_upd" ON employees;
CREATE POLICY "anon_crud_employees_upd" ON employees FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_employees_del" ON employees;
CREATE POLICY "anon_crud_employees_del" ON employees FOR DELETE TO anon, authenticated USING (true);

-- Shift assignments (per employee per day)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_group text NOT NULL,
  shift_type text NOT NULL DEFAULT 'Diurno',
  start_time text NOT NULL DEFAULT '06:00',
  end_time text NOT NULL DEFAULT '18:00',
  role text NOT NULL DEFAULT 'Operador',
  team text NOT NULL DEFAULT 'Equipe A',
  status text NOT NULL DEFAULT 'Escalado',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_assignments_sel" ON shift_assignments;
CREATE POLICY "anon_crud_assignments_sel" ON shift_assignments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_assignments_ins" ON shift_assignments;
CREATE POLICY "anon_crud_assignments_ins" ON shift_assignments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_assignments_upd" ON shift_assignments;
CREATE POLICY "anon_crud_assignments_upd" ON shift_assignments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_assignments_del" ON shift_assignments;
CREATE POLICY "anon_crud_assignments_del" ON shift_assignments FOR DELETE TO anon, authenticated USING (true);

-- Shift swaps
CREATE TABLE IF NOT EXISTS shift_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  substitute_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  original_date date NOT NULL,
  swap_date date NOT NULL,
  original_shift text NOT NULL,
  new_shift text NOT NULL,
  reason text DEFAULT '',
  approver text DEFAULT '',
  status text NOT NULL DEFAULT 'Pendente',
  conflict_flags text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_swaps_sel" ON shift_swaps;
CREATE POLICY "anon_crud_swaps_sel" ON shift_swaps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_swaps_ins" ON shift_swaps;
CREATE POLICY "anon_crud_swaps_ins" ON shift_swaps FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_swaps_upd" ON shift_swaps;
CREATE POLICY "anon_crud_swaps_upd" ON shift_swaps FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_swaps_del" ON shift_swaps;
CREATE POLICY "anon_crud_swaps_del" ON shift_swaps FOR DELETE TO anon, authenticated USING (true);

-- Leave records (vacations, absences, licenses, programmed time-off)
CREATE TABLE IF NOT EXISTS leave_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'Férias',
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'Aprovado',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_leave_sel" ON leave_records;
CREATE POLICY "anon_crud_leave_sel" ON leave_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_leave_ins" ON leave_records;
CREATE POLICY "anon_crud_leave_ins" ON leave_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_leave_upd" ON leave_records;
CREATE POLICY "anon_crud_leave_upd" ON leave_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_leave_del" ON leave_records;
CREATE POLICY "anon_crud_leave_del" ON leave_records FOR DELETE TO anon, authenticated USING (true);

-- Coverage requirements (expected vs assigned per shift per role per day)
CREATE TABLE IF NOT EXISTS coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  shift_group text NOT NULL,
  role text NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  assigned_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coverage_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_coverage_sel" ON coverage_requirements;
CREATE POLICY "anon_crud_coverage_sel" ON coverage_requirements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_coverage_ins" ON coverage_requirements;
CREATE POLICY "anon_crud_coverage_ins" ON coverage_requirements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_coverage_upd" ON coverage_requirements;
CREATE POLICY "anon_crud_coverage_upd" ON coverage_requirements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_coverage_del" ON coverage_requirements;
CREATE POLICY "anon_crud_coverage_del" ON coverage_requirements FOR DELETE TO anon, authenticated USING (true);

-- Change history (audit log)
CREATE TABLE IF NOT EXISTS change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL DEFAULT 'Administrador',
  change_date date NOT NULL DEFAULT CURRENT_DATE,
  change_time text NOT NULL,
  employee_name text NOT NULL,
  field_changed text NOT NULL,
  old_value text DEFAULT '',
  new_value text DEFAULT '',
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_history_sel" ON change_history;
CREATE POLICY "anon_crud_history_sel" ON change_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_history_ins" ON change_history;
CREATE POLICY "anon_crud_history_ins" ON change_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_history_upd" ON change_history;
CREATE POLICY "anon_crud_history_upd" ON change_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_history_del" ON change_history;
CREATE POLICY "anon_crud_history_del" ON change_history FOR DELETE TO anon, authenticated USING (true);

-- Operational alerts
CREATE TABLE IF NOT EXISTS operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  shift_group text DEFAULT '',
  date date,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_alerts_sel" ON operational_alerts;
CREATE POLICY "anon_crud_alerts_sel" ON operational_alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_alerts_ins" ON operational_alerts;
CREATE POLICY "anon_crud_alerts_ins" ON operational_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_alerts_upd" ON operational_alerts;
CREATE POLICY "anon_crud_alerts_upd" ON operational_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_alerts_del" ON operational_alerts;
CREATE POLICY "anon_crud_alerts_del" ON operational_alerts FOR DELETE TO anon, authenticated USING (true);

-- Saved filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_filters_sel" ON saved_filters;
CREATE POLICY "anon_crud_filters_sel" ON saved_filters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_filters_ins" ON saved_filters;
CREATE POLICY "anon_crud_filters_ins" ON saved_filters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_filters_upd" ON saved_filters;
CREATE POLICY "anon_crud_filters_upd" ON saved_filters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_filters_del" ON saved_filters;
CREATE POLICY "anon_crud_filters_del" ON saved_filters FOR DELETE TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_date ON shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_shift ON shift_assignments(shift_group);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_shift ON employees(shift_group);
CREATE INDEX IF NOT EXISTS idx_swaps_status ON shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_records(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_coverage_date ON coverage_requirements(date);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON operational_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_history_date ON change_history(change_date);
