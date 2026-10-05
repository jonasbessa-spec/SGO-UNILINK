import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const aliases = {
  registration: ['MATRICULA', 'MATRICULA_FUNCIONAL', 'REGISTRATION'],
  name: ['NOME', 'NOME_DO_COLABORADOR', 'COLABORADOR'],
  role: ['FUNCAO', 'CARGO', 'ROLE'],
  sector: ['SETOR', 'AREA', 'SECTOR'],
  group: ['PLANTAO', 'GRUPO', 'SHIFT_GROUP'],
  shiftType: ['TURNO', 'CLASSIFICACAO', 'SHIFT_TYPE'],
  status: ['STATUS', 'SITUACAO'],
  hireDate: ['ADMISSAO', 'DATA_ADMISSAO', 'HIRE_DATE'],
  periodStart: ['PERIODO_AQUISITIVO_INICIO', 'INICIO_PERIODO_AQUISITIVO'],
  periodEnd: ['PERIODO_AQUISITIVO_FIM', 'FIM_PERIODO_AQUISITIVO'],
  importedDeadline: ['DT_LIMITE_MAXIMA', 'DATA_LIMITE_MAXIMA'],
  daysOff: ['DIAS_GOZO', 'DURACAO_DIAS', 'DIAS_DE_FERIAS'],
  scheduledStart: ['DATA_INICIO_PROGRAMADA'],
  scheduledEnd: ['DATA_FIM_PROGRAMADA'],
  vacation2026: ['FERIAS_2026', 'FERIAS_2026_INICIO'],
  vacation2027: ['FERIAS_2027', 'FERIAS_2027_INICIO'],
  scheduleStart: ['HORARIO_INICIO', 'HORARIO_INICIAL', 'SCHEDULE_START'],
  scheduleEnd: ['HORARIO_FIM', 'HORARIO_FINAL', 'SCHEDULE_END'],
};

