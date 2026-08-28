import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1', // Hardcoded to avoid requiring a server restart to pick up .env.local changes
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
