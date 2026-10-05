import type {
  CapacityCheckResult,
  VacationCoverageBase,
  VacationLifecycleStatus,
  VacationSchedule,
} from '../types/vocation.ts';

export interface VacationEmployeeImport {
  registration: string;
  cpf?: string;
  name: string;
  role: string;
  sector?: string;
  shiftGroup: string;
  shiftType?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  status: string;
  hireDate?: string;
  vacation2026?: string;
  vacation2027?: string;
}

export interface VacationProgramImport {
  acquisitionStart: string;
  acquisitionEnd: string;
  safeDeadline: string;
  daysOff?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  employee: VacationEmployeeImport;
}

export interface ParsedVacationRow {
  line: number;
  program: VacationProgramImport | null;
  errors: string[];
  warnings: string[];
}

export interface VacationProgram {
  id: string;
  employee_id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  dt_limite_maxima: string;
  periodo_concessivo_fim?: string;
  dias_gozo: number;
  data_inicio_programada: string | null;
  data_fim_programada: string | null;
  status?: VacationLifecycleStatus;
  ajuste_manual_flag: boolean;
  observacao_dp: string;
}

export interface VacationEmployee {
  id: string;
  registration: string;
  cpf?: string | null;
  name: string;
  role: string;
  shift_group: string;
  shift_type?: string;
  status: string;
  vacation_2026?: string | null;
  vacation_2027?: string | null;
}

export interface VacationMinimum {
  id: string;
  funcao: string;
  plantao: string;
  minimo_operacional: number;
}

export interface VacationAssignment {
  employee_id: string;
  date: string;
  shift_group: string;
  role: string;
  status: string;
}

export interface VacationLeave {
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  leave_type?: string;
}

export interface PlannedVacation {
  program: VacationProgram;
  start: string | null;
  end: string | null;
  status: 'PROGRAMADO' | 'PENDENTE' | 'BLOQUEADO' | 'CONFLITO';
  message: string;
}

export interface CoverageGap {
  date: string;
  funcao: string;
  plantao: string;
  disponiveis: number;
  minimo: number;
}

export interface ShiftDailyCoverage {
  date: string;
  funcao: string;
  plantao: string;
  escalados: number;
  disponiveis: number;
  emFerias: number;
  minimo: number | null;
  percentualAtivo: number | null;
  status: 'OK' | 'CONFLITO' | 'PENDENTE';
}

export interface OperationalCoverageInput {
  data: string;
  funcao: string;
  plantao: string;
  colaboradoresEscalados: string[];
  colaboradoresAusentes?: string[];
  colaboradoresEmFerias?: string[];
}

const MS_PER_DAY = 86_400_000;

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizeHeader(value: string): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function decodeTabularFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return new TextDecoder('windows-1252').decode(buffer).replace(/^\uFEFF/, '');
  }
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let highestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (!quoted && firstLine[i] === delimiter) {
        count += 1;
      }
    }
    if (count > highestCount) {
      best = delimiter;
      highestCount = count;
    }
  }
  return best;
}

