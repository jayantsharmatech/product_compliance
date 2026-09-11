import axios from 'axios';

const API_BASE_URL = 'https://3.109.159.235.nip.io';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const mockCitizenScan = {
  id: 'scan_001',
  product_name: 'Sample Product',
  compliance_score: 72,
  extracted_fields: {
    mrp: { value: '₹45.00', status: 'valid' },
    net_quantity: { value: '200g', status: 'valid' },
    mfg_date: { value: '04/2025', status: 'valid' },
    expiry_date: { value: '10/2025', status: 'warning' },
    consumer_care: { value: null, status: 'missing' },
    manufacturer_name: { value: 'Sample Foods Ltd.', status: 'valid' },
  },
  violations: [
    { severity: 'CRITICAL', field: 'consumer_care', message: 'Consumer care details absent' },
  ],
};

const mockOfficerAudit = {
  id: 'audit_001',
  product: 'Sample Packaged Food',
  compliance_score: 55,
  inspection_date: new Date().toISOString().split('T')[0],
  extracted_fields: {
    mrp: { value: '₹120.00', status: 'valid' },
    net_quantity: { value: '500g', status: 'valid' },
    mfg_date: { value: '01/08/2025', status: 'valid' },
    expiry_date: { value: '31/07/2026', status: 'valid' },
    consumer_care: { value: null, status: 'missing' },
    manufacturer_name: { value: 'Foods Pvt Ltd', status: 'valid' },
  },
  violations: [
    { rule_code: 'Rule 6(2)', severity: 'CRITICAL', message: 'Consumer care details not provided' },
  ],
};

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
  if (USE_MOCK) return mockCitizenScan;

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
  if (USE_MOCK) return mockCitizenScan;

  const formData = new FormData();
  imageFiles.forEach((file) => formData.append('files', file));
  if (latitude !== null && longitude !== null) {
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
  }
  if (locationName) formData.append('location_name', locationName);

  const response = await api.post('/scan-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const citizenHistory = async () => {
  if (USE_MOCK) return [];
  const response = await api.get('/history');
  return response.data.scans || response.data || [];
};

export const submitComplaint = async (complaintData) => {
  if (USE_MOCK) return { success: true };
  const response = await api.post('/complaints', complaintData);
  return response.data;
};

export const officerAudit = async (imageFileOrFiles, latitude = null, longitude = null, locationName = null) => {
  if (USE_MOCK) return mockOfficerAudit;

  const formData = new FormData();
  if (latitude !== null && longitude !== null) {
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
  }
  if (locationName) formData.append('location_name', locationName);

  if (Array.isArray(imageFileOrFiles)) {
    imageFileOrFiles.forEach((file) => formData.append('files', file));
    const response = await api.post('/scan-multiple', formData, {
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
  return response.data.scans || response.data || [];
};

export const generateChallan = async (auditId) => {
  if (USE_MOCK) return new Blob(['Mock PDF'], { type: 'application/pdf' });
  const response = await api.get(`/report/${auditId}`, { responseType: 'blob' });
  return response.data;
};

export default api;