-- Align vacation programming with the application contract and protect writes with Supabase Auth.
CREATE TABLE IF NOT EXISTS vacation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  dt_limite_maxima date NOT NULL,
  dias_gozo integer NOT NULL DEFAULT 30 CHECK (dias_gozo BETWEEN 5 AND 30),
  data_inicio_programada date,
  data_fim_programada date,
  ajuste_manual_flag boolean NOT NULL DEFAULT false,
  observacao_dp text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vacation_schedules_period_order
    CHECK (periodo_aquisitivo_inicio <= periodo_aquisitivo_fim),
  CONSTRAINT vacation_schedules_scheduled_order
    CHECK (data_inicio_programada IS NULL OR data_fim_programada IS NULL OR data_inicio_programada <= data_fim_programada),
  CONSTRAINT vacation_schedules_unique_period
    UNIQUE (employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim)
);

CREATE INDEX IF NOT EXISTS idx_vacation_schedules_deadline
  ON vacation_schedules(dt_limite_maxima);
CREATE INDEX IF NOT EXISTS idx_vacation_schedules_employee
  ON vacation_schedules(employee_id);

CREATE TABLE IF NOT EXISTS vacation_coverage_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao text NOT NULL,
  plantao text NOT NULL,
  minimo_operacional integer NOT NULL DEFAULT 1 CHECK (minimo_operacional >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vacation_coverage_bases_unique_role_shift UNIQUE (funcao, plantao)
);

-- Preserve existing schedules and coverage rules from the earlier module schema.
DO $$
BEGIN
  IF to_regclass('public.vacation_programs') IS NOT NULL THEN
    INSERT INTO vacation_schedules (
      employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, dt_limite_maxima,
      dias_gozo, data_inicio_programada, data_fim_programada, ajuste_manual_flag,
      observacao_dp, created_at, updated_at
    )
    SELECT
      employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, dt_limite_maxima,
      COALESCE(dias_gozo, 30), data_inicio_programada, data_fim_programada,
      ajuste_manual_flag, observacao_dp, created_at, updated_at
    FROM public.vacation_programs
    ON CONFLICT (employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim) DO NOTHING;
  END IF;

  IF to_regclass('public.vacation_coverage_minima') IS NOT NULL THEN
    INSERT INTO vacation_coverage_bases (funcao, plantao, minimo_operacional)
    SELECT role, shift_group, min_count
    FROM public.vacation_coverage_minima
    ON CONFLICT (funcao, plantao) DO NOTHING;
  END IF;
END
$$;

ALTER TABLE vacation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_coverage_bases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vacation_schedules_read ON vacation_schedules;
CREATE POLICY vacation_schedules_read ON vacation_schedules
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS vacation_schedules_dp_insert ON vacation_schedules;
CREATE POLICY vacation_schedules_dp_insert ON vacation_schedules
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS vacation_schedules_dp_update ON vacation_schedules;
CREATE POLICY vacation_schedules_dp_update ON vacation_schedules
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS vacation_schedules_dp_delete ON vacation_schedules;
CREATE POLICY vacation_schedules_dp_delete ON vacation_schedules
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');

DROP POLICY IF EXISTS vacation_coverage_bases_read ON vacation_coverage_bases;
CREATE POLICY vacation_coverage_bases_read ON vacation_coverage_bases
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS vacation_coverage_bases_dp_insert ON vacation_coverage_bases;
CREATE POLICY vacation_coverage_bases_dp_insert ON vacation_coverage_bases
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS vacation_coverage_bases_dp_update ON vacation_coverage_bases;
CREATE POLICY vacation_coverage_bases_dp_update ON vacation_coverage_bases
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS vacation_coverage_bases_dp_delete ON vacation_coverage_bases;
CREATE POLICY vacation_coverage_bases_dp_delete ON vacation_coverage_bases
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');

-- Restrict the retired tables too, so legacy API routes cannot bypass the same access rule.
DO $$
DECLARE
  legacy_table text;
  operation text;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY['vacation_programs', 'vacation_coverage_minima'] LOOP
    IF to_regclass(format('public.%I', legacy_table)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "anon_crud_%s_sel" ON public.%I', CASE WHEN legacy_table = 'vacation_programs' THEN 'vacation_programs' ELSE 'vacation_minima' END, legacy_table);
      FOREACH operation IN ARRAY ARRAY['ins', 'upd', 'del'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "anon_crud_%s_%s" ON public.%I', CASE WHEN legacy_table = 'vacation_programs' THEN 'vacation_programs' ELSE 'vacation_minima' END, operation, legacy_table);
      END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS vacation_legacy_read ON public.%I', legacy_table);
      EXECUTE format('CREATE POLICY vacation_legacy_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', legacy_table);
      EXECUTE format('DROP POLICY IF EXISTS vacation_legacy_dp_insert ON public.%I', legacy_table);
      EXECUTE format('CREATE POLICY vacation_legacy_dp_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> ''email'') = ''jonas.bessa@unilinktransportes.com.br'')', legacy_table);
      EXECUTE format('DROP POLICY IF EXISTS vacation_legacy_dp_update ON public.%I', legacy_table);
      EXECUTE format('CREATE POLICY vacation_legacy_dp_update ON public.%I FOR UPDATE TO authenticated USING ((auth.jwt() ->> ''email'') = ''jonas.bessa@unilinktransportes.com.br'') WITH CHECK ((auth.jwt() ->> ''email'') = ''jonas.bessa@unilinktransportes.com.br'')', legacy_table);
      EXECUTE format('DROP POLICY IF EXISTS vacation_legacy_dp_delete ON public.%I', legacy_table);
      EXECUTE format('CREATE POLICY vacation_legacy_dp_delete ON public.%I FOR DELETE TO authenticated USING ((auth.jwt() ->> ''email'') = ''jonas.bessa@unilinktransportes.com.br'')', legacy_table);
    END IF;
  END LOOP;
END
$$;