export function parseDelimitedText(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('O arquivo contém uma aspa sem fechamento.');
  if (cell || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function parseLocalDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!iso && !br) return null;
  const year = Number(iso?.[1] || br?.[3]);
  const month = Number(iso?.[2] || br?.[2]);
  const day = Number(iso?.[3] || br?.[1]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${firstOfTarget.getUTCFullYear()}-${String(firstOfTarget.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function addCalendarDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function getVacationLifecycleStatus(
  start: string | null,
  end: string | null,
  today: string,
): VacationLifecycleStatus {
  if (!start || !end) return 'Pendente';
  if (end < today) return 'Concluída';
  if (start <= today) return 'Em Gozo';
  return 'Agendada';
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculateDigit = (length: number) => {
    const sum = digits.slice(0, length).split('').reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function calculateVacationDeadline(acquisitionStart: string): {
  twentyOneMonthCap: string;
  legalLimit: string;
  safeDeadline: string;
} {
  const twentyOneMonthCap = addCalendarMonths(acquisitionStart, 21);
  const legalLimit = twentyOneMonthCap;
  return {
    twentyOneMonthCap,
    legalLimit,
    safeDeadline: twentyOneMonthCap,
  };
}

export function calcularDataLimiteCLT(inicioPA: string): string {
  return calculateVacationDeadline(inicioPA).safeDeadline;
}

export function verificarMinimoOperacional(
  input: OperationalCoverageInput,
  bases: VacationCoverageBase[],
): CapacityCheckResult {
  const normalize = (value: string) => cleanText(value);
  const base = bases.find((item) =>
    normalize(item.funcao) === normalize(input.funcao) &&
    normalize(item.plantao) === normalize(input.plantao));
  const minimoRequerido = base?.minimo_operacional ?? 0;
  const absent = new Set([
    ...(input.colaboradoresAusentes || []),
    ...(input.colaboradoresEmFerias || []),
  ]);
  const disponiveisNoDia = new Set(input.colaboradoresEscalados.filter((id) => !absent.has(id))).size;
  const agendadosNoDia = new Set(input.colaboradoresEmFerias || []).size;
  return {
    minimoRequerido,
    agendadosNoDia,
    disponiveisNoDia,
    valido: base !== undefined && disponiveisNoDia >= minimoRequerido,
  };
}

export interface AutomaticVacationProjectionInput {
  programs: VacationSchedule[];
  employees: VacationEmployee[];
  minimums: VacationMinimum[];
  assignments: VacationAssignment[];
  leaves: VacationLeave[];
  today: string;
}

export function gerarProjecaoAutomatica(
  input: AutomaticVacationProjectionInput,
): PlannedVacation[] {
  const eligiblePrograms = input.programs.filter((program) =>
    !program.ajuste_manual_flag &&
    !program.data_inicio_programada &&
    !program.data_fim_programada);
  const eligibleIds = new Set(eligiblePrograms.map((program) => program.id));
  return planVacationPrograms({
    ...input,
    allocationStrategy: 'earliest',
  }).filter((planned) => eligibleIds.has(planned.program.id));
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY);
}

function normalizedStatus(value: string): string {
  const status = normalizeHeader(value);
  if (status === 'FERIAS') return 'FÉRIAS';
  if (status === 'AFASTADO' || status === 'INATIVO') return status;
  return status === 'ATIVO' ? 'ATIVO' : cleanText(value);
}

const HEADER_ALIASES: Record<string, string[]> = {
  registration: ['MATRICULA', 'MATRICULA_FUNCIONAL', 'REGISTRATION'],
  cpf: ['CPF', 'NUMERO_CPF'],
  name: ['NOME', 'NOME_DO_COLABORADOR', 'COLABORADOR'],
  role: ['FUNCAO', 'CARGO', 'ROLE'],
  sector: ['SETOR', 'AREA', 'SECTOR'],
  shiftGroup: ['PLANTAO', 'GRUPO', 'SHIFT_GROUP'],
  shiftType: ['TURNO', 'CLASSIFICACAO', 'SHIFT_TYPE'],
  scheduleStart: ['HORARIO_INICIO', 'HORARIO_INICIAL', 'SCHEDULE_START'],
  scheduleEnd: ['HORARIO_FIM', 'HORARIO_FINAL', 'SCHEDULE_END'],
  status: ['STATUS', 'SITUACAO'],
  hireDate: ['ADMISSAO', 'DATA_ADMISSAO', 'HIRE_DATE'],
  acquisitionStart: ['PERIODO_AQUISITIVO_INICIO', 'INICIO_PERIODO_AQUISITIVO'],
  acquisitionEnd: ['PERIODO_AQUISITIVO_FIM', 'FIM_PERIODO_AQUISITIVO'],
  importedDeadline: ['DT_LIMITE_MAXIMA', 'DATA_LIMITE_MAXIMA', 'PERIODO_CONCESSIVO_FIM', 'FIM_PERIODO_CONCESSIVO'],
  daysOff: ['DIAS_GOZO', 'DURACAO_DIAS', 'DIAS_DE_FERIAS'],
  scheduledStart: ['DATA_INICIO_PROGRAMADA', 'FERIAS_INICIO_PROGRAMADA'],
  scheduledEnd: ['DATA_FIM_PROGRAMADA', 'FERIAS_FIM_PROGRAMADA'],
  vacation2026: ['FERIAS_2026', 'FERIAS_2026_INICIO'],
  vacation2027: ['FERIAS_2027', 'FERIAS_2027_INICIO'],
};

function getCell(row: string[], indexes: Map<string, number>, key: string): string {
  const aliases = HEADER_ALIASES[key] || [];
  for (const alias of aliases) {
    const index = indexes.get(alias);
    if (index !== undefined) return row[index]?.trim() || '';
  }
  return '';
}

function readOptionalDate(value: string, field: string, errors: string[]): string | undefined {
  if (!value) return undefined;
  const parsed = parseLocalDate(value);
  if (!parsed) errors.push(`${field}: data inválida (${value}). Use AAAA-MM-DD ou DD/MM/AAAA.`);
  return parsed || undefined;
}

export function parseVacationImport(text: string): ParsedVacationRow[] {
  const rows = parseDelimitedText(text);
  if (rows.length < 2) throw new Error('O arquivo não contém linhas de dados.');
  const indexes = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const hasAlias = (key: string) => (HEADER_ALIASES[key] || []).some((alias) => indexes.has(alias));
  const missingHeaders = ['registration', 'name', 'role', 'acquisitionStart', 'acquisitionEnd']
    .filter((key) => !hasAlias(key));
  if (missingHeaders.length > 0) {
    throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}.`);
  }

  const parsed: ParsedVacationRow[] = [];
  const periodKeys = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const errors: string[] = [];
    const warnings: string[] = [];
    const registration = cleanText(getCell(row, indexes, 'registration'));
    const rawCpf = getCell(row, indexes, 'cpf');
    const cpf = rawCpf ? rawCpf.replace(/\D/g, '') : undefined;
    const name = cleanText(getCell(row, indexes, 'name'));
    const role = cleanText(getCell(row, indexes, 'role'));
    const shiftGroup = cleanText(getCell(row, indexes, 'shiftGroup'));
    const shiftType = cleanText(getCell(row, indexes, 'shiftType'));
    const status = normalizedStatus(getCell(row, indexes, 'status'));
    const acquisitionStart = readOptionalDate(getCell(row, indexes, 'acquisitionStart'), 'Período aquisitivo início', errors);
    const acquisitionEnd = readOptionalDate(getCell(row, indexes, 'acquisitionEnd'), 'Período aquisitivo fim', errors);
    const hireDate = readOptionalDate(getCell(row, indexes, 'hireDate'), 'Admissão', errors);
    const vacation2026 = readOptionalDate(getCell(row, indexes, 'vacation2026'), 'Férias 2026', errors);
    const vacation2027 = readOptionalDate(getCell(row, indexes, 'vacation2027'), 'Férias 2027', errors);
    const importedDeadline = readOptionalDate(getCell(row, indexes, 'importedDeadline'), 'Data limite máxima', errors);
    const scheduledStart = readOptionalDate(getCell(row, indexes, 'scheduledStart'), 'Data início programada', errors);
    const scheduledEnd = readOptionalDate(getCell(row, indexes, 'scheduledEnd'), 'Data fim programada', errors);
    const scheduleStart = getCell(row, indexes, 'scheduleStart');
    const scheduleEnd = getCell(row, indexes, 'scheduleEnd');
    const rawDays = getCell(row, indexes, 'daysOff');
    const daysOff = rawDays ? Number(rawDays.replace(',', '.')) : undefined;

    if (!registration) errors.push('Matrícula obrigatória; a linha não será conciliada por nome.');
    if (rawCpf && (!cpf || !isValidCpf(cpf))) errors.push('CPF inválido; informe um CPF válido com 11 dígitos.');
    if (!rawCpf) warnings.push('CPF não informado; complete o cadastro eSocial para exportação contábil.');
    if (!name) errors.push('Nome obrigatório.');
    if (!role) errors.push('Função obrigatória.');
    if (!shiftGroup && !shiftType) errors.push('Informe plantão ou turno/classificação.');
    if (!status) errors.push('Status obrigatório.');
    if (status && !['ATIVO', 'FÉRIAS', 'AFASTADO', 'INATIVO'].includes(status)) {
      errors.push(`Status não reconhecido: ${status}.`);
    }
    if (!acquisitionStart || !acquisitionEnd) errors.push('Início e fim do período aquisitivo são obrigatórios.');
    if (acquisitionStart && acquisitionEnd && acquisitionStart > acquisitionEnd) {
      errors.push('O início do período aquisitivo é posterior ao fim.');
    }
    if (scheduledEnd && !scheduledStart) errors.push('Data fim programada requer data início programada.');
    if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) {
      errors.push('A data fim programada é anterior à data de início.');
    }
    if ((scheduleStart && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart)) ||
      (scheduleEnd && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleEnd))) {
      errors.push('Horários devem estar no formato HH:MM válido.');
    }
    if (Boolean(scheduleStart) !== Boolean(scheduleEnd)) errors.push('Informe os dois horários, início e fim.');
    const periodKey = `${registration}|${acquisitionStart || ''}|${acquisitionEnd || ''}`;
    if (registration && periodKeys.has(periodKey)) errors.push(`Matrícula/período duplicado no arquivo: ${registration}.`);
    if (registration) periodKeys.add(periodKey);

    let effectiveDays = daysOff;
    if (scheduledStart && scheduledEnd) {
      const inclusiveDays = daysBetween(scheduledStart, scheduledEnd) + 1;
      if (effectiveDays !== undefined && inclusiveDays !== effectiveDays) {
        errors.push('O período programado não corresponde à quantidade de dias de gozo.');
      } else if (effectiveDays === undefined) {
        effectiveDays = inclusiveDays;
      }
    }
    if (effectiveDays !== undefined && (!Number.isInteger(effectiveDays) || effectiveDays < 14 || effectiveDays > 30)) {
      errors.push('O período programado deve ter entre 14 e 30 dias; informe ao menos um período mínimo de 14 dias.');
    }

    let safeDeadline: string | undefined;
    if (acquisitionStart && acquisitionEnd) {
      const deadlines = calculateVacationDeadline(acquisitionStart);
      safeDeadline = deadlines.safeDeadline;
      if (scheduledStart && scheduledStart <= acquisitionEnd) {
        errors.push('A data de início programada deve ser posterior ao fim do período aquisitivo.');
      }
      if (importedDeadline && importedDeadline <= acquisitionEnd) {
        errors.push('A data limite máxima informada deve ser posterior ao fim aquisitivo.');
      } else if (importedDeadline && importedDeadline < safeDeadline) {
        warnings.push(`Limite recebido ${importedDeadline} é mais restritivo; será respeitado no lugar de ${safeDeadline}.`);
        safeDeadline = importedDeadline;
      } else if (importedDeadline && importedDeadline > safeDeadline) {
        warnings.push(`Limite recebido ${importedDeadline}; será aplicado o limite seguro calculado ${safeDeadline}.`);
      }
      const calculatedEnd = scheduledEnd ||
        (scheduledStart && effectiveDays ? addCalendarDays(scheduledStart, effectiveDays - 1) : undefined);
      if (calculatedEnd && calculatedEnd > safeDeadline) {
        errors.push(`O fim programado excede o limite seguro ${safeDeadline}.`);
      }
    }

    if (shiftGroup && shiftType && !['DIURNO', 'NOTURNO', 'ROTATIVO', '5X1', 'COMERCIAL'].includes(shiftType)) {
      warnings.push(`Classificação de turno não padronizada: ${shiftType}.`);
    }

    const sector = cleanText(getCell(row, indexes, 'sector')) || undefined;
    const program = acquisitionStart && acquisitionEnd && safeDeadline ? {
      acquisitionStart,
      acquisitionEnd,
      safeDeadline,
      daysOff: effectiveDays,
      scheduledStart,
      scheduledEnd,
      employee: {
        registration,
        cpf,
        name,
        role,
        sector,
        shiftGroup: shiftGroup || shiftType,
        shiftType: shiftType || undefined,
        scheduleStart: scheduleStart || undefined,
        scheduleEnd: scheduleEnd || undefined,
        status,
        hireDate,
        vacation2026,
        vacation2027,
      },
    } satisfies VacationProgramImport : null;

    parsed.push({ line: index + 1, program: errors.length === 0 ? program : null, errors, warnings });
  }
  return parsed;
}

function key(role: string, shiftGroup: string): string {
  return `${cleanText(role)}\u0000${cleanText(shiftGroup)}`;
}

function isWorkingStatus(status: string): boolean {
  return ['ESCALADO', 'COBERTURA', 'TRABALHO'].includes(normalizeHeader(status));
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addCalendarDays(date, 1)) dates.push(date);
  return dates;
}

function programRange(program: VacationProgram): { start: string; end: string } | null {
  if (!program.data_inicio_programada || !program.data_fim_programada) return null;
  return { start: program.data_inicio_programada, end: program.data_fim_programada };
}

function rangesOverlap(first: { start: string; end: string }, second: { start: string; end: string }): boolean {
  return first.start <= second.end && second.start <= first.end;
}

function getCandidateStarts(firstDate: string, lastStart: string, targetStart: string): string[] {
  const starts = new Set<string>();
  const span = Math.max(daysBetween(firstDate, lastStart), 0);
  starts.add(firstDate);
  starts.add(lastStart);

  for (let offset = 0; offset <= span; offset += 15) {
    const later = addCalendarDays(targetStart, offset);
    const earlier = addCalendarDays(targetStart, -offset);
    if (later >= firstDate && later <= lastStart) starts.add(later);
    if (earlier >= firstDate && earlier <= lastStart) starts.add(earlier);
  }

  return [...starts].sort((first, second) =>
    Math.abs(daysBetween(targetStart, first)) - Math.abs(daysBetween(targetStart, second)) ||
    first.localeCompare(second));
}

export function planVacationPrograms(input: {
  programs: VacationProgram[];
  employees: VacationEmployee[];
  minimums: VacationMinimum[];
  assignments: VacationAssignment[];
  leaves: VacationLeave[];
  today: string;
  allocationStrategy?: 'earliest' | 'balanced';
}): PlannedVacation[] {
  const { programs, employees, minimums, assignments, leaves, today, allocationStrategy = 'earliest' } = input;
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const minimumByKey = new Map(minimums.map((minimum) => [
    key(minimum.funcao, minimum.plantao),
    minimum.minimo_operacional,
  ]));
  const baselineBySlot = new Map<string, Set<string>>();
  const leaveDatesByEmployee = new Map<string, Set<string>>();
  const scheduledByDate = new Map<string, Set<string>>();
  const startsByMonth = new Map<string, number>();
  const fixedRanges = new Map<string, { programId: string; range: { start: string; end: string } }[]>();
  const results = new Map<string, PlannedVacation>();

  for (const assignment of assignments) {
    if (!isWorkingStatus(assignment.status)) continue;
    const employee = employeesById.get(assignment.employee_id);
    if (!employee || normalizeHeader(employee.status) !== 'ATIVO') continue;
    const role = cleanText(assignment.role || employee?.role || '');
    const group = cleanText(assignment.shift_group || employee?.shift_group || employee?.shift_type || '');
    if (!role || !group) continue;
    const slot = `${assignment.date}\u0000${key(role, group)}`;
    if (!baselineBySlot.has(slot)) baselineBySlot.set(slot, new Set());
    baselineBySlot.get(slot)!.add(assignment.employee_id);
  }

  for (const leave of leaves) {
    if (normalizeHeader(leave.status) === 'RECUSADO') continue;
    const firstRelevantDate = leave.start_date < today ? today : leave.start_date;
    if (leave.end_date < firstRelevantDate) continue;
    for (const date of dateRange(firstRelevantDate, leave.end_date)) {
      if (!leaveDatesByEmployee.has(leave.employee_id)) leaveDatesByEmployee.set(leave.employee_id, new Set());
      leaveDatesByEmployee.get(leave.employee_id)!.add(date);
    }
  }

  const datedPrograms = programs
    .map((program) => ({ program, range: programRange(program) }))
    .filter((item): item is { program: VacationProgram; range: { start: string; end: string } } => item.range !== null);

  for (const { program, range } of datedPrograms) {
    if (!fixedRanges.has(program.employee_id)) fixedRanges.set(program.employee_id, []);
    fixedRanges.get(program.employee_id)!.push({ programId: program.id, range });
    for (const date of dateRange(range.start, range.end)) {
      if (!scheduledByDate.has(date)) scheduledByDate.set(date, new Set());
      scheduledByDate.get(date)!.add(program.employee_id);
    }
    const month = range.start.slice(0, 7);
    startsByMonth.set(month, (startsByMonth.get(month) || 0) + 1);
  }

  const sorted = [...programs].sort((first, second) =>
    first.dt_limite_maxima.localeCompare(second.dt_limite_maxima) ||
    first.periodo_aquisitivo_fim.localeCompare(second.periodo_aquisitivo_fim) ||
    first.employee_id.localeCompare(second.employee_id));

  const checkCoverage = (
    program: VacationProgram,
    start: string,
    end: string,
    reserve: boolean,
  ): string | null => {
    const employee = employeesById.get(program.employee_id);
    if (!employee) return 'Colaborador não encontrado.';
    if (normalizeHeader(employee.status) !== 'ATIVO') return 'Colaborador não está com status ativo.';
    const role = cleanText(employee.role);
    const group = cleanText(employee.shift_group || employee.shift_type || '');
    if (!role || !group) return 'Função ou turno/plantão ausente.';
    const minimum = minimumByKey.get(key(role, group));
    if (minimum === undefined) return `Mínimo de cobertura não configurado para ${role} × ${group}.`;
    const legacyVacationStarts = [employee.vacation_2026, employee.vacation_2027]
      .filter((date): date is string => Boolean(date));
    const unresolvedLegacyStart = legacyVacationStarts.find((date) => {
      const hasLeaveRange = leaves.some((leave) =>
        leave.employee_id === employee.id &&
        normalizeHeader(leave.status) !== 'RECUSADO' &&
        leave.start_date <= date &&
        leave.end_date >= date);
      const hasProgramRange = programs.some((candidate) =>
        candidate.employee_id === employee.id &&
        candidate.ajuste_manual_flag &&
        candidate.data_inicio_programada !== null &&
        candidate.data_fim_programada !== null &&
        candidate.data_inicio_programada <= date &&
        candidate.data_fim_programada >= date);
      return !hasLeaveRange && !hasProgramRange;
    });
    if (unresolvedLegacyStart) {
      return `Férias legadas em ${unresolvedLegacyStart} sem data final; informe o período completo antes de alocar.`;
    }
    const existingLeaveDates = leaveDatesByEmployee.get(program.employee_id);
    const ownRange = { start, end };
    if (existingLeaveDates && dateRange(start, end).some((date) => existingLeaveDates.has(date))) {
      return 'O período coincide com outro afastamento registrado.';
    }
    const otherRanges = (fixedRanges.get(program.employee_id) || [])
      .filter((item) => item.programId !== program.id);
    if (otherRanges.some((item) => rangesOverlap(ownRange, item.range))) {
      return 'O período coincide com outra programação manual do colaborador.';
    }

    for (const date of dateRange(start, end)) {
      const slot = `${date}\u0000${key(role, group)}`;
      const baseline = baselineBySlot.get(slot);
      if (!baseline && minimum > 0) {
        return `Sem escala/efetivo diário cadastrado para ${date} (${role} × ${group}).`;
      }
      const absent = new Set<string>();
      for (const [employeeId, dates] of leaveDatesByEmployee) {
        if (dates.has(date)) absent.add(employeeId);
      }
      const reserved = scheduledByDate.get(date);
      let available = 0;
      for (const employeeId of baseline || []) {
        if (!absent.has(employeeId) && !reserved?.has(employeeId) && employeeId !== program.employee_id) {
          available += 1;
        }
      }
      if (available < minimum) {
        return `Cobertura insuficiente em ${date}: restariam ${available} de ${minimum} necessários (${role} × ${group}).`;
      }
    }
    if (reserve) {
      for (const date of dateRange(start, end)) {
        if (!scheduledByDate.has(date)) scheduledByDate.set(date, new Set());
        scheduledByDate.get(date)!.add(program.employee_id);
      }
    }
    return null;
  };

  for (const { program, range } of datedPrograms) {
    const employee = employeesById.get(program.employee_id);
    const duration = daysBetween(range.start, range.end) + 1;
    const durationWithinRules = duration >= 14 && duration <= 30;
    const durationMatches = duration === program.dias_gozo;
    const invalidWindow = range.start < addCalendarDays(program.periodo_aquisitivo_fim, 1) ||
      range.end > program.dt_limite_maxima || range.end < range.start;
    const message = !employee
      ? 'Colaborador não encontrado.'
      : !durationWithinRules
        ? 'O período de gozo deve ter entre 14 e 30 dias; a regra exige ao menos um período com 14 dias.'
      : !durationMatches
        ? 'Período manual não corresponde aos dias de gozo informados.'
        : invalidWindow
          ? `Período manual fora da janela aquisitiva ou após ${program.dt_limite_maxima}.`
          : checkCoverage(program, range.start, range.end, false);
    results.set(program.id, {
      program,
      start: range.start,
      end: range.end,
      status: message ? 'CONFLITO' : 'PROGRAMADO',
      message: message || (program.ajuste_manual_flag ? 'Ajuste manual validado.' : 'Programação sugerida validada.'),
    });
  }

  for (const program of sorted) {
    if (programRange(program)) continue;
    if (program.ajuste_manual_flag) {
      results.set(program.id, {
        program,
        start: null,
        end: null,
        status: 'BLOQUEADO',
        message: 'O ajuste manual requer início e fim programados; nenhuma data será preenchida automaticamente.',
      });
      continue;
    }
    const employee = employeesById.get(program.employee_id);
    if (!employee) {
      results.set(program.id, { program, start: null, end: null, status: 'BLOQUEADO', message: 'Colaborador não encontrado.' });
      continue;
    }
    if (!Number.isInteger(program.dias_gozo) || program.dias_gozo < 14 || program.dias_gozo > 30) {
      results.set(program.id, { program, start: null, end: null, status: 'BLOQUEADO', message: 'Informe um período de gozo entre 14 e 30 dias; a regra exige ao menos um período com 14 dias.' });
      continue;
    }
    const firstDate = [today, addCalendarDays(program.periodo_aquisitivo_fim, 1)].sort()[1];
    const lastStart = addCalendarDays(program.dt_limite_maxima, -(program.dias_gozo - 1));
    if (firstDate > lastStart) {
      results.set(program.id, { program, start: null, end: null, status: 'BLOQUEADO', message: `Sem janela disponível antes do limite seguro ${program.dt_limite_maxima}.` });
      continue;
    }
    const targetStart = addCalendarDays(program.dt_limite_maxima, -30);
    const existingLeaveDates = leaveDatesByEmployee.get(program.employee_id);
    const otherRanges = (fixedRanges.get(program.employee_id) || []).filter((item) => item.programId !== program.id);
    let selected: { start: string; end: string } | null = null;
    let selectedScore = Number.POSITIVE_INFINITY;
    let failureReason = 'Não há sequência de dias com cobertura segura nessa janela.';
    for (const start of getCandidateStarts(firstDate, lastStart, targetStart)) {
      const end = addCalendarDays(start, program.dias_gozo - 1);
      const range = { start, end };
      if (existingLeaveDates && dateRange(start, end).some((date) => existingLeaveDates.has(date))) {
        failureReason = 'O período coincide com outro afastamento registrado.';
        continue;
      }
      if (otherRanges.some((item) => rangesOverlap(range, item.range))) {
        failureReason = 'O período coincide com outra programação manual do colaborador.';
        continue;
      }
      const issue = checkCoverage(program, start, end, false);
      if (!issue) {
        if (allocationStrategy === 'earliest') {
          selected = range;
          break;
        }
        const month = start.slice(0, 7);
        const monthStartCount = startsByMonth.get(month) || 0;
        const group = cleanText(employee.shift_group || employee.shift_type || '');
        const role = cleanText(employee.role);
        const groupOverlapDays = dateRange(start, end).reduce((overlapDays, date) => {
          const alreadyScheduled = scheduledByDate.get(date);
          if (!alreadyScheduled) return overlapDays;
          const sameGroupEmployees = baselineBySlot.get(`${date}\u0000${key(role, group)}`);
          return overlapDays + (sameGroupEmployees
            ? [...sameGroupEmployees].filter((id) => alreadyScheduled.has(id)).length
            : 0);
        }, 0);
        const distanceFromTarget = Math.abs(daysBetween(targetStart, start));
        const score = monthStartCount * 30 + groupOverlapDays * 10 + distanceFromTarget / 1000;
        if (score < selectedScore) {
          selected = range;
          selectedScore = score;
        }
      }
      if (issue) failureReason = issue;
    }
    if (!selected) {
      const hasMinimum = minimumByKey.has(key(employee.role, employee.shift_group || employee.shift_type || ''));
      results.set(program.id, {
        program,
        start: null,
        end: null,
        status: 'PENDENTE',
        message: hasMinimum ? failureReason : `Mínimo de cobertura não configurado para ${cleanText(employee.role)} × ${cleanText(employee.shift_group || employee.shift_type || '')}.`,
      });
      continue;
    }
    checkCoverage(program, selected.start, selected.end, true);
    const range = { ...selected };
    fixedRanges.set(program.employee_id, [...(fixedRanges.get(program.employee_id) || []), { programId: program.id, range }]);
    const selectedMonth = selected.start.slice(0, 7);
    startsByMonth.set(selectedMonth, (startsByMonth.get(selectedMonth) || 0) + 1);
    results.set(program.id, {
      program,
      start: selected.start,
      end: selected.end,
      status: 'PROGRAMADO',
      message: 'Alocado sem violar os mínimos de cobertura conhecidos.',
    });
  }

  return sorted.map(({ id }) => results.get(id) || {
    program: programs.find((program) => program.id === id)!,
    start: null,
    end: null,
    status: 'PENDENTE',
    message: 'Período sem programação.',
  });
}

export function calculateCoverageGaps(input: {
  employees: VacationEmployee[];
  minimums: VacationMinimum[];
  assignments: VacationAssignment[];
  leaves: VacationLeave[];
  programs: VacationProgram[];
  today: string;
}): CoverageGap[] {
  const { employees, minimums, assignments, leaves, programs, today } = input;
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const minimumByKey = new Map(minimums.map((minimum) => [
    key(minimum.funcao, minimum.plantao),
    minimum.minimo_operacional,
  ]));
  const peopleBySlot = new Map<string, Set<string>>();
  const absentByDate = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    if (assignment.date < today || !isWorkingStatus(assignment.status)) continue;
    const employee = employeesById.get(assignment.employee_id);
    if (!employee || normalizeHeader(employee.status) !== 'ATIVO') continue;
    const role = cleanText(assignment.role || employee.role);
    const group = cleanText(assignment.shift_group || employee.shift_group || employee.shift_type || '');
    if (!role || !group) continue;
    const slot = `${assignment.date}\u0000${key(role, group)}`;
    if (!peopleBySlot.has(slot)) peopleBySlot.set(slot, new Set());
    peopleBySlot.get(slot)!.add(employee.id);
  }

  const markAbsent = (employeeId: string, start: string, end: string) => {
    const firstDate = start < today ? today : start;
    if (end < firstDate) return;
    for (const date of dateRange(firstDate, end)) {
      if (!absentByDate.has(date)) absentByDate.set(date, new Set());
      absentByDate.get(date)!.add(employeeId);
    }
  };
  for (const leave of leaves) {
    if (normalizeHeader(leave.status) !== 'RECUSADO') markAbsent(leave.employee_id, leave.start_date, leave.end_date);
  }
  for (const program of programs) {
    if (program.data_inicio_programada && program.data_fim_programada) {
      markAbsent(program.employee_id, program.data_inicio_programada, program.data_fim_programada);
    }
  }

  const gaps: CoverageGap[] = [];
  for (const [slot, employeesInSlot] of peopleBySlot) {
    const separator = slot.indexOf('\u0000');
    const date = slot.slice(0, separator);
    const [role, group] = slot.slice(separator + 1).split('\u0000');
    const minimum = minimumByKey.get(key(role, group));
    if (minimum === undefined || minimum <= 0) continue;
    const absences = absentByDate.get(date);
    const available = [...employeesInSlot].filter((employeeId) => !absences?.has(employeeId)).length;
    if (available < minimum) gaps.push({ date, funcao: role, plantao: group, disponiveis: available, minimo: minimum });
  }
  return gaps.sort((first, second) =>
    first.date.localeCompare(second.date) ||
    first.funcao.localeCompare(second.funcao) ||
    first.plantao.localeCompare(second.plantao));
}

export function summarizeShiftCoverage(input: {
  date: string;
  employees: VacationEmployee[];
  assignments: VacationAssignment[];
  leaves: VacationLeave[];
  programs: VacationProgram[];
  minimums: VacationMinimum[];
}): ShiftDailyCoverage[] {
  const { date, employees, assignments, leaves, programs, minimums } = input;
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const groups = new Map<string, { funcao: string; plantao: string; activeIds: Set<string>; assignedIds: Set<string> }>();
  const slotKey = (role: string, shift: string) => key(role, shift);
  const ensureGroup = (role: string, shift: string) => {
    const groupKey = slotKey(role, shift);
    let group = groups.get(groupKey);
    if (!group) {
      group = { funcao: cleanText(role), plantao: cleanText(shift), activeIds: new Set(), assignedIds: new Set() };
      groups.set(groupKey, group);
    }
    return group;
  };

  for (const employee of employees) {
    if (!['ATIVO', 'FERIAS'].includes(normalizeHeader(employee.status))) continue;
    const role = cleanText(employee.role);
    const shift = cleanText(employee.shift_group || employee.shift_type || '');
    if (role && shift) ensureGroup(role, shift).activeIds.add(employee.id);
  }
  for (const assignment of assignments) {
    if (assignment.date !== date || !isWorkingStatus(assignment.status)) continue;
    const employee = employeesById.get(assignment.employee_id);
    if (!employee || normalizeHeader(employee.status) !== 'ATIVO') continue;
    const role = cleanText(assignment.role || employee.role);
    const shift = cleanText(assignment.shift_group || employee.shift_group || employee.shift_type || '');
    if (role && shift) ensureGroup(role, shift).assignedIds.add(employee.id);
  }

  const absences = new Set<string>();
  const vacations = new Set<string>();
  for (const leave of leaves) {
    if (normalizeHeader(leave.status) === 'RECUSADO' || leave.start_date > date || leave.end_date < date) continue;
    absences.add(leave.employee_id);
    if (normalizeHeader(leave.leave_type || '') === 'FERIAS') vacations.add(leave.employee_id);
  }
  for (const program of programs) {
    if (program.data_inicio_programada && program.data_fim_programada &&
      program.data_inicio_programada <= date && program.data_fim_programada >= date) {
      absences.add(program.employee_id);
      vacations.add(program.employee_id);
    }
  }

  const minimumByKey = new Map(minimums.map((minimum) => [
    slotKey(minimum.funcao, minimum.plantao),
    minimum.minimo_operacional,
  ]));
  return [...groups.values()]
    .map((group) => {
      const minimum = minimumByKey.get(slotKey(group.funcao, group.plantao));
      const availableIds = [...group.assignedIds].filter((id) => !absences.has(id));
      const vacationCount = [...group.activeIds].filter((id) => vacations.has(id)).length;
      const status = minimum === undefined || group.assignedIds.size === 0
        ? 'PENDENTE'
        : availableIds.length < minimum
          ? 'CONFLITO'
          : 'OK';
      return {
        date,
        funcao: group.funcao,
        plantao: group.plantao,
        escalados: group.assignedIds.size,
        disponiveis: availableIds.length,
        emFerias: vacationCount,
        minimo: minimum ?? null,
        percentualAtivo: group.assignedIds.size > 0
          ? Math.round((availableIds.length / group.assignedIds.size) * 100)
          : null,
        status,
      } satisfies ShiftDailyCoverage;
    })
    .sort((first, second) =>
      first.plantao.localeCompare(second.plantao) || first.funcao.localeCompare(second.funcao));
}
