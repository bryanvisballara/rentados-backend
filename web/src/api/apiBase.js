const configured = import.meta.env.VITE_API_BASE || '/api/v1';

export const API_BASE = String(configured).replace(/\/$/, '');
