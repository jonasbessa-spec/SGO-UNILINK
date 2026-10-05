import type { Employee } from '@/types';

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  severity?: 'CRITICAL' | 'WARNING';
  alert?: string;
}

export function validateEmployeeAvailability(employee: Employee, date: string): AvailabilityResult {
  const status = employee.status.trim().toUpperCase();
  const notes = `${employee.absence_reason || ''} ${employee.notes || ''}`.trim().toUpperCase();

  if (employee.is_absent || status === 'AFASTADO') {
    return {
      available: false,
      reason: `Afastado (${employee.absence_reason || employee.notes || 'INSS/Licença'})`,
      severity: 'CRITICAL',
    };
  }

  const vacationDates = [employee.vacation_2026, employee.vacation_2027].filter((value): value is string => Boolean(value));
  if (vacationDates.includes(date)) {
    return {
      available: false,
      reason: 'Período programado de férias',
      severity: 'WARNING',
    };
  }

  if (notes.includes('DESLIGAR')) {
    return {
      available: false,
      reason: 'Pendente de desligamento',
      severity: 'CRITICAL',
    };
  }

  return {
    available: true,
    alert: notes.includes('ATENÇÃO') ? 'Requer supervisão presencial' : undefined,
  };
}
