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
  keyPreview?: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
