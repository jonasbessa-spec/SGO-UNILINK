/*
# SHIFT MASTER — Seed Data for Port Operations

## Purpose
Populates all SHIFT MASTER tables with realistic port operations data based on the SGO dashboard metrics:
- 451 total employees (409 active, 23 on vacation, 19 absent)
- 4 shift groups: DIA-A, DIA-C, NOITE-B, NOITE-D, plus ROTATIVO
- Sectors: TMUT/NAVIO (70%), PÁTIO (24%), Outros (6%)
- Baseline coverage: DIA-A=92, DIA-C=92, NOITE-B=85, NOITE-D=87, ROTATIVO=—

## Data Inserted
1. shift_scales — 5 scale configurations (4 fixed + 1 rotativo)
2. employees — 60 representative employees across all shifts/sectors/roles
3. shift_assignments — 7 days of assignments for all active employees
4. shift_swaps — 6 swap requests in various states
5. leave_records — 15 leave records (vacations + absences)
6. coverage_requirements — 7 days of coverage data per shift/role
7. change_history — 10 historical change records
8. operational_alerts — 8 operational alerts
*/

-- 1. Shift scale configurations
INSERT INTO shift_scales (name, type, start_time, end_time, break_minutes, work_days, off_days, shift_group, start_date, is_active) VALUES
('Escala DIA - A (12x36 Diurno)', '12x36', '06:00', '18:00', 120, 1, 1, 'DIA - A', '2026-01-01', true),
('Escala DIA - C (12x36 Diurno)', '12x36', '06:00', '18:00', 120, 1, 1, 'DIA - C', '2026-01-01', true),
('Escala NOITE - B (12x36 Noturno)', '12x36', '18:00', '06:00', 120, 1, 1, 'NOITE - B', '2026-01-01', true),
('Escala NOITE - D (12x36 Noturno)', '12x36', '18:00', '06:00', 120, 1, 1, 'NOITE - D', '2026-01-01', true),
('Escala ROTATIVO', 'Rotativo', '07:00', '17:00', 60, 5, 2, 'ROTATIVO', '2026-01-01', true)
ON CONFLICT DO NOTHING;

-- 2. Employees — 60 representative employees
-- Using a DO block to generate employees programmatically
DO $$
DECLARE
  v_names_dia_a text[] := ARRAY['João da Silva','Maria Oliveira','Carlos Eduardo Souza','Ana Paula Costa','Roberto Lima','Fernanda Alves','Paulo Henrique Rocha','Juliana Ferreira','Marcos Vieira','Patrícia Gomes','Ricardo Nogueira','Sandra Brito','Eduardo Martins','Lúcia Ramos','Felipe Cardoso'];
  v_names_dia_c text[] := ARRAY['Bruno Carvalho','Camila Duarte','Diego Fernandes','Eliane Pinto','Gabriel Machado','Helena Castro','Igor Barbosa','Jéssica Moura','Leandro Pires','Marina Dias','Nelson Freitas','Olívia Teixeira','Pedro Vasconcelos','Renata Lobo','Tiago Moreira'];
  v_names_noite_b text[] := ARRAY['Adriano Silva','Beatriz Nunes','Cristiano Avelar','Daniela Prado','Emerson Cruz','Fabiana Rocha','Gustavo Henrique','Heloísa Marques','Ivan Cordeiro','Jussara Leal','Kleber Andrade','Larissa Bittencourt','Murilo Fontes','Natália Cunha','Otávio Resende'];
  v_names_noite_d text[] := ARRAY['Paula Siqueira','Queiroz Bento','Rafael Tavares','Sônia Macedo','Thiago Aguiar','Ursula Pinheiro','Valdir Sá','Walkíria Borges','Xavier Monteiro','Yara Neves','Ziraldo Campos','Aline Ferraz','Breno Gusmão','Cássia Rebelo','Dário Peixoto'];
  v_names_rot text[] := ARRAY['Evandro Lopes','Flávia Marçal','Gisele Porto','Hélder Quintas'];
  v_roles text[] := ARRAY['Operador','Motorista','Conferente','Técnico','Inspetor','Líder','Supervisor'];
  v_sectors text[] := ARRAY['TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','TMUT/NAVIO','PÁTIO','PÁTIO','PÁTIO','Outros','Outros'];
  v_id uuid;
  v_reg integer := 1001;
  v_shift text;
  v_st_start text;
  v_st_end text;
  v_st_type text;
  v_role text;
  v_sector text;
  v_status text;
  v_hire date;
  v_i integer;
  v_j integer;
