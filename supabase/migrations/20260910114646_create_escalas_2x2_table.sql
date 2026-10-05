/*
# Create escalas_2x2 table for 2x2 shift cycle visualization

## Purpose
Stores per-employee, per-day 2x2 shift cycle entries derived from the ESCALA_2X2.txt
file. Each row links an employee to a specific date with a day-status (Trabalho/Folga)
and the shift group (D1/D2/N1/N2) they belong to.

## New Tables
1. **escalas_2x2**
   - id (uuid, primary key)
   - colaborador_id (uuid, foreign key to employees.id, ON DELETE CASCADE)
   - data (date, not null) — the calendar date
   - tipo_escala (text, not null, default '2x2') — scale type
   - status_dia (text, not null) — 'Trabalho' or 'Folga'
   - shift_group (text, not null) — 'D1', 'D2', 'N1', 'N2'
   - coordenador (text) — coordinator name from escala file
   - observacao (text) — optional note
   - created_at (timestamptz)

## Indexes
- Composite unique on (colaborador_id, data) to prevent duplicate entries
- Index on data for date-range queries
- Index on shift_group for filtering

## Security
- RLS enabled, single-tenant (no auth) — anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS escalas_2x2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo_escala text NOT NULL DEFAULT '2x2',
  status_dia text NOT NULL,
  shift_group text NOT NULL,
  coordenador text DEFAULT '',
  observacao text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE escalas_2x2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_escalas_sel" ON escalas_2x2;
CREATE POLICY "anon_crud_escalas_sel" ON escalas_2x2 FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_crud_escalas_ins" ON escalas_2x2;
CREATE POLICY "anon_crud_escalas_ins" ON escalas_2x2 FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_crud_escalas_upd" ON escalas_2x2;
CREATE POLICY "anon_crud_escalas_upd" ON escalas_2x2 FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_crud_escalas_del" ON escalas_2x2;
CREATE POLICY "anon_crud_escalas_del" ON escalas_2x2 FOR DELETE
  TO anon, authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_escalas_2x2_emp_date
  ON escalas_2x2 (colaborador_id, data);

CREATE INDEX IF NOT EXISTS idx_escalas_2x2_data ON escalas_2x2 (data);
CREATE INDEX IF NOT EXISTS idx_escalas_2x2_shift ON escalas_2x2 (shift_group);
