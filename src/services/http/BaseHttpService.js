import axios from 'axios';
import { API_ENDPOINTS } from '../../config/apiEndpoints.js';

export class BaseHttpService {
  constructor(serviceName, baseUrl) {
    this.serviceName = serviceName;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = process.env.API_AUTH_TOKEN;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error(`[${this.serviceName} Service Error]:`, error.message);
        return Promise.reject({
          status: error.response?.status || 500,
          message: error.response?.data?.message || error.message,
          data: error.response?.data,
        });
      }
    );
  }

  async get(endpoint, params = {}) {
    return this.client.get(endpoint, { params });
  }

  async post(endpoint, data = {}) {
    return this.client.post(endpoint, data);
  }

  async patch(endpoint, data = {}) {
    return this.client.patch(endpoint, data);
  }

  async delete(endpoint) {
    return this.client.delete(endpoint);
  }
}
