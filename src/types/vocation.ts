export interface VacationSchedule {
  id: string;
  employee_id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  dt_limite_maxima: string;
  dias_gozo: number;
  data_inicio_programada: string | null;
  data_fim_programada: string | null;
  ajuste_manual_flag: boolean;
  observacao_dp: string;
}

export interface VacationCoverageBase {
  id: string;
  funcao: string;
  plantao: string;
  minimo_operacional: number;
}

export interface CapacityCheckResult {
  minimoRequerido: number;
  agendadosNoDia: number;
  disponiveisNoDia: number;
  valido: boolean;
}
