-- Vacation entitlements and configurable staffing floors are additive to SHIFT MASTER.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS shift_type text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS vacation_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  dt_limite_maxima date NOT NULL,
  dias_gozo integer CHECK (dias_gozo IS NULL OR dias_gozo BETWEEN 1 AND 365),
  data_inicio_programada date,
  data_fim_programada date,
  ajuste_manual_flag boolean NOT NULL DEFAULT false,
  observacao_dp text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacation_programs_period_order
    CHECK (periodo_aquisitivo_inicio <= periodo_aquisitivo_fim),
  CONSTRAINT vacation_programs_scheduled_order
    CHECK (data_inicio_programada IS NULL OR data_fim_programada IS NULL OR data_inicio_programada <= data_fim_programada),
  CONSTRAINT vacation_programs_unique_period
    UNIQUE (employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim)
);

CREATE INDEX IF NOT EXISTS idx_vacation_programs_deadline
  ON vacation_programs(dt_limite_maxima);
CREATE INDEX IF NOT EXISTS idx_vacation_programs_employee
  ON vacation_programs(employee_id);

CREATE TABLE IF NOT EXISTS vacation_coverage_minima (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  shift_group text NOT NULL,
  min_count integer NOT NULL CHECK (min_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacation_coverage_minima_unique_role_shift UNIQUE (role, shift_group)
);

ALTER TABLE vacation_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_coverage_minima ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_vacation_programs_sel" ON vacation_programs;
CREATE POLICY "anon_crud_vacation_programs_sel" ON vacation_programs
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_vacation_programs_ins" ON vacation_programs;
CREATE POLICY "anon_crud_vacation_programs_ins" ON vacation_programs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_vacation_programs_upd" ON vacation_programs;
CREATE POLICY "anon_crud_vacation_programs_upd" ON vacation_programs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_vacation_programs_del" ON vacation_programs;
CREATE POLICY "anon_crud_vacation_programs_del" ON vacation_programs
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_crud_vacation_minima_sel" ON vacation_coverage_minima;
CREATE POLICY "anon_crud_vacation_minima_sel" ON vacation_coverage_minima
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_vacation_minima_ins" ON vacation_coverage_minima;
CREATE POLICY "anon_crud_vacation_minima_ins" ON vacation_coverage_minima
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_vacation_minima_upd" ON vacation_coverage_minima;
CREATE POLICY "anon_crud_vacation_minima_upd" ON vacation_coverage_minima
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_vacation_minima_del" ON vacation_coverage_minima;
CREATE POLICY "anon_crud_vacation_minima_del" ON vacation_coverage_minima
  FOR DELETE TO anon, authenticated USING (true);
