/**
 * Base URL for all API requests.
 * - Dev: empty string (Vite proxy handles /api → localhost:3001)
 * - Production: full backend URL (e.g. https://ai-dm-api.duckdns.org)
 */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';
