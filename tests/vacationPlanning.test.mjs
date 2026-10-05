import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCalendarMonths,
  addCalendarDays,
  calculateCoverageGaps,
  calculateVacationDeadline,
  calcularDataLimiteCLT,
  decodeTabularFile,
  getVacationLifecycleStatus,
  gerarProjecaoAutomatica,
  isValidCpf,
  parseVacationImport,
  planVacationPrograms,
  summarizeShiftCoverage,
  verificarMinimoOperacional,
} from '../src/lib/vacationPlanning.ts';

test('addition of calendar months clamps to target month end', () => {
  assert.equal(addCalendarMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addCalendarMonths('2024-02-29', 12), '2025-02-28');
});

test('safe deadline is 21 calendar months after the acquisition start', () => {
  assert.deepEqual(calculateVacationDeadline('2024-01-01'), {
    twentyOneMonthCap: '2025-10-01',
    legalLimit: '2025-10-01',
    safeDeadline: '2025-10-01',
  });
  assert.deepEqual(calculateVacationDeadline('2024-03-01'), {
    twentyOneMonthCap: '2025-12-01',
    legalLimit: '2025-12-01',
    safeDeadline: '2025-12-01',
  });
});

test('concession lifecycle status follows scheduled dates', () => {
  assert.equal(getVacationLifecycleStatus(null, null, '2026-10-01'), 'Pendente');
  assert.equal(getVacationLifecycleStatus('2026-10-10', '2026-10-23', '2026-10-01'), 'Agendada');
  assert.equal(getVacationLifecycleStatus('2026-09-25', '2026-10-10', '2026-10-01'), 'Em Gozo');
  assert.equal(getVacationLifecycleStatus('2026-09-01', '2026-09-14', '2026-10-01'), 'Concluída');
});

test('CPF validation accepts valid check digits and rejects repeated or invalid digits', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224724'), false);
  assert.equal(isValidCpf('11111111111'), false);
});

test('Portuguese CLT helper and capacity check use configured role and shift minimums', () => {
  assert.equal(calcularDataLimiteCLT('2024-01-31'), '2025-10-31');
  assert.deepEqual(verificarMinimoOperacional({
    data: '2026-10-01',
    funcao: ' operador ',
    plantao: ' d1 ',
    colaboradoresEscalados: ['employee-1', 'employee-2'],
    colaboradoresEmFerias: ['employee-2'],
  }, [{
    id: 'minimum-1',
    funcao: 'OPERADOR',
    plantao: 'D1',
    minimo_operacional: 1,
  }]), {
    minimoRequerido: 1,
    agendadosNoDia: 1,
    disponiveisNoDia: 1,
    valido: true,
  });
});

test('CSV/TSV parser normalizes headers and accepts multiple periods for one registration', () => {
  const text = [
    'MATRÍCULA\tNOME DO COLABORADOR\tFUNÇÃO\tÁREA\tPLANTÃO\tTURNO\tSTATUS\tPERIODO_AQUISITIVO_INICIO\tPERIODO_AQUISITIVO_FIM\tDIAS_GOZO',
    '0017\t"  maria   silva "\toperador\tpecem\td1\tdiurno\tativo\t01/01/2025\t31/12/2025\t20',
    '0017\t" maria silva "\toperador\tpecem\td1\tdiurno\tativo\t01/01/2024\t31/12/2024\t',
  ].join('\r\n');
  const rows = parseVacationImport(text);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.program));
  assert.equal(rows[0].program.employee.registration, '0017');
  assert.equal(rows[0].program.employee.name, 'MARIA SILVA');
  assert.equal(rows[0].program.employee.role, 'OPERADOR');
  assert.equal(rows[0].program.daysOff, 20);
  assert.equal(rows[1].program.daysOff, undefined);
});

