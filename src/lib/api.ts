let memoryCsrfToken: string | null = null;

export function setMemoryCsrfToken(token: string | null) {
  memoryCsrfToken = token;
}

export function getMemoryCsrfToken(): string | null {
  return memoryCsrfToken;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (memoryCsrfToken && method !== 'GET') {
    headers['X-CSRF-Token'] = memoryCsrfToken;
  }

  let bodyInit: BodyInit | undefined;
  if (options.body instanceof FormData) {
    bodyInit = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: bodyInit,
    signal: options.signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const errObj = payload?.error;
    throw new ApiClientError(
      response.status,
      errObj?.code || 'REQUEST_FAILED',
      errObj?.message || `Request failed with status ${response.status}`,
      errObj?.details
    );
  }

  return payload.data as T;
}

export function uploadWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.withCredentials = true;

    if (memoryCsrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', memoryCsrfToken);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success) {
          resolve(parsed.data as T);
        } else {
          reject(
            new ApiClientError(
              xhr.status,
              parsed.error?.code || 'UPLOAD_FAILED',
              parsed.error?.message || 'File upload failed.',
              parsed.error?.details
            )
          );
        }
      } catch {
        reject(new ApiClientError(xhr.status, 'UPLOAD_FAILED', 'Unexpected response during upload.'));
      }
    };

    xhr.onerror = () => {
      reject(new ApiClientError(0, 'NETWORK_ERROR', 'Network error interrupted the file upload.'));
    };

    xhr.send(formData);
  });
}
