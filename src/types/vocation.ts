export interface VacationSchedule {
  id: string;
  employee_id: string;
  periodo_aquisitivo_inicio: string; // ISO YYYY-MM-DD
  periodo_aquisitivo_fim: string;    // ISO YYYY-MM-DD
  dt_limite_maxima: string;          // ISO YYYY-MM-DD (21 meses após fim do PA)
  dias_gozo: number;
  data_inicio_programada?: string | null;
  data_fim_programada?: string | null;
  ajuste_manual_flag: boolean;
  observacao_dp?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VacationCoverageBase {
  id: string;
  funcao: string;
  plantao: string;
  minimo_operacional: number;
  created_at?: string;
}

export interface CapacityCheckResult {
  data: string;
  funcao: string;
  plantao: string;
  totalAtivos: number;
  minimoRequerido: number;
  agendadosNoDia: number;
  disponiveisNoDia: number;
  valido: boolean;
}