test('eSocial import preserves CPF as digits and reports invalid CPF', () => {
  const text = [
    'MATRICULA;CPF;NOME;FUNCAO;SETOR;PLANTAO;TURNO;STATUS;PERIODO_AQUISITIVO_INICIO;PERIODO_AQUISITIVO_FIM',
    '0017;529.982.247-25;MARIA;OPERADOR;GATE;D1;DIURNO;ATIVO;01/01/2025;31/12/2025',
    '0018;111.111.111-11;JOSE;OPERADOR;GATE;D1;DIURNO;ATIVO;01/01/2025;31/12/2025',
  ].join('\n');
  const [valid, invalid] = parseVacationImport(text);
  assert.equal(valid.program.employee.cpf, '52998224725');
  assert.ok(valid.program);
  assert.equal(invalid.program, null);
  assert.match(invalid.errors.join(' '), /CPF inválido/);
});

test('Windows-1252 files decode correctly and missing identities are rejected', () => {
  assert.equal(decodeTabularFile(new Uint8Array([0x46, 0xe9, 0x72, 0x69, 0x61]).buffer), 'Féria');
  const text = [
    'NOME,FUNCAO,PLANTAO,STATUS,PERIODO_AQUISITIVO_INICIO,PERIODO_AQUISITIVO_FIM',
    'MARIA,OPERADOR,D1,ATIVO,01/01/2025,31/12/2025',
  ].join('\n');
  assert.throws(() => parseVacationImport(text), /Cabeçalhos obrigatórios ausentes: registration/);
});

test('imported vacation duration is inclusive and cannot cross the safe deadline', () => {
  const text = [
    'MATRICULA,NOME,FUNCAO,PLANTAO,STATUS,PERIODO_AQUISITIVO_INICIO,PERIODO_AQUISITIVO_FIM,DIAS_GOZO,DATA_INICIO_PROGRAMADA',
    '17,MARIA,OPERADOR,D1,ATIVO,01/01/2025,31/12/2025,14,01/10/2027',
  ].join('\n');
  const [row] = parseVacationImport(text);
  assert.equal(row.program, null);
  assert.match(row.errors.join(' '), /excede o limite seguro/);
});

test('a vacation segment shorter than 14 days is rejected', () => {
  const text = [
    'MATRICULA,NOME,FUNCAO,PLANTAO,STATUS,PERIODO_AQUISITIVO_INICIO,PERIODO_AQUISITIVO_FIM,DIAS_GOZO',
    '17,MARIA,OPERADOR,D1,ATIVO,01/01/2025,31/12/2025,13',
  ].join('\n');
  const [row] = parseVacationImport(text);
  assert.equal(row.program, null);
  assert.match(row.errors.join(' '), /ao menos um período mínimo de 14 dias/);
});

test('an earlier deadline supplied by DP is retained as the stricter limit', () => {
  const text = [
    'MATRICULA,NOME,FUNCAO,PLANTAO,STATUS,PERIODO_AQUISITIVO_INICIO,PERIODO_AQUISITIVO_FIM,DT_LIMITE_MAXIMA',
    '17,MARIA,OPERADOR,D1,ATIVO,01/01/2025,31/12/2025,31/05/2026',
  ].join('\n');
  const [row] = parseVacationImport(text);
  assert.equal(row.program.safeDeadline, '2026-05-31');
  assert.match(row.warnings.join(' '), /mais restritivo/);
});

function sampleProgram(id = 'program-1') {
  return {
    id,
    employee_id: 'employee-1',
    periodo_aquisitivo_inicio: '2025-10-16',
    periodo_aquisitivo_fim: '2026-10-15',
    dt_limite_maxima: '2028-07-15',
    dias_gozo: 14,
    data_inicio_programada: null,
    data_fim_programada: null,
    ajuste_manual_flag: false,
    observacao_dp: '',
  };
}

