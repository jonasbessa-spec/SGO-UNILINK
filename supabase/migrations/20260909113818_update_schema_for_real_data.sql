/*
# SHIFT MASTER — Schema Update for Real 2x2 Operational Data

## Purpose
Adds columns to support the real operational structure from DADOS_GERAIS and ESCALA spreadsheets:
- Coordinator (COORDENADOR), direct leader (LIDER DIRETO), manager (GESTOR)
- Vacation dates for 2026 and 2027
- Absence indicator and observation notes
- Shift schedule table mapping dates to shift codes (D1/D2/N1/N2) with coordinators

## Changes

### Modified Tables
1. **employees** — Added columns:
   - coordinator (text) — e.g. "FCO. AGILEU", "MARCOS PETÓ", "RENATO ARLES", "ROMULO DIAS"
   - leader (text) — LIDER DIRETO field
   - manager (text) — GESTOR field
   - vacation_2026 (date) — FÉRIAS 2026 start date
   - vacation_2027 (date) — FÉRIAS 2027 start date
   - absence_reason (text) — e.g. "INSS", "PRESÍDIO", "SINDICATO", "DESLIGAR"
   - is_absent (boolean) — AFASTADO SIM flag

2. **shift_scales** — Added column:
   - shift_code (text) — e.g. "D1", "D2", "N1", "N2", "ROTATIVO", "COMERCIAL"

### New Tables
3. **shift_schedule** — Daily shift schedule mapping (from ESCALA_2X2.txt)
   - id, date, shift_code, shift_type (Diurno/Noturno), coordinator, created_at

## Security
- RLS enabled on new table with anon+authenticated full CRUD (single-tenant).
*/

-- Add columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS coordinator text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS leader text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_2026 date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_2027 date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS absence_reason text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_absent boolean DEFAULT false;

-- Add shift_code to shift_scales
ALTER TABLE shift_scales ADD COLUMN IF NOT EXISTS shift_code text DEFAULT '';

-- Create shift_schedule table
CREATE TABLE IF NOT EXISTS shift_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  shift_code text NOT NULL,
  shift_type text NOT NULL DEFAULT 'Diurno',
  coordinator text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shift_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_schedule_sel" ON shift_schedule;
CREATE POLICY "anon_crud_schedule_sel" ON shift_schedule FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_schedule_ins" ON shift_schedule;
CREATE POLICY "anon_crud_schedule_ins" ON shift_schedule FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_schedule_upd" ON shift_schedule;
CREATE POLICY "anon_crud_schedule_upd" ON shift_schedule FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_schedule_del" ON shift_schedule;
CREATE POLICY "anon_crud_schedule_del" ON shift_schedule FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_schedule_date ON shift_schedule(date);
CREATE INDEX IF NOT EXISTS idx_schedule_shift ON shift_schedule(shift_code);
