import axios from 'axios';

const client = axios.create({
  baseURL: '', // Configured to route via Vite proxy in development, or relative paths in production
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to format responses or intercept errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error Response:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error);
  }
);

export default client;
