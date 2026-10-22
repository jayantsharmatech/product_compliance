import axios from 'axios';

// Automatically uses local host during development ('npm run dev')
// and relative path ('') in production so Vercel proxies requests directly to FastAPI
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

// Default mock mode to FALSE so live API calls reach your backend
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const citizenScan = async (imageFile, latitude = null, longitude = null, locationName = null) => {
  if (USE_MOCK) return null;

  const formData = new FormData();
  formData.append('file', imageFile);
  if (latitude !== null && longitude !== null) {
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
  }
  if (locationName) formData.append('location_name', locationName);

  const response = await api.post('/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const scanMultipleImages = async (imageFiles, latitude = null, longitude = null, locationName = null) => {
  if (USE_MOCK) return null;

  const formData = new FormData();
  imageFiles.forEach((file) => formData.append('files', file));
  if (latitude !== null && longitude !== null) {
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
  }
  if (locationName) formData.append('location_name', locationName);

  const response = await api.post('/scan-multi', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const citizenHistory = async () => {
  if (USE_MOCK) return [];
  const response = await api.get('/history');
  return response.data.records || response.data.scans || response.data || [];
};

export const submitComplaint = async (complaintData) => {
  if (USE_MOCK) return { success: true };
  const response = await api.post('/complaints', complaintData);
  return response.data;
};

export const officerAudit = async (imageFileOrFiles, latitude = null, longitude = null, locationName = null) => {
  if (USE_MOCK) return null;

  const formData = new FormData();
  if (latitude !== null && longitude !== null) {
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
  }
  if (locationName) formData.append('location_name', locationName);

  if (Array.isArray(imageFileOrFiles)) {
    imageFileOrFiles.forEach((file) => formData.append('files', file));
    const response = await api.post('/scan-multi', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } else {
    formData.append('file', imageFileOrFiles);
    const response = await api.post('/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
};

export const officerHistory = async (filters = {}) => {
  if (USE_MOCK) return [];
  const response = await api.get('/history', { params: filters });
  return response.data.records || response.data.scans || response.data || [];
};

export const generateChallan = async (auditId) => {
  if (USE_MOCK) return new Blob(['Mock PDF'], { type: 'application/pdf' });
  
  // Clean the ID and ensure it always uses the exact /report/ route prefix
  const cleanId = String(auditId || '').replace(/^\/?report\//, '');
  const response = await api.get(`/report/${cleanId}`, { 
    responseType: 'blob',
    headers: { Accept: 'application/pdf' }
  });
  return response.data;
};

export const syncQueue = async () => {
  if (USE_MOCK) return { status: 'success', synced_count: 0 };
  const response = await api.post('/sync');
  return response.data;
};

export default api;