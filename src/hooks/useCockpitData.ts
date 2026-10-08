import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const COLLABORATORS_STORAGE_KEY = 'unilink_colaboradores';

export const SIC_TOS_LINEUP_URL =
  'https://sic-tos.complexodopecem.com.br/sictossite/pesquisa.aspx?WCI=relEmitirLineUpExt_002';

export interface CockpitCollaborator {
  id: string;
  nome: string;
  cargo: string;
  turno: string;
  status: string;
}

export interface CockpitShip {
  [key: string]: unknown;
  id: string;
  nome: string;
  berco: string;
}

interface CockpitData {
  colaboradores: CockpitCollaborator[];
  navios: CockpitShip[];
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

type Row = Record<string, unknown>;

const DEFAULT_COLLABORATORS: CockpitCollaborator[] = [
  { id: 'fallback-1', nome: 'João da Silva', cargo: 'Motorista', turno: 'DIA - A', status: 'Ativo' },
  { id: 'fallback-2', nome: 'Maria Oliveira', cargo: 'Conferente', turno: 'DIA - A', status: 'Ativo' },
  { id: 'fallback-3', nome: 'Ana Paula Costa', cargo: 'Técnico', turno: 'DIA - A', status: 'Ativo' },
  { id: 'fallback-4', nome: 'Roberto Lima', cargo: 'Inspetor', turno: 'DIA - A', status: 'Ativo' },
  { id: 'fallback-5', nome: 'Bruno Carvalho', cargo: 'Motorista', turno: 'DIA - C', status: 'Ativo' },
  { id: 'fallback-6', nome: 'Diego Fernandes', cargo: 'Técnico', turno: 'DIA - C', status: 'Ativo' },
  { id: 'fallback-7', nome: 'Eliane Pinto', cargo: 'Inspetor', turno: 'DIA - C', status: 'Ativo' },
  { id: 'fallback-8', nome: 'Adriano Silva', cargo: 'Motorista', turno: 'NOITE - B', status: 'Ativo' },
];

const DEFAULT_SHIPS: CockpitShip[] = [
  { id: 'fallback-ship-1', nome: 'ALIANÇA LEBLON', berco: 'Berço 01' },
  { id: 'fallback-ship-2', nome: 'LOG-IN JACARANDÁ', berco: 'Berço 02' },
  { id: 'fallback-ship-3', nome: 'MSC SOFIA PAZ', berco: 'Berço 03' },
];

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstText(row: Row, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return fallback;
}

function mapCollaborator(row: Row, index: number): CockpitCollaborator {
  return {
    id: firstText(row, ['id'], `colaborador-${index + 1}`),
    nome: firstText(row, ['nome', 'name', 'colaborador'], 'Colaborador'),
    cargo: firstText(row, ['cargo', 'role', 'funcao'], 'Operativo'),
    turno: firstText(row, ['turno', 'shift', 'escala'], 'Turno A'),
    status: firstText(row, ['status'], 'Ativo'),
  };
}

function readLocalCollaborators(): CockpitCollaborator[] {
  try {
    const storedValue = window.localStorage.getItem(COLLABORATORS_STORAGE_KEY);
    if (!storedValue) return [];

    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      console.error(`O conteúdo de ${COLLABORATORS_STORAGE_KEY} não é uma lista válida.`);
      return [];
    }

    return parsed.filter(isRow).map(mapCollaborator);
  } catch (error) {
    console.error('Não foi possível recuperar colaboradores do localStorage:', error);
    return [];
  }
}

function assignBerths(rows: Row[]): CockpitShip[] {
  return rows.map((row, index) => {
    const currentBerth = firstText(row, ['berco'], '');
    const berco = !currentBerth || currentBerth.toUpperCase() === 'PENDENTE'
      ? `Berço ${String((index % 8) + 1).padStart(2, '0')}`
      : currentBerth;

    return {
      ...row,
      id: firstText(row, ['id'], `navio-${index + 1}`),
      nome: firstText(row, ['nome', 'name', 'navio', 'nome_navio'], 'Navio sem identificação'),
      berco,
    };
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'erro inesperado';
}

export function useCockpitData(): CockpitData {
  const [colaboradores, setColaboradores] = useState<CockpitCollaborator[]>([]);
  const [navios, setNavios] = useState<CockpitShip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const errors: string[] = [];

    try {
      const { data, error: queryError } = await supabase.from('colaboradores').select('*');
      if (queryError) {
        console.error('Consulta de colaboradores no Supabase falhou:', queryError);
        errors.push(`colaboradores: ${queryError.message}`);
      }

      const remoteRows = !queryError && Array.isArray(data) ? data.filter(isRow) : [];
      const localRows = remoteRows.length === 0 ? readLocalCollaborators() : [];
      const mappedRemote = remoteRows.map(mapCollaborator);
      setColaboradores(mappedRemote.length > 0 ? mappedRemote : localRows.length > 0 ? localRows : DEFAULT_COLLABORATORS);
    } catch (reason) {
      console.error('Não foi possível carregar colaboradores do Supabase:', reason);
      errors.push(`colaboradores: ${errorText(reason)}`);
      const localRows = readLocalCollaborators();
      setColaboradores(localRows.length > 0 ? localRows : DEFAULT_COLLABORATORS);
    }

    try {
      const { data, error: queryError } = await supabase.from('previsao_navios').select('*');
      if (queryError) {
        console.error('Consulta de previsão de navios no Supabase falhou:', queryError);
        errors.push(`previsao_navios: ${queryError.message}`);
      }

      const rows = !queryError && Array.isArray(data) ? data.filter(isRow) : [];
      setNavios(rows.length > 0 ? assignBerths(rows) : DEFAULT_SHIPS);
    } catch (reason) {
      console.error('Não foi possível carregar a previsão de navios do Supabase:', reason);
      errors.push(`previsao_navios: ${errorText(reason)}`);
      setNavios(DEFAULT_SHIPS);
    }

    setError(errors.join('; '));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel('cockpit-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'previsao_navios' }, () => {
        void refresh();
      })
      .subscribe((status, subscriptionError) => {
        if (subscriptionError || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const message = subscriptionError?.message || `status ${status}`;
          console.error('Subscription Realtime do Cockpit falhou:', message);
          setError((current) => [current, `Realtime: ${message}`].filter(Boolean).join('; '));
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { colaboradores, navios, isLoading, error, refresh };
}
