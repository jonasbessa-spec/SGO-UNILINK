import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarClock, Check, CheckCircle2, Download, FileUp, Filter, LogIn, LogOut, Printer, RefreshCw, Save, Search, Settings2, ShieldAlert, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { Input, Select, Textarea } from '@/components/ui/Form';
import type { Employee } from '@/types';
import {
  addCalendarDays,
  calculateCoverageGaps,
  calculateVacationDeadline,
  decodeTabularFile,
  getVacationLifecycleStatus,
  isValidCpf,
  parseVacationImport,
  planVacationPrograms,
  summarizeShiftCoverage,
  type ParsedVacationRow,
  type VacationAssignment,
  type VacationEmployee,
  type VacationLeave,
  type VacationMinimum,
  type VacationProgram,
} from '@/lib/vacationPlanning';
import type { VacationSchedule, VacationScheduleHistory } from '@/types/vocation';

interface VacationProgrammingTabProps {
  employees: Employee[];
  vacations: VacationSchedule[];
  onDataChanged: () => Promise<void>;
}

interface EmployeeWrite {
  id?: string;
  registration: string;
  name: string;
  role: string;
  sector: string;
  shift_group: string;
  shift_type: string;
  status: string;
  hire_date: string | null;
  schedule_start: string;
  schedule_end: string;
  scale_status: string;
  notes: string;
  vacation_2026: string | null;
  vacation_2027: string | null;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function inclusiveDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

function employeeStatus(value: string): string {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (normalized === 'AFASTADO') return 'Afastado';
  if (normalized === 'FERIAS') return 'Férias';
  if (normalized === 'INATIVO') return 'Inativo';
  return 'Ativo';
}

function statusForScale(status: string): string {
  if (status === 'Afastado') return 'Afastado';
  if (status === 'Férias') return 'Em férias';
  if (status === 'Inativo') return 'Inativo';
  return 'Em escala';
}

function findSchedule(group: string, employees: Employee[]): { start_time: string; end_time: string } | null {
  const matches = employees.filter((employee) =>
    employee.shift_group.trim().toUpperCase() === group.trim().toUpperCase() &&
    employee.schedule_start &&
    employee.schedule_end);
  if (matches.length === 0) return null;
  const first = matches[0];
  return matches.every((employee) =>
    employee.schedule_start === first.schedule_start && employee.schedule_end === first.schedule_end)
    ? { start_time: first.schedule_start, end_time: first.schedule_end }
    : null;
}

const DP_EMAIL = 'jonas.bessa@unilinktransportes.com.br';
type UrgencyFilter = 'all' | 'critical' | 'attention' | 'conflict' | 'scheduled' | 'regular' | 'projected';

export function VacationTab({ employees, vacations, onDataChanged }: VacationProgrammingTabProps) {
  const today = useMemo(localToday, []);
  const [selectedCoverageDate, setSelectedCoverageDate] = useState(localToday);
  const [selectedMonth, setSelectedMonth] = useState(localToday().slice(0, 7));
  const [programs, setPrograms] = useState<VacationProgram[]>([]);
  const [minimums, setMinimums] = useState<VacationMinimum[]>([]);
  const [assignments, setAssignments] = useState<VacationAssignment[]>([]);
  const [leaves, setLeaves] = useState<VacationLeave[]>([]);
  const [esocialByEmployee, setEsocialByEmployee] = useState<Record<string, string>>({});
  const [scheduleHistory, setScheduleHistory] = useState<VacationScheduleHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataAvailable, setDataAvailable] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<ParsedVacationRow[]>([]);
  const [minimumRole, setMinimumRole] = useState('');
  const [minimumGroup, setMinimumGroup] = useState('');
  const [minimumCount, setMinimumCount] = useState('');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [dpPassword, setDpPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const isDp = authEmail?.toLowerCase() === DP_EMAIL;

  useEffect(() => {
    setPrograms(vacations);
  }, [vacations]);

  useEffect(() => {
    let isMounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) {
        setError(`Não foi possível verificar a sessão do DP: ${sessionError.message}`);
        return;
      }
      setAuthEmail(data.session?.user.email?.toLowerCase() || null);
    }).catch((reason: unknown) => {
      if (isMounted) setError(`Não foi possível verificar a sessão do DP: ${errorMessage(reason)}`);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user.email?.toLowerCase() || null);
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInAsDp = async () => {
    setIsSigningIn(true);
    setError('');
    setSuccess('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DP_EMAIL,
        password: dpPassword,
      });
      if (signInError) {
        setError(`Não foi possível autenticar o DP: ${signInError.message}`);
        return;
      }
      setDpPassword('');
      setSuccess('Acesso de DP autorizado.');
    } catch (reason) {
      setError(`Falha de comunicação ao autenticar o DP: ${errorMessage(reason)}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(`Não foi possível encerrar a sessão do DP: ${signOutError.message}`);
      return;
    }
    setSuccess('Sessão do DP encerrada. O módulo está em modo de visualização.');
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setDataAvailable(false);
    setError('');
    try {
      const [minimumResult, assignmentResult, leaveResult] = await Promise.all([
        supabase.from('vacation_coverage_bases').select('*').order('funcao').order('plantao'),
        supabase.from('shift_assignments').select('employee_id,date,shift_group,role,status').gte('date', today).order('date').limit(10000),
        supabase.from('leave_records').select('employee_id,start_date,end_date,status,leave_type').order('start_date').limit(10000),
      ]);
      const failed = [minimumResult, assignmentResult, leaveResult].find((result) => result.error);
      if (failed?.error) {
        setError(`Falha ao carregar dados da programação: ${failed.error.message}. Confirme a migration e as permissões do Supabase.`);
        return;
      }
      if ((assignmentResult.data || []).length >= 10000 || (leaveResult.data || []).length >= 10000) {
        setError('A consulta atingiu o limite de segurança de 10.000 registros. A programação foi bloqueada para não validar uma cobertura incompleta.');
        return;
      }
      setMinimums((minimumResult.data || []) as VacationMinimum[]);
      setAssignments((assignmentResult.data || []) as VacationAssignment[]);
      setLeaves((leaveResult.data || []) as VacationLeave[]);
      if (isDp) {
        const [esocialResult, historyResult] = await Promise.all([
          supabase.from('employee_esocial_data').select('employee_id,cpf'),
          supabase.from('vacation_schedule_history').select('*').order('occurred_at', { ascending: false }).limit(50),
        ]);
        const privateDataError = esocialResult.error || historyResult.error;
        if (privateDataError) {
          setError(`Falha ao carregar dados eSocial/histórico: ${privateDataError.message}. Confirme a migration e a autorização de DP.`);
          return;
        }
        setEsocialByEmployee(Object.fromEntries((esocialResult.data || []).map((record) => [record.employee_id, record.cpf])));
        setScheduleHistory((historyResult.data || []) as VacationScheduleHistory[]);
      } else {
        setEsocialByEmployee({});
        setScheduleHistory([]);
      }
      setDataAvailable(true);
    } catch (reason) {
      setError(`Falha de comunicação ao carregar dados da programação: ${errorMessage(reason)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isDp, today]);

  useEffect(() => { void loadData(); }, [loadData]);

  const planningEmployees = useMemo<VacationEmployee[]>(() => employees.map((employee) => ({
    id: employee.id,
    registration: employee.registration,
    name: employee.name,
    role: employee.role,
    shift_group: employee.shift_group,
    shift_type: employee.shift_type,
    status: employee.status,
    vacation_2026: employee.vacation_2026,
    vacation_2027: employee.vacation_2027,
  })), [employees]);

  const planned = useMemo(() => planVacationPrograms({
    programs,
    employees: planningEmployees,
    minimums,
    assignments,
    leaves,
    today,
  }), [programs, planningEmployees, minimums, assignments, leaves, today]);

  const coverageGaps = useMemo(() => calculateCoverageGaps({
    employees: planningEmployees,
    minimums,
    assignments,
    leaves,
    programs,
    today,
  }), [planningEmployees, minimums, assignments, leaves, programs, today]);

  const roleOptions = useMemo(() => [...new Set(employees.map((employee) => employee.role).filter(Boolean))].sort(), [employees]);
  const groupOptions = useMemo(() => [...new Set(employees.map((employee) => employee.shift_group || employee.shift_type || '').filter(Boolean))].sort(), [employees]);
  const validImportRows = preview.filter((row) => row.program);
  const invalidImportCount = preview.length - validImportRows.length;
  const criticalCount = programs.filter((program) => {
    const days = Math.round((Date.parse(`${program.dt_limite_maxima}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const lifecycle = getVacationLifecycleStatus(program.data_inicio_programada, program.data_fim_programada, today);
    return lifecycle !== 'Concluída' && lifecycle !== 'Em Gozo' && days <= 30;
  }).length;
  const attentionCount = programs.filter((program) => {
    const days = Math.round((Date.parse(`${program.dt_limite_maxima}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const lifecycle = getVacationLifecycleStatus(program.data_inicio_programada, program.data_fim_programada, today);
    return lifecycle !== 'Concluída' && lifecycle !== 'Em Gozo' && days > 30 && days <= 60;
  }).length;
  const validatedCount = planned.filter((item) =>
    item.status === 'PROGRAMADO' &&
    item.program.data_inicio_programada !== null &&
    item.program.data_fim_programada !== null).length;
  const conflictCount = planned.filter((item) =>
    item.status === 'CONFLITO' || item.status === 'BLOQUEADO').length;
  const manualCount = programs.filter((program) => program.ajuste_manual_flag).length;
  const automaticCount = programs.filter((program) =>
    !program.ajuste_manual_flag &&
    program.data_inicio_programada !== null &&
    program.data_fim_programada !== null).length;
  const filteredPlanned = planned.filter((item) => {
    const program = item.program;
    const employee = employees.find((candidate) => candidate.id === program.employee_id);
    const days = Math.round((Date.parse(`${program.dt_limite_maxima}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const lifecycle = getVacationLifecycleStatus(program.data_inicio_programada, program.data_fim_programada, today);
    const isProjected = !program.ajuste_manual_flag && Boolean(program.data_inicio_programada && program.data_fim_programada);
    const urgencyMatches = urgencyFilter === 'all' ||
      (urgencyFilter === 'critical' && lifecycle !== 'Concluída' && lifecycle !== 'Em Gozo' && days <= 30) ||
      (urgencyFilter === 'attention' && lifecycle !== 'Concluída' && lifecycle !== 'Em Gozo' && days > 30 && days <= 60) ||
      (urgencyFilter === 'conflict' && (item.status === 'CONFLITO' || item.status === 'BLOQUEADO')) ||
      (urgencyFilter === 'scheduled' && item.status === 'PROGRAMADO' && Boolean(program.data_inicio_programada && program.data_fim_programada)) ||
      (urgencyFilter === 'regular' && days > 60 && !isProjected) ||
      (urgencyFilter === 'projected' && isProjected);
    const group = employee?.shift_group || employee?.shift_type || '';
    const search = searchText.trim().toLocaleLowerCase('pt-BR');
    const textMatches = !search ||
      employee?.name.toLocaleLowerCase('pt-BR').includes(search) ||
      employee?.registration.toLocaleLowerCase('pt-BR').includes(search);
    return urgencyMatches &&
      (!filterGroup || group === filterGroup) &&
      (!filterRole || employee?.role === filterRole) &&
      textMatches;
  });
  const calendarDates = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: dayCount }, (_, index) =>
      `${selectedMonth}-${String(index + 1).padStart(2, '0')}`);
  }, [selectedMonth]);
  const programsForCoverage = useMemo(() => planned
    .filter((item) => item.start && item.end)
    .map((item) => ({
      ...item.program,
      data_inicio_programada: item.start,
      data_fim_programada: item.end,
    })), [planned]);
  const monthlyCoverage = useMemo(() => new Map(calendarDates.map((date) => [
    date,
    summarizeShiftCoverage({
      date,
      employees: planningEmployees,
      assignments,
      leaves,
      programs: programsForCoverage,
      minimums,
    }),
  ])), [calendarDates, planningEmployees, assignments, leaves, programsForCoverage, minimums]);
  const selectedCoverage = monthlyCoverage.get(selectedCoverageDate) || [];

  const exportCsv = () => {
    if (!isDp) {
      setError('A exportação com dados eSocial é restrita ao DP autorizado.');
      return;
    }
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Matrícula', 'CPF', 'Nome', 'Função', 'Turno/Plantão', 'Início aquisitivo', 'Fim aquisitivo', 'Fim concessivo', 'Dias de gozo', 'Início de férias', 'Fim de férias', 'Status', 'Validação operacional', 'Observação DP'],
      ...planned.map(({ program, start, end, status, message }) => {
        const employee = employees.find((candidate) => candidate.id === program.employee_id);
        return [
          program.employee_id ? employee?.registration : '',
          esocialByEmployee[program.employee_id] ? `'${esocialByEmployee[program.employee_id]}` : '',
          employee?.name || '',
          employee?.role || '',
          employee?.shift_group || employee?.shift_type || '',
          program.periodo_aquisitivo_inicio,
          program.periodo_aquisitivo_fim,
          program.periodo_concessivo_fim || program.dt_limite_maxima,
          start && end ? inclusiveDays(start, end) : program.dias_gozo,
          start || '',
          end || '',
          getVacationLifecycleStatus(start, end, today),
          `${status}: ${message}`,
          program.observacao_dp,
        ];
      }),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `programacao-ferias-esocial-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setError('');
    setSuccess('Relatório CSV compatível com Excel exportado.');
  };

  const printReport = () => {
    if (!isDp) {
      setError('A impressão do relatório eSocial é restrita ao DP autorizado.');
      return;
    }
    window.print();
  };

  const handleFile = async (file?: File) => {
    setError('');
    setSuccess('');
    setPreview([]);
    if (!file) return;
    try {
      const text = decodeTabularFile(await file.arrayBuffer());
      setPreview(parseVacationImport(text));
    } catch (reason) {
      setError(`Não foi possível ler a planilha: ${errorMessage(reason)}`);
    }
  };

  const importRows = async () => {
    if (!isDp) {
      setError('Somente o DP autorizado pode importar dados de férias.');
      return;
    }
    const rows = validImportRows.filter((row) => row.program);
    if (rows.length === 0) return;
    setIsImporting(true);
    setError('');
    setSuccess('');
    try {
      const registrations = [...new Set(rows.map((row) => row.program!.employee.registration))];
      const { data: existingEmployees, error: employeeReadError } = await supabase
        .from('employees')
        .select('*')
        .in('registration', registrations);
      if (employeeReadError) throw new Error(`Falha ao consultar matrículas existentes: ${employeeReadError.message}`);
      const employeesByRegistration = new Map((existingEmployees || []).map((employee) => [employee.registration, employee as Employee]));
      const employeeWrites = new Map<string, EmployeeWrite>();
      const importedCpfByRegistration = new Map<string, string>();
      const importErrors: string[] = [];

      for (const row of rows) {
        const source = row.program!.employee;
        if (source.cpf) {
          const previousCpf = importedCpfByRegistration.get(source.registration);
          if (previousCpf && previousCpf !== source.cpf) {
            importErrors.push(`Linha ${row.line} (${source.registration}): CPFs divergem entre períodos da mesma matrícula.`);
            continue;
          }
          importedCpfByRegistration.set(source.registration, source.cpf);
        }
        const existing = employeesByRegistration.get(source.registration);
        const previousWrite = employeeWrites.get(source.registration);
        const configuredScale = findSchedule(source.shiftGroup, employees);
        const scheduleStart = source.scheduleStart || existing?.schedule_start || previousWrite?.schedule_start || configuredScale?.start_time;
        const scheduleEnd = source.scheduleEnd || existing?.schedule_end || previousWrite?.schedule_end || configuredScale?.end_time;
        const sector = source.sector || existing?.sector || previousWrite?.sector;
        if (!scheduleStart || !scheduleEnd) {
          importErrors.push(`Linha ${row.line} (${source.registration}): não há horário informado nem escala ativa única configurada para ${source.shiftGroup}.`);
          continue;
        }
        if (!sector) {
          importErrors.push(`Linha ${row.line} (${source.registration}): setor/área é obrigatório para cadastrar uma matrícula nova.`);
          continue;
        }
        if (previousWrite && (
          previousWrite.name !== source.name ||
          previousWrite.role !== source.role ||
          previousWrite.sector !== sector ||
          previousWrite.shift_group !== source.shiftGroup ||
          previousWrite.status !== employeeStatus(source.status)
        )) {
          importErrors.push(`Linha ${row.line} (${source.registration}): dados cadastrais divergem entre períodos da mesma matrícula.`);
          continue;
        }
        const status = employeeStatus(source.status);
        employeeWrites.set(source.registration, {
          ...(existing || {}),
          ...(existing ? { id: existing.id } : {}),
          registration: source.registration,
          name: source.name,
          role: source.role,
          sector,
          shift_group: source.shiftGroup,
          shift_type: source.shiftType || existing?.shift_type || '',
          status,
          hire_date: source.hireDate ?? existing?.hire_date ?? null,
          schedule_start: scheduleStart,
          schedule_end: scheduleEnd,
          scale_status: statusForScale(status),
          notes: existing?.notes || '',
          vacation_2026: source.vacation2026 ?? existing?.vacation_2026 ?? null,
          vacation_2027: source.vacation2027 ?? existing?.vacation_2027 ?? null,
        });
      }
      if (importErrors.length > 0) throw new Error(importErrors.join(' '));
      const employeePayloads = [...employeeWrites.values()];
      const { data: savedEmployees, error: employeeWriteError } = await supabase
        .from('employees')
        .upsert(employeePayloads, { onConflict: 'registration' })
        .select('id,registration');
      if (employeeWriteError) throw new Error(`Falha ao salvar colaboradores por matrícula: ${employeeWriteError.message}`);
      const employeeIds = (savedEmployees || []).map((employee) => employee.id);
      if (employeeIds.length !== employeePayloads.length) {
        throw new Error('O Supabase não retornou todas as matrículas após o upsert; os períodos de férias não foram gravados.');
      }
      const idsByRegistration = new Map((savedEmployees || []).map((employee) => [employee.registration, employee.id]));
      const esocialWrites = [...importedCpfByRegistration.entries()].map(([registration, cpf]) => {
        if (!isValidCpf(cpf)) throw new Error(`CPF inválido para a matrícula ${registration}.`);
        const employeeId = idsByRegistration.get(registration);
        if (!employeeId) throw new Error(`Matrícula ${registration} não retornou id_colaborador para o CPF.`);
        return { employee_id: employeeId, cpf, updated_at: new Date().toISOString() };
      });
      if (esocialWrites.length > 0) {
        const { error: esocialWriteError } = await supabase
          .from('employee_esocial_data')
          .upsert(esocialWrites, { onConflict: 'employee_id' });
        if (esocialWriteError) throw new Error(`Colaboradores foram salvos, mas falhou a gravação protegida do CPF: ${esocialWriteError.message}`);
      }
      const { data: oldPrograms, error: oldProgramReadError } = await supabase
        .from('vacation_schedules')
        .select('*')
        .in('employee_id', employeeIds);
      if (oldProgramReadError) {
        throw new Error(`Colaboradores foram salvos, mas não foi possível consultar programações anteriores: ${oldProgramReadError.message}`);
      }
      const programKey = (employeeId: string, start: string, end: string) => `${employeeId}|${start}|${end}`;
      const oldProgramsByKey = new Map((oldPrograms || []).map((program) => [
        programKey(program.employee_id, program.periodo_aquisitivo_inicio, program.periodo_aquisitivo_fim),
        program as VacationProgram,
      ]));
      const programWrites = rows.map((row) => {
        const source = row.program!;
        const employeeId = idsByRegistration.get(source.employee.registration);
        if (!employeeId) throw new Error(`Matrícula ${source.employee.registration} não retornou id_colaborador.`);
        const old = oldProgramsByKey.get(programKey(employeeId, source.acquisitionStart, source.acquisitionEnd));
        const importedStart = source.scheduledStart || null;
        const importedEnd = source.scheduledEnd ||
          (importedStart && source.daysOff ? addCalendarDays(importedStart, source.daysOff - 1) : null);
        const keepManual = Boolean(old?.ajuste_manual_flag);
        return {
          employee_id: employeeId,
          periodo_aquisitivo_inicio: source.acquisitionStart,
          periodo_aquisitivo_fim: source.acquisitionEnd,
          dt_limite_maxima: source.safeDeadline,
          status: getVacationLifecycleStatus(importedStart, importedEnd, today),
          dias_gozo: keepManual && source.daysOff === undefined ? old?.dias_gozo ?? 30 : source.daysOff ?? old?.dias_gozo ?? 30,
          data_inicio_programada: keepManual ? old?.data_inicio_programada ?? null : importedStart ?? old?.data_inicio_programada ?? null,
          data_fim_programada: keepManual ? old?.data_fim_programada ?? null : importedEnd ?? old?.data_fim_programada ?? null,
          ajuste_manual_flag: keepManual || Boolean(importedStart),
          observacao_dp: old?.observacao_dp || '',
        };
      });
      const { error: programWriteError } = await supabase
        .from('vacation_schedules')
        .upsert(programWrites, { onConflict: 'employee_id,periodo_aquisitivo_inicio,periodo_aquisitivo_fim' });
      if (programWriteError) {
        throw new Error(`Colaboradores foram salvos, mas falhou a persistência dos períodos aquisitivos: ${programWriteError.message}`);
      }
      setSuccess(`${rows.length} matrícula(s) e período(s) processados por upsert. Linhas inválidas ignoradas: ${invalidImportCount}.`);
      setPreview([]);
      await onDataChanged();
    } catch (reason) {
      setError(`Importação interrompida: ${errorMessage(reason)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const saveMinimum = async () => {
    if (!isDp) {
      setError('Somente o DP autorizado pode alterar mínimos operacionais.');
      return;
    }
    const count = Number(minimumCount);
    if (!minimumRole || !minimumGroup || !Number.isInteger(count) || count < 0) {
      setError('Informe função, turno/plantão e um mínimo inteiro igual ou maior que zero.');
      return;
    }
    const role = minimumRole.trim().replace(/\s+/g, ' ').toUpperCase();
    const shiftGroup = minimumGroup.trim().replace(/\s+/g, ' ').toUpperCase();
    setError('');
    setSuccess('');
    try {
      const { error: saveError } = await supabase
        .from('vacation_coverage_bases')
        .upsert({ funcao: role, plantao: shiftGroup, minimo_operacional: count }, { onConflict: 'funcao,plantao' });
      if (saveError) {
        setError(`Não foi possível salvar o mínimo de cobertura: ${saveError.message}`);
        return;
      }
      setMinimumCount('');
      setSuccess(`Mínimo salvo: ${role} × ${shiftGroup} = ${count}.`);
      await loadData();
    } catch (reason) {
      setError(`Falha de comunicação ao salvar mínimo: ${errorMessage(reason)}`);
    }
  };

  const updateProgram = (id: string, patch: Partial<VacationProgram>) => {
    if (!isDp) return;
    setPrograms((current) => current.map((program) => program.id === id ? { ...program, ...patch } : program));
    setSuccess('');
  };

  const suggestPlan = () => {
    if (!isDp) {
      setError('Somente o DP autorizado pode sugerir ou recalcular a programação.');
      return;
    }
    if (!dataAvailable) {
      setError('Não é possível sugerir enquanto os dados operacionais não estiverem carregados integralmente.');
      return;
    }
    const balancedSuggestions = planVacationPrograms({
      programs: programs.map((program) => program.ajuste_manual_flag
        ? program
        : { ...program, data_inicio_programada: null, data_fim_programada: null }),
      employees: planningEmployees,
      minimums,
      assignments,
      leaves,
      today,
      allocationStrategy: 'balanced',
    });
    setPrograms((current) => current.map((program) => {
      if (program.ajuste_manual_flag) return program;
      const result = balancedSuggestions.find((item) => item.program.id === program.id);
      return result?.status === 'PROGRAMADO'
        ? { ...program, data_inicio_programada: result.start, data_fim_programada: result.end }
        : { ...program, data_inicio_programada: null, data_fim_programada: null };
    }));
    setSuccess('Sugestões equilibradas por mês calculadas em memória. Confira cobertura e datas antes de confirmar.');
    setError('');
  };

  const savePlan = () => {
    if (!isDp) {
      setError('Somente o DP autorizado pode salvar a programação.');
      return;
    }
    if (!dataAvailable) {
      setError('Não é possível salvar enquanto os dados operacionais não estiverem carregados integralmente.');
      return;
    }
    if (planned.some((item) => item.status === 'CONFLITO')) {
      setError('Existem férias que violam a cobertura mínima. Corrija as datas ou os mínimos antes de salvar.');
      return;
    }
    if (programs.length === 0) return;
    setShowSaveConfirmation(true);
  };

  const persistPlan = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');
    setShowSaveConfirmation(false);
    try {
      const payload = planned.map((item) => ({
        id: item.program.id,
        employee_id: item.program.employee_id,
        periodo_aquisitivo_inicio: item.program.periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim: item.program.periodo_aquisitivo_fim,
        dt_limite_maxima: item.program.dt_limite_maxima,
        dias_gozo: item.start && item.end ? inclusiveDays(item.start, item.end) : item.program.dias_gozo,
        data_inicio_programada: item.start,
        data_fim_programada: item.end,
        status: getVacationLifecycleStatus(item.start, item.end, today),
        ajuste_manual_flag: item.program.ajuste_manual_flag,
        observacao_dp: item.program.observacao_dp,
        updated_at: new Date().toISOString(),
      }));
      const { error: saveError } = await supabase
        .from('vacation_schedules')
        .upsert(payload, { onConflict: 'employee_id,periodo_aquisitivo_inicio,periodo_aquisitivo_fim' });
      if (saveError) {
        setError(`Não foi possível salvar o plano: ${saveError.message}`);
        return;
      }
      setSuccess('Plano salvo. Itens sem dados de duração ou cobertura permanecem pendentes, sem datas inventadas.');
      await Promise.all([loadData(), onDataChanged()]);
    } catch (reason) {
      setError(`Falha de comunicação ao salvar plano: ${errorMessage(reason)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Programação de férias"
        description="Planeje períodos por matrícula, prazo seguro e cobertura diária por função e turno/plantão."
        actions={
          <button onClick={() => { void loadData(); }} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Atualizar
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de férias">
        {[
          { title: 'Férias vencidas / críticas', value: criticalCount, detail: 'vencidas ou vencem em até 30 dias', icon: AlertTriangle, tone: 'rose', border: 'border-rose-500/25', filter: 'critical' as UrgencyFilter },
          { title: 'Em risco', value: attentionCount, detail: 'limite entre 31 e 60 dias', icon: CalendarClock, tone: 'amber', border: 'border-amber-500/25', filter: 'attention' as UrgencyFilter },
          { title: 'Conflitos de mínimo', value: conflictCount, detail: `${coverageGaps.length} dias/turnos abaixo do mínimo`, icon: ShieldAlert, tone: 'orange', border: 'border-orange-500/25', filter: 'conflict' as UrgencyFilter },
          { title: 'Férias agendadas', value: validatedCount, detail: `${manualCount} manuais · ${automaticCount} automáticas`, icon: CheckCircle2, tone: 'emerald', border: 'border-emerald-500/25', filter: 'scheduled' as UrgencyFilter },
        ].map(({ title, value, detail, icon: Icon, tone, border, filter }) => (
          <button key={title} type="button" onClick={() => setUrgencyFilter(urgencyFilter === filter ? 'all' : filter)} aria-pressed={urgencyFilter === filter} className={`rounded-xl border bg-slate-800 p-4 text-left transition hover:bg-slate-700/70 ${tone === 'rose' && value > 0 ? 'border-rose-500/50' : border} ${urgencyFilter === filter ? 'ring-2 ring-amber-400/50' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
              <Icon size={17} className={tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : tone === 'orange' ? 'text-orange-300' : 'text-emerald-300'} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${tone === 'rose' && value > 0 ? 'animate-pulse text-rose-300' : tone === 'amber' ? 'text-amber-200' : tone === 'orange' ? 'text-orange-200' : 'text-slate-100'}`}>{value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
          </button>
        ))}
      </section>

      <section className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${isDp ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-800'}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg p-2 ${isDp ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
            {isDp ? <Check size={17} /> : <LogIn size={17} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{isDp ? 'Acesso de DP autorizado' : 'Modo de visualização'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {isDp
                ? `Sessão autenticada como ${DP_EMAIL}. Alterações também são protegidas pelo Supabase.`
                : 'As tabelas e os alertas estão disponíveis para consulta. Autentique-se para importar, programar ou alterar mínimos.'}
            </p>
          </div>
        </div>
        {isDp ? (
          <button onClick={() => { void signOut(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
            <LogOut size={14} /> Encerrar sessão DP
          </button>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void signInAsDp(); }} className="flex flex-wrap items-end gap-2">
            <Input label="Conta DP" type="email" value={DP_EMAIL} readOnly className="min-w-64" />
            <Input label="Senha Supabase Auth" type="password" value={dpPassword} onChange={(event) => setDpPassword(event.target.value)} autoComplete="current-password" className="min-w-48" />
            <button type="submit" disabled={isSigningIn || !dpPassword} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              <LogIn size={15} /> {isSigningIn ? 'Autenticando…' : 'Entrar como DP'}
            </button>
            {authEmail && authEmail !== DP_EMAIL && <p className="basis-full text-xs text-amber-300">A sessão atual ({authEmail}) não tem permissão para editar férias.</p>}
          </form>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="flex items-center gap-2 text-amber-300">
            <FileUp size={18} />
            <h3 className="font-semibold">Importar arquivo de DP</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            CSV, TSV ou texto delimitado; aceita UTF-8 e Windows-1252. A matrícula, nome, função e início/fim aquisitivos são obrigatórios. O padrão é 30 dias; cada intervalo registrado deve ter de 14 a 30 dias.
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/50 px-4 py-4 text-sm font-medium text-slate-200 hover:border-amber-500/60 hover:bg-slate-900">
            <FileUp size={17} /> Selecionar CSV/TSV
            <input type="file" accept=".csv,.tsv,.txt,.text,text/csv,text/tab-separated-values" className="sr-only" disabled={!isDp} onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          {preview.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-xs text-slate-300">
                {validImportRows.length} linha(s) válidas · {invalidImportCount} linha(s) ignoradas
              </p>
              <button onClick={() => { void importRows(); }} disabled={!isDp || isImporting || validImportRows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#e3a62f] px-3 py-2 text-xs font-bold text-[#0b2538] disabled:opacity-50">
                <FileUp size={14} /> {isImporting ? 'Importando…' : 'Importar linhas válidas'}
              </button>
            </div>
          )}
          {preview.length > 0 && (
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {preview.map((row) => (
                <div key={row.line} className={`rounded-lg border p-3 text-xs ${row.errors.length ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700 bg-slate-900/40'}`}>
                  <p className="font-semibold text-slate-200">Linha {row.line} · {row.program?.employee.registration || 'sem matrícula'}</p>
                  {row.errors.map((item) => <p key={item} className="mt-1 text-rose-300">{item}</p>)}
                  {row.warnings.map((item) => <p key={item} className="mt-1 text-amber-300">{item}</p>)}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Os TSVs antigos não têm matrícula nem período aquisitivo e não serão vinculados por nome. Novas matrículas precisam de setor/área e de escala ativa configurada (ou horários presentes no cadastro existente).</span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="flex items-center gap-2 text-sky-300">
            <Settings2 size={18} />
            <h3 className="font-semibold">Mínimos de cobertura</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Sem mínimo explícito e escala operacional diária, a automação não aloca férias para aquele grupo. Nenhuma quantidade padrão é presumida.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Select label="Função" value={minimumRole} onChange={(event) => setMinimumRole(event.target.value)} options={roleOptions.map((role) => ({ value: role, label: role }))} placeholder="Selecione" disabled={!isDp} />
            <Select label="Turno / plantão" value={minimumGroup} onChange={(event) => setMinimumGroup(event.target.value)} options={groupOptions.map((group) => ({ value: group, label: group }))} placeholder="Selecione" disabled={!isDp} />
            <Input label="Mínimo simultâneo" type="number" min="0" step="1" value={minimumCount} onChange={(event) => setMinimumCount(event.target.value)} placeholder="Ex.: 0" disabled={!isDp} />
            <div className="flex items-end">
              <button onClick={() => { void saveMinimum(); }} disabled={!isDp} className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">Salvar mínimo</button>
            </div>
          </div>
          {minimums.length === 0 ? (
            <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">Nenhum mínimo configurado. A geração automática permanecerá bloqueada.</p>
          ) : (
            <div className="mt-4 max-h-40 space-y-1 overflow-y-auto">
              {minimums.map((minimum) => (
                <div key={`${minimum.funcao}-${minimum.plantao}`} className="flex items-center justify-between rounded-md bg-slate-900/60 px-3 py-2 text-xs">
                  <span className="text-slate-300">{minimum.funcao} · {minimum.plantao}</span>
                  <span className="font-semibold text-slate-100">{minimum.minimo_operacional}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {(error || success) && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${error ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0" />}
          <span>{error || success}</span>
        </div>
      )}

      {coverageGaps.length > 0 && (
        <section className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-100" role="status">
          <div className="flex items-start gap-2">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{coverageGaps.length} gargalo(s) de cobertura encontrado(s)</p>
              <p className="mt-1 text-xs text-orange-200">
                {coverageGaps.slice(0, 4).map((gap) => `${gap.date}: ${gap.funcao} · ${gap.plantao} (${gap.disponiveis}/${gap.minimo})`).join(' · ')}
                {coverageGaps.length > 4 ? ' · …' : ''}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5" aria-labelledby="shift-summary-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="shift-summary-title" className="font-semibold text-slate-100">Resumo operacional de plantões</h3>
            <p className="mt-1 text-xs text-slate-400">Impacto diário das férias na cobertura por função e turno.</p>
          </div>
          <label className="text-xs text-slate-400">
            Mês do cronograma
            <input
              type="month"
              min={today.slice(0, 7)}
              value={selectedMonth}
              onChange={(event) => {
                const nextMonth = event.target.value;
                if (!nextMonth) return;
                setSelectedMonth(nextMonth);
                setSelectedCoverageDate(nextMonth === today.slice(0, 7) ? today : `${nextMonth}-01`);
              }}
              className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              aria-label="Mês do cronograma de plantões"
            />
          </label>
        </div>
        <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={`Calendário operacional de ${selectedMonth}`}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((weekday, index) => (
            <div key={`${weekday}-${index}`} className="py-1 text-center text-[10px] font-semibold text-slate-500">{weekday}</div>
          ))}
          {Array.from({ length: new Date(`${selectedMonth}-01T00:00:00Z`).getUTCDay() }, (_, index) => (
            <div key={`blank-${index}`} aria-hidden="true" />
          ))}
          {calendarDates.map((date) => {
            const rows = monthlyCoverage.get(date) || [];
            const isConflict = rows.some((row) => row.status === 'CONFLITO');
            const isPending = rows.length === 0 || rows.some((row) => row.status === 'PENDENTE');
            const isPast = date < today;
            const tone = isPast
              ? 'border-slate-800 bg-slate-900/30 text-slate-600'
              : isConflict
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                : isPending
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200';
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                disabled={isPast}
                onClick={() => setSelectedCoverageDate(date)}
                aria-pressed={selectedCoverageDate === date}
                aria-label={`${displayDate(date)}: ${isConflict ? 'conflito de cobertura' : isPending ? 'cobertura pendente' : 'cobertura validada'}`}
                className={`min-h-14 rounded-lg border p-1.5 text-left transition hover:brightness-125 disabled:cursor-default ${tone} ${selectedCoverageDate === date ? 'ring-2 ring-sky-400' : ''}`}
              >
                <span className="text-xs font-semibold">{Number(date.slice(-2))}</span>
                <span className="mt-1 block text-[9px] leading-tight">
                  {isPast ? 'passado' : isConflict ? 'conflito' : isPending ? 'pendente' : `${rows.length} grupos OK`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400" aria-label="Legenda de cobertura">
          <span className="text-emerald-300">Verde · cobertura validada</span>
          <span className="text-amber-300">Amarelo · escala/mínimo pendente</span>
          <span className="text-rose-300">Vermelho · abaixo do mínimo</span>
        </div>

        <div className="mt-5 border-t border-slate-700 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Plantões em {displayDate(selectedCoverageDate)}</h4>
              <p className="mt-1 text-xs text-slate-400">Ativos na escala diária · férias programadas · mínimo operacional.</p>
            </div>
            {isDp && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                  <Download size={14} /> CSV / Excel
                </button>
                <button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                  <Printer size={14} /> Imprimir / PDF
                </button>
              </div>
            )}
          </div>
          {selectedCoverage.length === 0 ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">Sem colaboradores ativos com função e plantão cadastrados para resumir.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Plantão</th>
                    <th className="px-3 py-2">Função</th>
                    <th className="px-3 py-2">Escalados</th>
                    <th className="px-3 py-2">Ativos</th>
                    <th className="px-3 py-2">Em férias</th>
                    <th className="px-3 py-2">Mínimo</th>
                    <th className="px-3 py-2">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {selectedCoverage.map((row) => (
                    <tr key={`${row.plantao}-${row.funcao}`}>
                      <td className="px-3 py-2 font-semibold text-slate-200">{row.plantao}</td>
                      <td className="px-3 py-2 text-slate-300">{row.funcao}</td>
                      <td className="px-3 py-2 text-slate-300">{row.escalados}</td>
                      <td className="px-3 py-2 font-semibold text-slate-100">
                        {row.percentualAtivo === null ? '—' : `${row.percentualAtivo}% (${row.disponiveis}/${row.escalados})`}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{row.emFerias}</td>
                      <td className="px-3 py-2 text-slate-300">{row.minimo ?? 'não configurado'}</td>
                      <td className={`px-3 py-2 font-semibold ${row.status === 'OK' ? 'text-emerald-300' : row.status === 'CONFLITO' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {row.status === 'OK' ? 'OK' : row.status === 'CONFLITO' ? 'Abaixo do mínimo' : 'Pendente'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-300">
          <Filter size={16} />
          <h3 className="text-xs font-semibold uppercase tracking-wide">Filtros operacionais</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative">
            <span className="sr-only">Buscar por nome ou matrícula</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Nome ou matrícula" className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500" />
          </label>
          <Select label="Urgência" value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value as UrgencyFilter)} options={[
            { value: 'all', label: 'Todas as situações' },
            { value: 'critical', label: 'Críticos · até 30 dias' },
            { value: 'attention', label: 'Em risco · 31–60 dias' },
            { value: 'conflict', label: 'Com conflito/bloqueio' },
            { value: 'scheduled', label: 'Agendados e validados' },
            { value: 'regular', label: 'Regular' },
            { value: 'projected', label: 'Projetado pelo algoritmo' },
          ]} />
          <Select label="Plantão / turno" value={filterGroup} onChange={(event) => setFilterGroup(event.target.value)} options={groupOptions.map((group) => ({ value: group, label: group }))} placeholder="Todos os plantões" />
          <Select label="Função" value={filterRole} onChange={(event) => setFilterRole(event.target.value)} options={roleOptions.map((role) => ({ value: role, label: role }))} placeholder="Todas as funções" />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300"><CalendarDays size={18} /></div>
            <div>
              <h3 className="font-semibold text-slate-100">Plano por período aquisitivo</h3>
              <p className="mt-1 text-xs text-slate-400">{filteredPlanned.length} de {programs.length} períodos · prioridade pelo limite mais próximo</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={suggestPlan} disabled={!isDp || isLoading || !dataAvailable || programs.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
              <Sparkles size={15} /> ⚡ Sugerir Escala Automática (IA/Algoritmo)
            </button>
            <button onClick={() => { void savePlan(); }} disabled={!isDp || isLoading || !dataAvailable || isSaving || programs.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Save size={15} /> {isSaving ? 'Salvando…' : 'Salvar plano'}
            </button>
          </div>
        </div>
        {planned.some((item) => item.status === 'CONFLITO') && (
          <div className="border-b border-rose-500/20 bg-rose-500/5 px-5 py-3 text-xs text-rose-200">
            {planned.filter((item) => item.status === 'CONFLITO').length} programação(ões) conflitam com janela aquisitiva ou cobertura. O plano não será salvo enquanto os conflitos persistirem.
          </div>
        )}
        {showSaveConfirmation && (
          <div className="border-b border-sky-500/30 bg-sky-500/10 px-5 py-4" role="dialog" aria-modal="true" aria-labelledby="vacation-save-confirm-title">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
              <div>
                <h4 id="vacation-save-confirm-title" className="text-sm font-semibold text-sky-100">Validar alterações antes de salvar</h4>
                <p className="mt-1 text-xs text-sky-200">
                  {planned.filter((item) => item.status === 'PROGRAMADO').length} programação(ões) sem conflito · {planned.filter((item) => item.status === 'PENDENTE' || item.status === 'BLOQUEADO').length} pendente(s)/bloqueada(s).
                  {' '}As datas editadas foram recalculadas em memória; gargalos identificados não podem ser persistidos.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSaveConfirmation(false)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Revisar</button>
                <button onClick={() => { void persistPlan(); }} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
                  <Check size={14} /> {isSaving ? 'Salvando…' : 'Confirmar e salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando programações e escalas diárias…</div>
        ) : programs.length === 0 ? (
          <EmptyState message="Importe uma exportação corrigida com matrícula e período aquisitivo para iniciar o plano." />
        ) : filteredPlanned.length === 0 ? (
          <EmptyState message="Nenhum período corresponde aos filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] text-sm">
              <thead className="bg-slate-900/70 text-left text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Colaborador / matrícula</th>
                  <th className="px-4 py-3">Função · plantão</th>
                  <th className="px-4 py-3">Período aquisitivo</th>
                  <th className="px-4 py-3">Limite seguro</th>
                  <th className="px-4 py-3">Dias</th>
                  <th className="px-4 py-3">Início</th>
                  <th className="px-4 py-3">Fim</th>
                  <th className="px-4 py-3">Status da concessão</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Observação DP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredPlanned.map((item) => {
                  const program = programs.find((candidate) => candidate.id === item.program.id)!;
                  const employee = employees.find((candidate) => candidate.id === program.employee_id);
                  const legalLimit = calculateVacationDeadline(program.periodo_aquisitivo_inicio).legalLimit;
                  const deadlineDays = Math.round((Date.parse(`${program.dt_limite_maxima}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
                  const lifecycleStatus = getVacationLifecycleStatus(item.start, item.end, today);
                  const urgency = lifecycleStatus === 'Concluída' || lifecycleStatus === 'Em Gozo'
                    ? 'ontime'
                    : deadlineDays <= 30 ? 'critical' : deadlineDays <= 60 ? 'attention' : 'ontime';
                  const dueWithoutSchedule = (
                    !item.start ||
                    !item.end ||
                    item.status === 'CONFLITO' ||
                    item.status === 'BLOQUEADO'
                  ) && deadlineDays <= 30;
                  return (
                    <tr key={program.id} className={`align-top hover:bg-slate-900/30 ${urgency === 'critical' && deadlineDays < 0 ? 'bg-rose-950/35' : dueWithoutSchedule ? 'bg-amber-950/20' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">{employee?.name || 'Colaborador não encontrado'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Mat. {employee?.registration || '—'}</p>
                        {isDp && <p className="mt-1 text-[10px] text-slate-500">CPF {esocialByEmployee[program.employee_id] || 'não cadastrado'}</p>}
                        <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${program.ajuste_manual_flag ? 'bg-sky-500/15 text-sky-200' : program.data_inicio_programada ? 'bg-violet-500/15 text-violet-200' : 'bg-slate-700 text-slate-400'}`}>
                          {program.ajuste_manual_flag ? 'Ajuste Manual DP' : program.data_inicio_programada ? 'Sugerido via algoritmo' : 'Sem ajuste manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{employee?.role || '—'}<p className="mt-1 text-slate-500">{employee?.shift_group || employee?.shift_type || '—'}</p></td>
                      <td className="px-4 py-3 text-xs text-slate-300">{program.periodo_aquisitivo_inicio}<p className="mt-1 text-slate-500">até {program.periodo_aquisitivo_fim}</p></td>
                      <td className={`px-4 py-3 text-xs ${urgency === 'critical' ? 'text-rose-200' : urgency === 'attention' ? 'text-amber-200' : 'text-slate-300'}`}>
                        <span className="inline-flex items-center gap-1.5">
                          {urgency === 'critical' && <AlertTriangle size={13} className={deadlineDays < 0 ? 'animate-pulse' : ''} aria-label={deadlineDays < 0 ? 'Prazo vencido' : 'Prazo crítico'} />}
                          {program.periodo_concessivo_fim || program.dt_limite_maxima}
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${urgency === 'critical' ? 'bg-rose-500/20 text-rose-200' : urgency === 'attention' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                            {deadlineDays < 0 ? 'Vencido' : urgency === 'critical' ? 'Crítico' : urgency === 'attention' ? 'Atenção' : 'Em dia'}
                          </span>
                        </span>
                        <p className="mt-1 text-slate-500">limite legal: {legalLimit}</p>
                        {dueWithoutSchedule && <p className="mt-1 font-semibold">{deadlineDays < 0 ? `Vencido há ${Math.abs(deadlineDays)} dia(s)` : `Vence em ${deadlineDays} dia(s) · sem agendamento`}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" min="14" max="30" value={program.dias_gozo ?? 30} disabled={!isDp} onChange={(event) => updateProgram(program.id, { dias_gozo: event.target.value ? Number(event.target.value) : 30, data_fim_programada: program.data_inicio_programada && event.target.value ? addCalendarDays(program.data_inicio_programada, Number(event.target.value) - 1) : program.data_fim_programada, ajuste_manual_flag: Boolean(program.data_inicio_programada || program.ajuste_manual_flag) })} className="w-20 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60" aria-label={`Dias de gozo para ${employee?.name || program.employee_id}`} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" value={program.data_inicio_programada || ''} disabled={!isDp} onChange={(event) => updateProgram(program.id, { data_inicio_programada: event.target.value || null, data_fim_programada: event.target.value ? addCalendarDays(event.target.value, program.dias_gozo - 1) : null, ajuste_manual_flag: Boolean(event.target.value) })} className={`w-36 rounded-md border bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60 ${item.status === 'CONFLITO' ? 'border-rose-500' : 'border-slate-600'}`} aria-label={`Início programado para ${employee?.name || program.employee_id}`} aria-invalid={item.status === 'CONFLITO'} title={item.message} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" value={program.data_fim_programada || ''} disabled={!isDp} onChange={(event) => updateProgram(program.id, { data_fim_programada: event.target.value || null, dias_gozo: program.data_inicio_programada && event.target.value ? inclusiveDays(program.data_inicio_programada, event.target.value) : program.dias_gozo, ajuste_manual_flag: Boolean(event.target.value || program.data_inicio_programada) })} className={`w-36 rounded-md border bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60 ${item.status === 'CONFLITO' ? 'border-rose-500' : 'border-slate-600'}`} aria-label={`Fim programado para ${employee?.name || program.employee_id}`} aria-invalid={item.status === 'CONFLITO'} title={item.message} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${lifecycleStatus === 'Concluída' ? 'bg-slate-700 text-slate-300' : lifecycleStatus === 'Em Gozo' ? 'bg-sky-500/15 text-sky-200' : lifecycleStatus === 'Agendada' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
                          {lifecycleStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${item.status === 'PROGRAMADO' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : item.status === 'CONFLITO' || item.status === 'BLOQUEADO' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{item.status}</span>
                        <p className={`mt-1 max-w-64 text-[10px] leading-relaxed ${item.status === 'CONFLITO' ? 'text-rose-200' : 'text-slate-500'}`}>{item.message}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Textarea value={program.observacao_dp} disabled={!isDp} onChange={(event) => updateProgram(program.id, { observacao_dp: event.target.value })} rows={2} className="min-w-40 text-xs" aria-label={`Observação DP para ${employee?.name || program.employee_id}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>A contagem considera apenas escalas diárias cadastradas como Escalado/Cobertura/Trabalho e afastamentos pendentes ou aprovados. Sem escala diária completa, o resultado fica pendente. Um ajuste manual não ignora a cobertura mínima.</span>
      </p>

      {isDp && (
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5" aria-labelledby="vacation-history-title">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={17} className="text-sky-300" />
            <h3 id="vacation-history-title" className="text-sm font-semibold text-slate-100">Histórico de concessões</h3>
            <span className="text-xs text-slate-500">últimas 50 alterações</span>
          </div>
          {scheduleHistory.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma alteração auditada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Ação</th><th className="px-3 py-2">Período concessivo</th><th className="px-3 py-2">Responsável</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {scheduleHistory.map((entry) => {
                    const snapshot = entry.new_data || entry.old_data;
                    const concessionEnd = snapshot?.['periodo_concessivo_fim'] || snapshot?.['dt_limite_maxima'] || '—';
                    return (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 text-slate-300">{new Date(entry.occurred_at).toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-2 font-semibold text-slate-200">{entry.operation}</td>
                        <td className="px-3 py-2 text-slate-300">{String(concessionEnd)}</td>
                        <td className="px-3 py-2 text-slate-400">{entry.actor_email}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {isDp && (
        <section id="vacation-print-report" className="print-only" aria-label="Relatório para contabilidade e eSocial">
          <h1>Programação de Férias — SGO UNILINK</h1>
          <p>Emitido em {displayDate(today)} · Relatório para conferência do RH/DP e contabilidade.</p>
          <table>
            <thead>
              <tr>
                <th>Matrícula</th><th>CPF</th><th>Nome</th><th>Função</th><th>Plantão</th>
                <th>Período aquisitivo</th><th>Fim concessivo</th><th>Dias</th>
                <th>Início</th><th>Fim</th><th>Status</th><th>Validação</th>
              </tr>
            </thead>
            <tbody>
              {planned.map(({ program, start, end, status, message }) => {
                const employee = employees.find((candidate) => candidate.id === program.employee_id);
                return (
                  <tr key={program.id}>
                    <td>{employee?.registration || ''}</td>
                    <td>{esocialByEmployee[program.employee_id] || ''}</td>
                    <td>{employee?.name || ''}</td>
                    <td>{employee?.role || ''}</td>
                    <td>{employee?.shift_group || employee?.shift_type || ''}</td>
                    <td>{program.periodo_aquisitivo_inicio} — {program.periodo_aquisitivo_fim}</td>
                    <td>{program.periodo_concessivo_fim || program.dt_limite_maxima}</td>
                    <td>{start && end ? inclusiveDays(start, end) : program.dias_gozo}</td>
                    <td>{start || ''}</td>
                    <td>{end || ''}</td>
                    <td>{getVacationLifecycleStatus(start, end, today)}</td>
                    <td>{status}: {message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
