export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Generator {
  id: number;
  name: string;
  oilChangeMonths: number;
  oilChangeHours: number;
  totalHours: number;
  lastOilChangeDate: string | null;
  lastOilChangeHours: number;
  isRunning: boolean;
  currentStartTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: number;
  name: string | null;
  key?: string;
  hint?: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface UsageLog {
  id: number;
  generatorId: number;
  startTime: string;
  endTime: string | null;
  durationHours: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OilChangeEntry {
  id: number;
  generatorId: number;
  performedAt: string;
  hoursAtChange: number;
  notes: string | null;
  createdAt: string;
}

export type ToggleResult =
  | { status: 'started'; isRunning: true; startTime: string; totalHours: number }
  | { status: 'stopped'; isRunning: false; durationHours: number; totalHours: number };

export interface ApiError {
  error: string;
  details?: unknown;
}