BEGIN
  -- DIA - A
  FOR v_i IN 1..15 LOOP
    v_shift := 'DIA - A'; v_st_start := '06:00'; v_st_end := '18:00'; v_st_type := 'Diurno';
    v_role := v_roles[1 + (v_i % 7)]; v_sector := v_sectors[1 + (v_i % 13)];
    v_status := CASE WHEN v_i IN (3,7) THEN 'Férias' WHEN v_i = 11 THEN 'Afastado' ELSE 'Ativo' END;
    v_hire := (DATE '2020-01-01') + (v_i * 37);
    INSERT INTO employees (name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes)
    VALUES (v_names_dia_a[v_i], v_reg::text, v_role, v_sector, v_shift, v_st_start, v_st_end, v_status, v_hire,
      CASE WHEN v_status = 'Ativo' THEN 'Em escala' WHEN v_status = 'Férias' THEN 'Em férias' ELSE 'Afastado' END, '')
    RETURNING id INTO v_id;
    v_reg := v_reg + 1;
  END LOOP;

  -- DIA - C
  FOR v_i IN 1..15 LOOP
    v_shift := 'DIA - C'; v_st_start := '06:00'; v_st_end := '18:00'; v_st_type := 'Diurno';
    v_role := v_roles[1 + (v_i % 7)]; v_sector := v_sectors[1 + ((v_i+3) % 13)];
    v_status := CASE WHEN v_i IN (5,9) THEN 'Férias' WHEN v_i = 2 THEN 'Afastado' ELSE 'Ativo' END;
    v_hire := (DATE '2019-06-01') + (v_i * 41);
    INSERT INTO employees (name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes)
    VALUES (v_names_dia_c[v_i], v_reg::text, v_role, v_sector, v_shift, v_st_start, v_st_end, v_status, v_hire,
      CASE WHEN v_status = 'Ativo' THEN 'Em escala' WHEN v_status = 'Férias' THEN 'Em férias' ELSE 'Afastado' END, '')
    RETURNING id INTO v_id;
    v_reg := v_reg + 1;
  END LOOP;

  -- NOITE - B
  FOR v_i IN 1..15 LOOP
    v_shift := 'NOITE - B'; v_st_start := '18:00'; v_st_end := '06:00'; v_st_type := 'Noturno';
    v_role := v_roles[1 + (v_i % 7)]; v_sector := v_sectors[1 + ((v_i+5) % 13)];
    v_status := CASE WHEN v_i IN (4,12) THEN 'Férias' WHEN v_i = 8 THEN 'Afastado' ELSE 'Ativo' END;
    v_hire := (DATE '2021-03-01') + (v_i * 29);
    INSERT INTO employees (name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes)
    VALUES (v_names_noite_b[v_i], v_reg::text, v_role, v_sector, v_shift, v_st_start, v_st_end, v_status, v_hire,
      CASE WHEN v_status = 'Ativo' THEN 'Em escala' WHEN v_status = 'Férias' THEN 'Em férias' ELSE 'Afastado' END, '')
    RETURNING id INTO v_id;
    v_reg := v_reg + 1;
  END LOOP;

  -- NOITE - D
  FOR v_i IN 1..15 LOOP
    v_shift := 'NOITE - D'; v_st_start := '18:00'; v_st_end := '06:00'; v_st_type := 'Noturno';
    v_role := v_roles[1 + (v_i % 7)]; v_sector := v_sectors[1 + ((v_i+7) % 13)];
    v_status := CASE WHEN v_i IN (6,14) THEN 'Férias' WHEN v_i = 10 THEN 'Afastado' ELSE 'Ativo' END;
    v_hire := (DATE '2018-09-01') + (v_i * 53);
    INSERT INTO employees (name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes)
    VALUES (v_names_noite_d[v_i], v_reg::text, v_role, v_sector, v_shift, v_st_start, v_st_end, v_status, v_hire,
      CASE WHEN v_status = 'Ativo' THEN 'Em escala' WHEN v_status = 'Férias' THEN 'Em férias' ELSE 'Afastado' END, '')
    RETURNING id INTO v_id;
    v_reg := v_reg + 1;
  END LOOP;

  -- ROTATIVO
  FOR v_i IN 1..4 LOOP
    v_shift := 'ROTATIVO'; v_st_start := '07:00'; v_st_end := '17:00'; v_st_type := 'Comercial';
    v_role := v_roles[1 + (v_i % 7)]; v_sector := 'Outros';
    v_status := 'Ativo';
    v_hire := (DATE '2022-01-01') + (v_i * 100);
    INSERT INTO employees (name, registration, role, sector, shift_group, schedule_start, schedule_end, status, hire_date, scale_status, notes)
    VALUES (v_names_rot[v_i], v_reg::text, v_role, v_sector, v_shift, v_st_start, v_st_end, v_status, v_hire, 'Em escala', '')
    RETURNING id INTO v_id;
    v_reg := v_reg + 1;
  END LOOP;
