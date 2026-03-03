// ECK UI API Client
// Centralized API client with error handling and authentication

interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

// Custom error class for API errors
export class ApiRequestError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private onUnauthorized?: () => void;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || '/api/v1';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  // Set callback for unauthorized responses
  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  // Get current organization namespace from context
  private getOrgPath(orgId?: string): string {
    if (orgId) {
      return `/orgs/${orgId}`;
    }
    // Will be replaced by actual org context
    return '';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers as Record<string, string>),
    };

    // Add request ID for tracing
    const requestId = crypto.randomUUID();
    headers['X-Request-ID'] = requestId;

    const config: RequestInit = {
      method,
      headers,
      credentials: 'include',
      ...options,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    // Handle non-OK responses
    if (!response.ok) {
      let errorData: ApiError;
      
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          code: 'UNKNOWN_ERROR',
          message: response.statusText || 'Unknown error occurred',
        };
      }

      // Handle unauthorized - trigger auth refresh
      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }

      throw new ApiRequestError(
        errorData.message,
        errorData.code,
        response.status,
        errorData.details
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // HTTP Methods
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // Organization-scoped resource methods
  resources(orgId: string, namespace: string) {
    const basePath = this.getOrgPath(orgId);
    const nsPath = `${basePath}/namespaces/${namespace}`;

    return {
      // Elasticsearch
      elasticsearch: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/elasticsearch${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/elasticsearch/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/elasticsearch`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/elasticsearch/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/elasticsearch/${name}`),
        events: (name: string) => 
          this.get<unknown[]>(`${nsPath}/elasticsearch/${name}/events`),
      },

      // Kibana
      kibana: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/kibana${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/kibana/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/kibana`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/kibana/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/kibana/${name}`),
      },

      // APM Server
      apm: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/apmserver${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/apmserver/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/apmserver`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/apmserver/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/apmserver/${name}`),
      },

      // Agent
      agent: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/agent${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/agent/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/agent`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/agent/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/agent/${name}`),
      },

      // Beat
      beat: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/beat${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/beat/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/beat`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/beat/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/beat/${name}`),
      },

      // Logstash
      logstash: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/logstash${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/logstash/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/logstash`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/logstash/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/logstash/${name}`),
      },

      // Enterprise Search
      enterpriseSearch: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/enterprisesearch${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/enterprisesearch/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/enterprisesearch`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/enterprisesearch/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/enterprisesearch/${name}`),
      },

      // Elastic Maps Server
      maps: {
        list: (params?: ListParams) => 
          this.get<ApiResponse<unknown[]>>(`${nsPath}/elasticmapsserver${buildQueryString(params)}`),
        get: (name: string) => 
          this.get<unknown>(`${nsPath}/elasticmapsserver/${name}`),
        create: (data: unknown) => 
          this.post<unknown>(`${nsPath}/elasticmapsserver`, data),
        update: (name: string, data: unknown) => 
          this.put<unknown>(`${nsPath}/elasticmapsserver/${name}`, data),
        delete: (name: string) => 
          this.delete<void>(`${nsPath}/elasticmapsserver/${name}`),
      },
    };
  }
}

// List parameters interface
interface ListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  health?: string;
  phase?: string;
}

// Build query string from params
function buildQueryString(params?: ListParams): string {
  if (!params) return '';
  
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// Singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiClientOptions, ApiError, ApiResponse, ListParams };
