export interface ShiftScale {
  id: string;
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  work_days: number;
  off_days: number;
  shift_group: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  registration: string;
  role: string;
  sector: string;
  shift_group: string;
  shift_type?: string;
  schedule_start: string;
  schedule_end: string;
  status: string;
  hire_date: string | null;
  scale_status: string;
  notes: string;
  coordinator?: string;
  leader?: string;
  manager?: string;
  vacation_2026?: string | null;
  vacation_2027?: string | null;
  inicio_periodo_aquisitivo?: string | null;
  fim_periodo_concessivo?: string | null;
  absence_reason?: string;
  is_absent?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeEsocialData {
  employee_id: string;
  cpf: string;
  created_at: string;
  updated_at: string;
}
