import axios from 'axios';
import { auth } from '../config/firebase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.warn('Failed to get Firebase token:', error);
      // Continue without authentication token
    }
  } else {
    // For development, if no Firebase user but we want to be authenticated,
    // we can add a dev token. But for now, let's be explicit about guest mode.
    console.log('No Firebase user - making request as guest');
  }
  return config;
});

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('Authentication error:', error.response?.status);
      // Check if it's a permission denied error
      if (error.response?.data?.detail?.includes('logged in')) {
        // This is a login required error - we'll handle it in the components
        error.isLoginRequired = true;
      }
    }
    return Promise.reject(error);
  }
);

// Notes API
export const notesAPI = {
  getAll: () => api.get('/notes/'),
  getById: (id) => api.get(`/notes/${id}/`),
  create: (data, options = {}) => {
    // If data is already a FormData object, use it directly
    if (data instanceof FormData) {
      return api.post('/notes/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...options
      });
    }
    
    // Otherwise, create FormData from object
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return api.post('/notes/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...options
    });
  },
  update: (id, data) => api.patch(`/notes/${id}/`, data),
  delete: (id) => api.delete(`/notes/${id}/`),
  translate: (id, data = {}) => api.post(`/notes/${id}/translate/`, data),
  updateLastViewedPage: (id, page) => api.patch(`/notes/${id}/update_last_viewed_page/`, { page }),
  reExtractText: (id) => api.post(`/notes/${id}/re_extract_text/`),
  getRecent: () => api.get('/notes/recent/'),
  getProgress: (id) => api.get(`/notes/${id}/progress/`),
  cancelProcessing: (id) => api.post(`/notes/${id}/cancel_processing/`),
};

// Vocabulary API
export const vocabularyAPI = {
  getAll: (params) => api.get('/vocabulary/', { params }),
  getById: (id) => api.get(`/vocabulary/${id}/`),
  create: (data) => api.post('/vocabulary/', data),
  update: (id, data) => api.patch(`/vocabulary/${id}/`, data),
  delete: (id) => api.delete(`/vocabulary/${id}/`),
  saveWord: (data) => api.post('/vocabulary/save_word/', data),
  getStats: () => api.get('/vocabulary/stats/'),
};

// Translation API
export const translationAPI = {
  translateText: (data) => api.post('/translation/translate/', data),
  getSupportedLanguages: () => api.get('/translation/languages/'),
};