function clean(value) {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function header(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseDate(value) {
  const input = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!iso && !br) return null;
  const year = Number(iso?.[1] || br[3]);
  const month = Number(iso?.[2] || br[2]);
  const day = Number(iso?.[3] || br[1]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function safeDeadline(periodEnd) {
  const cap = addMonths(periodEnd, 21);
  const legalLimit = addMonths(periodEnd, 22);
  const thirtyDaysBeforeLegal = addDays(legalLimit, -30);
  return [cap, thirtyDaysBeforeLegal].sort()[0];
}

function decode(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return new TextDecoder('windows-1252').decode(buffer).replace(/^\uFEFF/, '');
  }
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] || '';
  const options = [',', ';', '\t'];
  return options.map((delimiter) => {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') {
        if (quoted && firstLine[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && firstLine[index] === delimiter) count += 1;
    }
    return { delimiter, count };
  }).sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseRows(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('Arquivo possui uma aspa sem fechamento.');
  if (cell || row.length) {
    row.push(cell);
    if (row.some((item) => item.trim())) rows.push(row);
  }
  return rows;
}

function cell(row, indexes, key) {
  for (const alias of aliases[key]) {
    const index = indexes.get(alias);
    if (index !== undefined) return row[index]?.trim() || '';
  }
  return '';
}

function parseImport(text) {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error('Arquivo não contém linhas de dados.');
  const indexes = new Map(rows[0].map((value, index) => [header(value), index]));
  for (const key of ['registration', 'name', 'role', 'periodStart', 'periodEnd']) {
    if (!aliases[key].some((alias) => indexes.has(alias))) throw new Error(`Cabeçalho obrigatório ausente: ${key}.`);
  }
  const seen = new Set();
  const parsed = [];
  const errors = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 1;
    const registration = clean(cell(row, indexes, 'registration'));
    const name = clean(cell(row, indexes, 'name'));
    const role = clean(cell(row, indexes, 'role'));
    const group = clean(cell(row, indexes, 'group')) || clean(cell(row, indexes, 'shiftType'));
    const statusInput = header(cell(row, indexes, 'status'));
    const status = statusInput === 'FERIAS' ? 'Férias' : statusInput === 'AFASTADO' ? 'Afastado' :
      statusInput === 'INATIVO' ? 'Inativo' : statusInput === 'ATIVO' ? 'Ativo' : '';
    const periodStart = parseDate(cell(row, indexes, 'periodStart'));
    const periodEnd = parseDate(cell(row, indexes, 'periodEnd'));
    const rowErrors = [];
    const rowWarnings = [];
    if (!registration) rowErrors.push('matrícula ausente; conciliação por nome não é permitida');
    if (!name || !role || !group || !status) rowErrors.push('nome, função, plantão/turno e status são obrigatórios');
    if (!periodStart || !periodEnd) rowErrors.push('datas válidas de início/fim aquisitivos são obrigatórias');
    if (periodStart && periodEnd && periodStart > periodEnd) rowErrors.push('período aquisitivo invertido');
    const identity = `${registration}|${periodStart}|${periodEnd}`;
    if (seen.has(identity)) rowErrors.push('matrícula/período duplicado no arquivo');
    seen.add(identity);

    const rawDays = cell(row, indexes, 'daysOff');
    let daysOff = rawDays ? Number(rawDays.replace(',', '.')) : null;
    if (daysOff !== null && (!Number.isInteger(daysOff) || daysOff < 1 || daysOff > 365)) rowErrors.push('dias_gozo deve ser inteiro entre 1 e 365');
    const scheduledStartRaw = cell(row, indexes, 'scheduledStart');
    const scheduledEndRaw = cell(row, indexes, 'scheduledEnd');
    const scheduledStart = scheduledStartRaw ? parseDate(scheduledStartRaw) : null;
    const scheduledEnd = scheduledEndRaw ? parseDate(scheduledEndRaw) : null;
    const scheduleStart = cell(row, indexes, 'scheduleStart');
    const scheduleEnd = cell(row, indexes, 'scheduleEnd');
    if ((scheduledStartRaw && !scheduledStart) || (scheduledEndRaw && !scheduledEnd)) rowErrors.push('data programada inválida');
    if (scheduledEnd && !scheduledStart) rowErrors.push('data fim programada exige data início');
    if ((scheduleStart && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart)) ||
      (scheduleEnd && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleEnd))) rowErrors.push('horário inválido; use HH:MM');
    if (Boolean(scheduleStart) !== Boolean(scheduleEnd)) rowErrors.push('informe horário de início e fim juntos');
    if (scheduledStart && scheduledEnd) {
      const inclusiveDays = Math.round((Date.parse(`${scheduledEnd}T00:00:00Z`) - Date.parse(`${scheduledStart}T00:00:00Z`)) / 86_400_000) + 1;
      if (daysOff !== null && daysOff !== inclusiveDays) rowErrors.push('período programado diverge de dias_gozo');
      else if (daysOff === null) daysOff = inclusiveDays;
    }

    const optionalDate = (key, label) => {
      const raw = cell(row, indexes, key);
      const value = raw ? parseDate(raw) : null;
      if (raw && !value) rowErrors.push(`${label} inválida`);
      return value;
    };
    const hireDate = optionalDate('hireDate', 'admissão');
    const vacation2026 = optionalDate('vacation2026', 'ferias_2026');
    const vacation2027 = optionalDate('vacation2027', 'ferias_2027');
    const suppliedDeadline = optionalDate('importedDeadline', 'dt_limite_maxima');
    let deadline = periodEnd ? safeDeadline(periodEnd) : null;
    if (suppliedDeadline && periodEnd && suppliedDeadline <= periodEnd) rowErrors.push('dt_limite_maxima deve ser posterior ao fim aquisitivo');
    if (suppliedDeadline && deadline && suppliedDeadline < deadline) {
      rowWarnings.push(`dt_limite_maxima recebido ${suppliedDeadline} é mais restritivo; será respeitado`);
      deadline = suppliedDeadline;
    } else if (suppliedDeadline && deadline && suppliedDeadline > deadline) {
      rowWarnings.push(`dt_limite_maxima recebido ${suppliedDeadline}; será aplicado o limite seguro calculado ${deadline}`);
    }
    if (scheduledStart && periodEnd && scheduledStart <= periodEnd) rowErrors.push('data de início programada deve ser posterior ao fim aquisitivo');
    if (scheduledStart && daysOff && deadline && addDays(scheduledStart, daysOff - 1) > deadline) {
      rowErrors.push(`fim programado excede o limite seguro ${deadline}`);
    }
    if (scheduledEnd && deadline && scheduledEnd > deadline) rowErrors.push(`fim programado excede o limite seguro ${deadline}`);

    if (rowErrors.length) errors.push(`Linha ${line}: ${rowErrors.join('; ')}.`);
    if (periodEnd && periodStart && periodStart <= periodEnd && registration && name && role && group && status && rowErrors.length === 0) {
      parsed.push({
        line,
        registration,
        name,
        role,
        sector: clean(cell(row, indexes, 'sector')),
        group,
        shiftType: clean(cell(row, indexes, 'shiftType')),
        status,
        hireDate,
        vacation2026,
        vacation2027,
        scheduleStart,
        scheduleEnd,
        periodStart,
        periodEnd,
        deadline,
        daysOff,
        scheduledStart,
        scheduledEnd,
        warnings: rowWarnings,
      });
    }
  }
  if (errors.length) throw new Error(`Importação cancelada sem gravar dados:\n${errors.join('\n')}`);
  return parsed;
}