function sampleInput(overrides = {}) {
  const assignments = [];
  for (let day = 16; day <= 29; day += 1) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    assignments.push(
      { employee_id: 'employee-1', date, shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
      { employee_id: 'employee-2', date, shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
    );
  }
  return {
    programs: [sampleProgram()],
    employees: [
      { id: 'employee-1', registration: '1', name: 'ONE', role: 'OPERADOR', shift_group: 'D1', status: 'Ativo' },
      { id: 'employee-2', registration: '2', name: 'TWO', role: 'OPERADOR', shift_group: 'D1', status: 'Ativo' },
    ],
    minimums: [{ id: 'minimum-1', funcao: 'OPERADOR', plantao: 'D1', minimo_operacional: 1 }],
    assignments,
    leaves: [],
    today: '2026-10-01',
    ...overrides,
  };
}

function denseRoster(overrides = {}) {
  const input = sampleInput(overrides);
  input.assignments = [];
  for (let date = '2026-10-16'; date <= '2028-07-15'; date = addCalendarDays(date, 1)) {
    input.assignments.push(
      { employee_id: 'employee-1', date, shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
      { employee_id: 'employee-2', date, shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
    );
  }
  return input;
}

test('automatic allocation targets 30 days before the safe deadline', () => {
  const [planned] = planVacationPrograms(denseRoster());
  assert.equal(planned.status, 'PROGRAMADO');
  assert.equal(planned.start, '2028-06-15');
  assert.equal(planned.end, '2028-06-28');
});

test('automatic projection only returns unprogrammed non-manual periods', () => {
  const input = denseRoster();
  input.programs.push({
    ...sampleProgram('manual'),
    ajuste_manual_flag: true,
  }, {
    ...sampleProgram('already-scheduled'),
    data_inicio_programada: '2028-06-15',
    data_fim_programada: '2028-06-28',
  });
  const projected = gerarProjecaoAutomatica(input);
  assert.deepEqual(projected.map((item) => item.program.id), ['program-1']);
  assert.equal(projected[0].start, '2028-05-31');
});

test('automatic allocation shifts by 15-day blocks when target coverage conflicts', () => {
  const input = denseRoster({
    leaves: Array.from({ length: 14 }, (_, index) => ({
      employee_id: 'employee-2',
      start_date: addCalendarDays('2028-06-15', index),
      end_date: addCalendarDays('2028-06-15', index),
      status: 'Aprovado',
    })),
  });
  const [planned] = planVacationPrograms(input);
  assert.equal(planned.status, 'PROGRAMADO');
  assert.equal(planned.start, '2028-05-31');
  assert.equal(planned.end, '2028-06-13');
});

test('balanced suggestions spread same-group vacations across months without breaking coverage', () => {
  const input = denseRoster();
  input.programs.push({
    ...sampleProgram('program-2'),
    employee_id: 'employee-2',
  });
  const planned = planVacationPrograms({ ...input, allocationStrategy: 'balanced' });
  assert.equal(planned[0].start, '2028-06-15');
  assert.equal(planned[1].start, '2028-05-31');
  assert.ok(planned.every((item) => item.status === 'PROGRAMADO'));
});

test('coverage gap summary reports daily shortages by role and shift', () => {
  const input = sampleInput({
    minimums: [{ id: 'minimum-1', funcao: 'OPERADOR', plantao: 'D1', minimo_operacional: 2 }],
    assignments: [
      { employee_id: 'employee-1', date: '2026-10-16', shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
    ],
  });
  const gaps = calculateCoverageGaps({
    employees: input.employees,
    minimums: input.minimums,
    assignments: input.assignments,
    leaves: [],
    programs: [],
    today: input.today,
  });
  assert.deepEqual(gaps, [{
    date: '2026-10-16',
    funcao: 'OPERADOR',
    plantao: 'D1',
    disponiveis: 1,
    minimo: 2,
  }]);
});

test('daily shift summary reports available percentage, vacations, and minimum conflicts', () => {
  const employees = [
    { id: 'employee-1', registration: '1', name: 'ANA', role: 'OPERADOR', shift_group: 'D1', status: 'Ativo' },
    { id: 'employee-2', registration: '2', name: 'BIA', role: 'OPERADOR', shift_group: 'D1', status: 'Ativo' },
  ];
  const assignments = employees.map((employee) => ({
    employee_id: employee.id,
    date: '2026-10-10',
    shift_group: 'D1',
    role: 'OPERADOR',
    status: 'Escalado',
  }));
  const program = {
    ...sampleProgram(),
    employee_id: 'employee-2',
    data_inicio_programada: '2026-10-10',
    data_fim_programada: '2026-10-23',
  };
  const base = {
    date: '2026-10-10',
    employees,
    assignments,
    leaves: [],
    programs: [program],
  };
  const [covered] = summarizeShiftCoverage({
    ...base,
    minimums: [{ id: 'min-1', funcao: 'OPERADOR', plantao: 'D1', minimo_operacional: 1 }],
  });
  assert.deepEqual({
    escalados: covered.escalados,
    disponiveis: covered.disponiveis,
    emFerias: covered.emFerias,
    percentualAtivo: covered.percentualAtivo,
    status: covered.status,
  }, { escalados: 2, disponiveis: 1, emFerias: 1, percentualAtivo: 50, status: 'OK' });

  const [conflict] = summarizeShiftCoverage({
    ...base,
    minimums: [{ id: 'min-1', funcao: 'OPERADOR', plantao: 'D1', minimo_operacional: 2 }],
  });
  assert.equal(conflict.status, 'CONFLITO');
  assert.equal(conflict.disponiveis, 1);
});

test('allocation stays pending without a configured minimum or daily roster', () => {
  const [withoutMinimum] = planVacationPrograms(sampleInput({ minimums: [] }));
  assert.equal(withoutMinimum.status, 'PENDENTE');
  assert.match(withoutMinimum.message, /Mínimo de cobertura não configurado/);

  const [withoutRoster] = planVacationPrograms(sampleInput({ assignments: [] }));
  assert.equal(withoutRoster.status, 'PENDENTE');
  assert.match(withoutRoster.message, /Sem escala\/efetivo diário/);
});

test('a legacy vacation start without its end blocks new allocations until the range is recorded', () => {
  const input = sampleInput();
  input.employees[0].vacation_2026 = '2026-01-01';
  const [planned] = planVacationPrograms(input);
  assert.equal(planned.status, 'PENDENTE');
  assert.match(planned.message, /Férias legadas em 2026-01-01 sem data final/);

  const [resolved] = planVacationPrograms({
    ...input,
    leaves: [{ employee_id: 'employee-1', start_date: '2026-01-01', end_date: '2026-01-20', status: 'Aprovado' }],
  });
  assert.equal(resolved.status, 'PROGRAMADO');
});

test('manual dates that violate coverage are conflicts, never automatic bypasses', () => {
  const program = {
    ...sampleProgram(),
    data_inicio_programada: '2026-10-16',
    data_fim_programada: '2026-10-29',
    ajuste_manual_flag: true,
  };
  const input = sampleInput({
    programs: [program],
    assignments: [
      { employee_id: 'employee-1', date: '2026-10-16', shift_group: 'D1', role: 'OPERADOR', status: 'Escalado' },
      ...Array.from({ length: 14 }, (_, index) => ({
        employee_id: 'employee-1',
        date: `2026-10-${String(16 + index).padStart(2, '0')}`,
        shift_group: 'D1',
        role: 'OPERADOR',
        status: 'Escalado',
      })),
    ],
  });
  const [planned] = planVacationPrograms(input);
  assert.equal(planned.status, 'CONFLITO');
  assert.match(planned.message, /Cobertura insuficiente/);

  const shortManual = {
    ...program,
    data_fim_programada: '2026-10-28',
    dias_gozo: 13,
  };
  const [shortResult] = planVacationPrograms(sampleInput({ programs: [shortManual] }));
  assert.equal(shortResult.status, 'CONFLITO');
  assert.match(shortResult.message, /ao menos um período com 14 dias/);
});
