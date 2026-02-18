import type { User, Generator, ApiKey, ApiError } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private userId: number | null = null;

  setUserId(userId: number | null) {
    this.userId = userId;
    if (userId) {
      localStorage.setItem('userId', userId.toString());
    } else {
      localStorage.removeItem('userId');
    }
  }

  getUserId(): number | null {
    if (this.userId) return this.userId;
    const stored = localStorage.getItem('userId');
    if (stored) {
      this.userId = parseInt(stored, 10);
      return this.userId;
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.userId) {
      headers['x-user-id'] = this.userId.toString();
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async enrollUser(email: string, name?: string): Promise<User> {
    const user = await this.request<User>('/api/auth/enroll', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
    this.setUserId(user.id);
    return user;
  }

  async loginUser(email: string): Promise<User> {
    const user = await this.request<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    this.setUserId(user.id);
    return user;
  }

  logout() {
    this.setUserId(null);
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/api/profile');
  }

  async updateProfile(data: { name?: string; email?: string }): Promise<User> {
    return this.request<User>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createGenerator(data: {
    name: string;
    oilChangeMonths?: number;
    oilChangeHours?: number;
  }): Promise<Generator> {
    return this.request<Generator>('/api/generators', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGenerators(): Promise<Generator[]> {
    return this.request<Generator[]>('/api/generators');
  }

  async getGenerator(id: number): Promise<Generator> {
    return this.request<Generator>(`/api/generators/${id}`);
  }

  async updateGenerator(
    id: number,
    data: {
      name?: string;
      oilChangeMonths?: number;
      oilChangeHours?: number;
    }
  ): Promise<Generator> {
    return this.request<Generator>(`/api/generators/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createApiKey(name: string): Promise<ApiKey> {
    return this.request<ApiKey>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('/api/api-keys');
  }

  async deleteApiKey(id: number): Promise<void> {
    return this.request<void>(`/api/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  async resetApiKey(id: number): Promise<ApiKey> {
    return this.request<ApiKey>(`/api/api-keys/${id}/reset`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export const api = new ApiClient();
