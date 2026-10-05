import { supabase } from '@/lib/supabase';
import type { Employee } from '@/types';
import type { VacationSchedule } from '@/types/vocation';

function firstValue(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function textValue(row: Record<string, unknown>, ...keys: string[]): string {
  const value = firstValue(row, ...keys);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function nullableTextValue(row: Record<string, unknown>, ...keys: string[]): string | null {
  const value = firstValue(row, ...keys);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function mapEmployee(row: Record<string, unknown>): Employee {
  const createdAt = textValue(row, 'created_at', 'criado_em');

  return {
    id: textValue(row, 'id'),
    name: textValue(row, 'nome', 'name'),
    cpf: nullableTextValue(row, 'cpf'),
    registration: textValue(row, 'registration', 'matricula', 'matrícula'),
    role: textValue(row, 'cargo', 'role', 'funcao', 'função'),
    sector: textValue(row, 'sector', 'setor'),
    shift_group: textValue(row, 'turno', 'shift', 'shift_group', 'plantao', 'plantão'),
    shift_type: textValue(row, 'shift_type', 'tipo_turno') || undefined,
    schedule_start: textValue(row, 'schedule_start', 'horario_inicio', 'hora_inicio'),
    schedule_end: textValue(row, 'schedule_end', 'horario_fim', 'hora_fim'),
    status: textValue(row, 'status', 'situacao', 'situação') || 'Ativo',
    hire_date: nullableTextValue(row, 'data_admissao', 'hire_date', 'admissao', 'admissão') || createdAt || null,
    scale_status: textValue(row, 'scale_status', 'status_escala') || 'Em escala',
    notes: textValue(row, 'notes', 'observacoes', 'observações'),
    coordinator: textValue(row, 'coordinator', 'coordenador') || undefined,
    leader: textValue(row, 'leader', 'lider', 'líder') || undefined,
    manager: textValue(row, 'manager', 'gerente') || undefined,
    vacation_2026: nullableTextValue(row, 'vacation_2026', 'ferias_2026', 'férias_2026'),
    vacation_2027: nullableTextValue(row, 'vacation_2027', 'ferias_2027', 'férias_2027'),
    absence_reason: textValue(row, 'absence_reason', 'motivo_ausencia') || undefined,
    is_absent: firstValue(row, 'is_absent', 'ausente') === true,
    inicio_periodo_aquisitivo: nullableTextValue(row, 'inicio_periodo_aquisitivo', 'period_start'),
    fim_periodo_concessivo: nullableTextValue(row, 'fim_periodo_concessivo', 'period_end'),
    created_at: createdAt,
    updated_at: textValue(row, 'updated_at', 'atualizado_em'),
  };
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('colaboradores').select('*');

  if (error) {
    console.error('Supabase colaboradores query failed:', {
      message: error.message,
      code: error.code,
    });
    throw new Error(`Falha ao buscar colaboradores no Supabase: ${error.message}`);
  }

  return ((data || []) as Record<string, unknown>[]).map(mapEmployee);
}

export async function getVacations(): Promise<VacationSchedule[]> {
  const { data, error } = await supabase
    .from('vacation_schedules')
    .select('*')
    .order('dt_limite_maxima');

  if (error) {
    console.error('Supabase vacation_schedules query failed:', {
      message: error.message,
      code: error.code,
    });
    throw new Error(`Falha ao buscar programações de férias no Supabase: ${error.message}`);
  }

  return (data || []) as VacationSchedule[];
}