function scaleFor(group, scales) {
  const matches = scales.filter((scale) => scale.shift_group.trim().toUpperCase() === group);
  if (!matches.length) return null;
  const first = matches[0];
  return matches.every((scale) => scale.start_time === first.start_time && scale.end_time === first.end_time) ? first : null;
}

function programKey(employeeId, start, end) {
  return `${employeeId}|${start}|${end}`;
}

async function main() {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Falha ao ler o arquivo de ambiente: ${error.message}`);
    }
  }
  const [filePath] = process.argv.slice(2);
  if (!filePath) throw new Error('Uso: node scripts/import-real-data.mjs <arquivo.csv|tsv>');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_KEY no ambiente antes de importar.');
  const source = parseImport(decode(await readFile(filePath)));
  const client = createClient(url, key);
  const registrations = [...new Set(source.map((item) => item.registration))];
  const { data: existingEmployees, error: readEmployeesError } = await client
    .from('employees').select('*').in('registration', registrations);
  if (readEmployeesError) throw new Error(`Falha ao ler colaboradores: ${readEmployeesError.message}`);
  const existingByRegistration = new Map((existingEmployees || []).map((employee) => [employee.registration, employee]));
  const newGroups = [...new Set(source.filter((item) => !existingByRegistration.has(item.registration)).map((item) => item.group))];
  const { data: scales, error: readScalesError } = newGroups.length
    ? await client.from('shift_scales').select('shift_group,start_time,end_time,is_active').eq('is_active', true).in('shift_group', newGroups)
    : { data: [], error: null };
  if (readScalesError) throw new Error(`Falha ao ler escalas ativas: ${readScalesError.message}`);
  const employeeWrites = new Map();

  for (const item of source) {
    const existing = existingByRegistration.get(item.registration);
    const previousWrite = employeeWrites.get(item.registration);
    const scale = existing || previousWrite ? null : scaleFor(item.group, scales || []);
    const sector = item.sector || existing?.sector || previousWrite?.sector;
    const startTime = item.scheduleStart || existing?.schedule_start || previousWrite?.schedule_start || scale?.start_time;
    const endTime = item.scheduleEnd || existing?.schedule_end || previousWrite?.schedule_end || scale?.end_time;
    if (!sector) throw new Error(`Linha ${item.line} (${item.registration}): informe setor/área para matrícula nova.`);
    if (!startTime || !endTime) throw new Error(`Linha ${item.line} (${item.registration}): informe horários ou configure uma escala ativa única para ${item.group}.`);
    if (previousWrite && (
      previousWrite.name !== item.name ||
      previousWrite.role !== item.role ||
      previousWrite.sector !== sector ||
      previousWrite.shift_group !== item.group ||
      previousWrite.status !== item.status
    )) {
      throw new Error(`Linha ${item.line} (${item.registration}): dados cadastrais divergem entre períodos da mesma matrícula.`);
    }
    employeeWrites.set(item.registration, {
      ...(existing || {}),
      registration: item.registration,
      name: item.name,
      role: item.role,
      sector,
      shift_group: item.group,
      shift_type: item.shiftType || existing?.shift_type || '',
      status: item.status,
      hire_date: item.hireDate || existing?.hire_date || null,
      schedule_start: startTime,
      schedule_end: endTime,
      scale_status: item.status === 'Ativo' ? 'Em escala' : item.status === 'Férias' ? 'Em férias' : item.status,
      vacation_2026: item.vacation2026 || existing?.vacation_2026 || null,
      vacation_2027: item.vacation2027 || existing?.vacation_2027 || null,
    });
  }

  const { data: savedEmployees, error: writeEmployeesError } = await client
    .from('employees').upsert([...employeeWrites.values()], { onConflict: 'registration' }).select('id,registration');
  if (writeEmployeesError) throw new Error(`Falha ao upsert de colaboradores: ${writeEmployeesError.message}`);
  if ((savedEmployees || []).length !== employeeWrites.size) throw new Error('Upsert não retornou todas as matrículas; programas não foram gravados.');
  const idsByRegistration = new Map(savedEmployees.map((employee) => [employee.registration, employee.id]));
  const employeeIds = [...idsByRegistration.values()];
  const { data: previousPrograms, error: readProgramsError } = await client
    .from('vacation_programs').select('*').in('employee_id', employeeIds);
  if (readProgramsError) throw new Error(`Colaboradores foram salvos, mas falhou a leitura de programações anteriores: ${readProgramsError.message}`);
  const previousByKey = new Map((previousPrograms || []).map((program) => [
    programKey(program.employee_id, program.periodo_aquisitivo_inicio, program.periodo_aquisitivo_fim),
    program,
  ]));

  const programs = source.map((item) => {
    const employeeId = idsByRegistration.get(item.registration);
    const previous = previousByKey.get(programKey(employeeId, item.periodStart, item.periodEnd));
    const manual = Boolean(previous?.ajuste_manual_flag);
    const start = item.scheduledStart || null;
    const end = item.scheduledEnd || (start && item.daysOff ? addDays(start, item.daysOff - 1) : null);
    return {
      employee_id: employeeId,
      periodo_aquisitivo_inicio: item.periodStart,
      periodo_aquisitivo_fim: item.periodEnd,
      dt_limite_maxima: item.deadline,
      dias_gozo: manual && item.daysOff === null ? previous.dias_gozo : item.daysOff ?? previous?.dias_gozo ?? null,
      data_inicio_programada: manual ? previous.data_inicio_programada : start || previous?.data_inicio_programada || null,
      data_fim_programada: manual ? previous.data_fim_programada : end || previous?.data_fim_programada || null,
      ajuste_manual_flag: manual || Boolean(start),
      observacao_dp: previous?.observacao_dp || '',
      status: previous?.status || 'PENDENTE',
    };
  });
  const { error: writeProgramsError } = await client
    .from('vacation_programs')
    .upsert(programs, { onConflict: 'employee_id,periodo_aquisitivo_inicio,periodo_aquisitivo_fim' });
  if (writeProgramsError) throw new Error(`Colaboradores foram salvos, mas falhou o upsert dos períodos: ${writeProgramsError.message}`);
  console.log(`Importação concluída: ${employeeWrites.size} matrícula(s), ${programs.length} período(s); nenhum dado existente foi excluído.`);
  for (const item of source) {
    for (const warning of item.warnings) console.warn(`Linha ${item.line}: ${warning}.`);
  }
  if (programs.some((program) => program.dias_gozo === null)) {
    console.log('Há períodos sem dias_gozo; complete a duração na interface antes de gerar o plano.');
  }
}

main().catch((error) => {
  console.error(`Erro de importação: ${error.message}`);
  process.exitCode = 1;
});