END $$;

-- 3. Shift assignments — generate 7 days (Sep 1-7, 2026) for all active employees
DO $$
DECLARE
  emp RECORD;
  v_date date;
  v_status text;
  v_day_offset integer;
  v_shift_on boolean;
  v_team text;
BEGIN
  FOR emp IN SELECT id, shift_group, schedule_start, schedule_end, role, status FROM employees WHERE status = 'Ativo' LOOP
    FOR v_day_offset IN 0..6 LOOP
      v_date := DATE '2026-09-01' + v_day_offset;
      -- 12x36: alternate work/off based on day offset and shift group parity
      v_shift_on := CASE
        WHEN emp.shift_group = 'DIA - A' THEN (v_day_offset % 2 = 0)
        WHEN emp.shift_group = 'DIA - C' THEN (v_day_offset % 2 = 1)
        WHEN emp.shift_group = 'NOITE - B' THEN (v_day_offset % 2 = 0)
        WHEN emp.shift_group = 'NOITE - D' THEN (v_day_offset % 2 = 1)
        WHEN emp.shift_group = 'ROTATIVO' THEN (v_day_offset < 5)
        ELSE true
      END;
      v_status := CASE WHEN v_shift_on THEN 'Escalado' ELSE 'Folga' END;
      v_team := CASE
        WHEN emp.shift_group = 'DIA - A' THEN 'Equipe A'
        WHEN emp.shift_group = 'DIA - C' THEN 'Equipe C'
        WHEN emp.shift_group = 'NOITE - B' THEN 'Equipe B'
        WHEN emp.shift_group = 'NOITE - D' THEN 'Equipe D'
        ELSE 'Rotativo'
      END;
      INSERT INTO shift_assignments (employee_id, date, shift_group, shift_type, start_time, end_time, role, team, status, notes)
      VALUES (emp.id, v_date, emp.shift_group,
        CASE WHEN emp.shift_group LIKE 'NOITE%' THEN 'Noturno' WHEN emp.shift_group = 'ROTATIVO' THEN 'Comercial' ELSE 'Diurno' END,
        emp.schedule_start, emp.schedule_end, emp.role, v_team, v_status, '');
    END LOOP;
  END LOOP;
END $$;

-- 4. Shift swaps
INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, e2.id, '2026-09-03', '2026-09-04', 'DIA - A', 'DIA - A', 'Motivo pessoal', 'Administrador', 'Aprovada', ''
FROM employees e1, employees e2
WHERE e1.shift_group = 'DIA - A' AND e2.shift_group = 'DIA - A'
AND e1.name = 'João da Silva' AND e2.name = 'Maria Oliveira' LIMIT 1;

INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, e2.id, '2026-09-05', '2026-09-06', 'NOITE - B', 'NOITE - B', 'Compensação de horas', 'Gestor', 'Pendente', ''
FROM employees e1, employees e2
WHERE e1.shift_group = 'NOITE - B' AND e2.shift_group = 'NOITE - B'
AND e1.name = 'Adriano Silva' AND e2.name = 'Beatriz Nunes' LIMIT 1;

INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, e2.id, '2026-09-02', '2026-09-03', 'DIA - C', 'DIA - C', 'Consulta médica', '', 'Pendente', ''
FROM employees e1, employees e2
WHERE e1.shift_group = 'DIA - C' AND e2.shift_group = 'DIA - C'
AND e1.name = 'Bruno Carvalho' AND e2.name = 'Camila Duarte' LIMIT 1;

INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, e2.id, '2026-09-04', '2026-09-05', 'NOITE - D', 'NOITE - D', 'Troca de plantão', 'Gestor', 'Recusada', 'Conflito: substituto em folga'
FROM employees e1, employees e2
WHERE e1.shift_group = 'NOITE - D' AND e2.shift_group = 'NOITE - D'
AND e1.name = 'Paula Siqueira' AND e2.name = 'Queiroz Bento' LIMIT 1;

INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, e2.id, '2026-09-06', '2026-09-07', 'DIA - A', 'DIA - A', 'Evento familiar', 'Administrador', 'Aprovada', ''
FROM employees e1, employees e2
WHERE e1.shift_group = 'DIA - A' AND e2.shift_group = 'DIA - A'
AND e1.name = 'Carlos Eduardo Souza' AND e2.name = 'Ana Paula Costa' LIMIT 1;

INSERT INTO shift_swaps (requester_id, substitute_id, original_date, swap_date, original_shift, new_shift, reason, approver, status, conflict_flags)
SELECT e1.id, NULL, '2026-09-07', '2026-09-08', 'DIA - C', 'DIA - C', 'Aguardando substituto', '', 'Cancelada', ''
FROM employees e1
WHERE e1.shift_group = 'DIA - C' AND e1.name = 'Diego Fernandes' LIMIT 1;

-- 5. Leave records (vacations + absences)
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-01', '2026-09-30', 'Férias programadas - 30 dias', 'Aprovado' FROM employees WHERE name = 'Carlos Eduardo Souza' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-01', '2026-09-20', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Paulo Henrique Rocha' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-05', '2026-09-24', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Eliane Pinto' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-03', '2026-09-22', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Camila Duarte' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-01', '2026-09-15', 'Férias programadas - 15 dias', 'Aprovado' FROM employees WHERE name = 'Daniela Prado' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-08', '2026-09-27', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Murilo Fontes' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-02', '2026-09-21', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Natália Cunha' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-10', '2026-09-29', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Sônia Macedo' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-01', '2026-09-19', 'Férias programadas - 19 dias', 'Aprovado' FROM employees WHERE name = 'Thiago Aguiar' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Férias', '2026-09-15', '2026-10-04', 'Férias programadas - 20 dias', 'Aprovado' FROM employees WHERE name = 'Ursula Pinheiro' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Afastamento', '2026-09-01', '2026-09-10', 'Afastamento médico', 'Aprovado' FROM employees WHERE name = 'Ricardo Nogueira' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Afastamento', '2026-09-01', '2026-09-15', 'Afastamento médico - 15 dias', 'Aprovado' FROM employees WHERE name = 'Nelson Freitas' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Afastamento', '2026-09-03', '2026-09-08', 'Afastamento por acidente de trabalho', 'Aprovado' FROM employees WHERE name = 'Ivan Cordeiro' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Licença', '2026-09-05', '2026-09-12', 'Licença paternidade', 'Aprovado' FROM employees WHERE name = 'Xavier Monteiro' LIMIT 1;
INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, notes, status)
SELECT id, 'Folga Programada', '2026-09-10', '2026-09-10', 'Folga compensatória', 'Aprovado' FROM employees WHERE name = 'João da Silva' LIMIT 1;

-- 6. Coverage requirements — 7 days for each shift group
DO $$
DECLARE
  v_date date;
  v_day integer;
  v_shifts text[] := ARRAY['DIA - A','DIA - C','NOITE - B','NOITE - D','ROTATIVO'];
  v_roles text[] := ARRAY['Operador','Motorista','Conferente','Técnico','Inspetor','Líder','Supervisor'];
  v_req integer;
  v_assigned integer;
  v_baseline jsonb := '{"DIA - A":92,"DIA - C":92,"NOITE - B":85,"NOITE - D":87,"ROTATIVO":0}'::jsonb;
  v_actual jsonb := '{"DIA - A":91,"DIA - C":95,"NOITE - B":91,"NOITE - D":90,"ROTATIVO":53}'::jsonb;
  v_shift text;
  v_role text;
  v_i integer;
  v_j integer;
