import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (!document.cookie.includes('access_token=')) {
        const isHttps = window.location.protocol === 'https:';
        document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      }
    }
  }
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`AxiosError: ${error.response.status} on ${error.config.method?.toUpperCase()} ${error.config.url}`);
    } else {
      console.error(`AxiosError: ${error.message} on ${error.config?.url}`);
    }
    return Promise.reject(error);
  }
);
