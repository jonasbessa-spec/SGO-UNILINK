CREATE TABLE IF NOT EXISTS employee_esocial_data (
  employee_id uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  cpf text NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employee_esocial_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_esocial_data_dp_read ON employee_esocial_data;
CREATE POLICY employee_esocial_data_dp_read ON employee_esocial_data
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS employee_esocial_data_dp_insert ON employee_esocial_data;
CREATE POLICY employee_esocial_data_dp_insert ON employee_esocial_data
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS employee_esocial_data_dp_update ON employee_esocial_data;
CREATE POLICY employee_esocial_data_dp_update ON employee_esocial_data
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');
DROP POLICY IF EXISTS employee_esocial_data_dp_delete ON employee_esocial_data;
CREATE POLICY employee_esocial_data_dp_delete ON employee_esocial_data
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');

ALTER TABLE vacation_schedules
  ADD COLUMN IF NOT EXISTS periodo_concessivo_fim date
    GENERATED ALWAYS AS (dt_limite_maxima) STORED,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pendente';

ALTER TABLE vacation_schedules
  DROP CONSTRAINT IF EXISTS vacation_schedules_lifecycle_status_check;
ALTER TABLE vacation_schedules
  ADD CONSTRAINT vacation_schedules_lifecycle_status_check
  CHECK (status IN ('Pendente', 'Agendada', 'Em Gozo', 'Concluída'));

UPDATE vacation_schedules
SET status = CASE
  WHEN data_inicio_programada IS NULL OR data_fim_programada IS NULL THEN 'Pendente'
  WHEN data_fim_programada < current_date THEN 'Concluída'
  WHEN data_inicio_programada <= current_date THEN 'Em Gozo'
  ELSE 'Agendada'
END;

CREATE OR REPLACE FUNCTION sync_vacation_schedule_lifecycle_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.data_inicio_programada IS NULL OR NEW.data_fim_programada IS NULL THEN 'Pendente'
    WHEN NEW.data_fim_programada < current_date THEN 'Concluída'
    WHEN NEW.data_inicio_programada <= current_date THEN 'Em Gozo'
    ELSE 'Agendada'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vacation_schedules_sync_lifecycle_status ON vacation_schedules;
CREATE TRIGGER vacation_schedules_sync_lifecycle_status
  BEFORE INSERT OR UPDATE OF data_inicio_programada, data_fim_programada
  ON vacation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION sync_vacation_schedule_lifecycle_status();

CREATE TABLE IF NOT EXISTS vacation_schedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacation_schedule_id uuid REFERENCES vacation_schedules(id) ON DELETE SET NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_email text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_vacation_schedule_history_schedule_date
  ON vacation_schedule_history(vacation_schedule_id, occurred_at DESC);

ALTER TABLE vacation_schedule_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vacation_schedule_history_dp_read ON vacation_schedule_history;
CREATE POLICY vacation_schedule_history_dp_read ON vacation_schedule_history
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonas.bessa@unilinktransportes.com.br');

CREATE OR REPLACE FUNCTION record_vacation_schedule_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vacation_schedule_history (
    vacation_schedule_id, operation, actor_email, old_data, new_data
  )
  VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    COALESCE(auth.jwt() ->> 'email', 'system'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vacation_schedules_record_history ON vacation_schedules;
CREATE TRIGGER vacation_schedules_record_history
  AFTER INSERT OR UPDATE OR DELETE ON vacation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION record_vacation_schedule_history();

REVOKE ALL ON FUNCTION record_vacation_schedule_history() FROM PUBLIC;