BEGIN
  FOR v_i IN 1..5 LOOP
    v_shift := v_shifts[v_i];
    FOR v_day IN 0..6 LOOP
      v_date := DATE '2026-09-01' + v_day;
      FOR v_j IN 1..7 LOOP
        v_role := v_roles[v_j];
        v_req := CASE
          WHEN v_role = 'Operador' THEN 20
          WHEN v_role = 'Motorista' THEN 15
          WHEN v_role = 'Conferente' THEN 12
          WHEN v_role = 'Técnico' THEN 8
          WHEN v_role = 'Inspetor' THEN 5
          WHEN v_role = 'Líder' THEN 3
          WHEN v_role = 'Supervisor' THEN 2
          ELSE 1
        END;
        v_assigned := CASE WHEN v_shift = 'ROTATIVO' THEN v_req - 1 ELSE v_req - (v_day % 3) END;
        INSERT INTO coverage_requirements (date, shift_group, role, required_count, assigned_count)
        VALUES (v_date, v_shift, v_role, v_req, GREATEST(0, v_assigned))
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 7. Change history
INSERT INTO change_history (user_name, change_date, change_time, employee_name, field_changed, old_value, new_value, reason) VALUES
('Administrador', '2026-09-08', '14:20', 'João da Silva', 'Plantão', 'Diurno', 'Noturno', 'Ajuste operacional'),
('Gestor', '2026-09-08', '11:05', 'Maria Oliveira', 'Status', 'Escalado', 'Folga', 'Solicitação pessoal'),
('Administrador', '2026-09-07', '16:45', 'Carlos Eduardo Souza', 'Férias', '—', 'Férias 01/09 a 30/09', 'Férias programadas'),
('Supervisor', '2026-09-07', '09:30', 'Ana Paula Costa', 'Função', 'Operador', 'Líder', 'Promoção temporária'),
('Administrador', '2026-09-06', '18:10', 'Roberto Lima', 'Plantão', 'DIA - A', 'DIA - C', 'Transferência de equipe'),
('Gestor', '2026-09-06', '14:55', 'Fernanda Alves', 'Troca', '—', 'Troca com Patrícia Gomes', 'Troca aprovada'),
('Administrador', '2026-09-05', '10:20', 'Paulo Henrique Rocha', 'Férias', '—', 'Férias 01/09 a 20/09', 'Férias programadas'),
('Supervisor', '2026-09-04', '15:40', 'Marcos Vieira', 'Status', 'Escalado', 'Falta', 'Falta justificada'),
('Administrador', '2026-09-03', '08:15', 'Patrícia Gomes', 'Observação', '—', 'Atraso de 15 minutos', 'Registro de ocorrência'),
('Gestor', '2026-09-02', '13:25', 'Ricardo Nogueira', 'Afastamento', '—', 'Afastamento médico 10 dias', 'Atestado médico');

-- 8. Operational alerts
INSERT INTO operational_alerts (alert_type, severity, title, description, employee_id, shift_group, date, is_resolved) VALUES
('Desfalque', 'danger', 'Plantão DIA - A com déficit', 'Plantão DIA - A está com 1 colaborador abaixo do baseline', NULL, 'DIA - A', '2026-09-08', false),
('Troca Pendente', 'warning', 'Troca pendente de aprovação', 'Adriano Silva solicitou troca com Beatriz Nunes', NULL, 'NOITE - B', '2026-09-08', false),
('Troca Pendente', 'warning', 'Troca pendente de aprovação', 'Bruno Carvalho solicitou troca com Camila Duarte', NULL, 'DIA - C', '2026-09-08', false),
('Função sem Cobertura', 'danger', 'Supervisor sem cobertura no NOITE - D', 'Função de Supervisor sem substituto no plantão NOITE - D', NULL, 'NOITE - D', '2026-09-08', false),
('Colaborador em Férias', 'warning', 'Colaborador escalado durante férias', 'Carlos Eduardo Souza está em férias mas possui escala ativa', NULL, 'DIA - A', '2026-09-08', false),
('Excesso de Colaboradores', 'info', 'Excesso no plantão DIA - C', 'Plantão DIA - C está com 3 colaboradores acima do baseline', NULL, 'DIA - C', '2026-09-08', false),
('Conflito de Escala', 'warning', 'Possível conflito de escala', 'Fernanda Alves possui dois plantões no mesmo período', NULL, 'DIA - A', '2026-09-08', false),
('Alteração Não Aprovada', 'warning', 'Alteração de escala não aprovada', 'Alteração de plantão de Marcos Vieira pendente de aprovação', NULL, 'DIA - A', '2026-09-08', false);
