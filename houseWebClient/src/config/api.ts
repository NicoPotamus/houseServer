// API configuration for the Next.js web client
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
export const SIGNALER_WS_URL = process.env.NEXT_PUBLIC_SIGNALER_WS_URL || 'ws://localhost:8080';

export function getSignalerUrl(): string {
  return SIGNALER_WS_URL;
}

export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}
