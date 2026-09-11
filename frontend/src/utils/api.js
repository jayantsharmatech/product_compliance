import axios from 'axios';

// Use relative URL '' in production to route through Vercel rewrites (bypasses Mixed Content)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Mock toggle - set to false when backend is ready
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// ------------------------------------------------------------------
// Mock Data (Only used when USE_MOCK is true or backend is unavailable)
// ------------------------------------------------------------------
const mockCitizenScan = {
  id: 'scan_001',
  product_name: 'Sample Product',
  compliance_score: 72,
  extracted_fields: {
    mrp: { value: '₹45.00', status: 'valid' },
    net_quantity: { value: '200g', status: 'valid' },
    mfg_date: { value: '04/2025', status: 'valid' },
    expiry_date: { value: '10/2025', status: 'warning', days_left: 25 },
    consumer_care: { value: null, status: 'missing' },
    manufacturer: { value: 'Sample Foods Ltd.', status: 'valid' },
  },
  violations: [
    { severity: 'CRITICAL', field: 'consumer_care', message: 'Consumer care details absent' },
    { severity: 'WARNING', field: 'mfg_date', message: 'Date format not in DD/MM/YYYY' },
  ],
};

const mockHistory = [
  { id: 'scan_1', product: 'Sample Biscuit', score: 72, date: '2025-11-15', status: 'warning' },
  { id: 'scan_2', product: 'Juice Bottle', score: 95, date: '2025-11-14', status: 'compliant' },
  { id: 'scan_3', product: 'Chips Packet', score: 35, date: '2025-11-13', status: 'non-compliant' },
];

const mockOfficerAudit = {
  id: 'audit_001',
  product: 'Sample Packaged Food',
  compliance_score: 55,
  inspection_date: new Date().toISOString().split('T')[0],
  fields: {
    mrp: { value: '₹120.00', status: 'valid' },
    net_quantity: { value: '500g', status: 'valid' },
    mfg_date: { value: '01/08/2025', status: 'valid' },
    expiry_date: { value: '31/07/2026', status: 'valid' },
    consumer_care: { value: null, status: 'missing' },
    manufacturer: { value: 'Foods Pvt Ltd', status: 'valid' },
  },
  violations: [
    { rule: 'Rule 6(2)', severity: 'critical', message: 'Consumer care details not provided' },
    { rule: 'Rule 9(4)', severity: 'warning', message: 'Regional language declaration mismatch' },
  ],
};

// ------------------------------------------------------------------
// Axios Instance
// ------------------------------------------------------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token if present (for future auth)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ------------------------------------------------------------------
// Public (Citizen) Endpoints
// ------------------------------------------------------------------

/**
 * Upload a product image and get compliance result
 * @param {File|Blob} imageFile
 * @returns {Promise<Object>} compliance result
 */
export const citizenScan = async (imageFile) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return mockCitizenScan;
  }

  const formData = new FormData();
  // Must match FastAPI backend parameter name: file: UploadFile = File(...)
  formData.append('file', imageFile);
  
  const response = await api.post('/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const citizenHistory = async () => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return mockHistory;
  }
  const response = await api.get('/api/public/history');
  return response.data;
};

export const submitComplaint = async (complaintData) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { success: true, message: 'Complaint submitted successfully' };
  }
  const response = await api.post('/api/public/complaints', complaintData);
  return response.data;
};

export const officerAudit = async (imageFile) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return mockOfficerAudit;
  }
  const formData = new FormData();
  formData.append('file', imageFile);
  const response = await api.post('/api/official/audit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const officerHistory = async (filters = {}) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      { id: 1, product: 'Biscuit Pack', brand: 'Britannia', compliance: 'VIOLATION', location: 'Mumbai', date: '2026-09-01' },
      { id: 2, product: 'Juice Bottle', brand: 'Real', compliance: 'PASS', location: 'Delhi', date: '2026-08-31' },
    ];
  }
  const response = await api.get('/api/official/history', { params: filters });
  return response.data;
};

export const generateChallan = async (auditId) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return new Blob(['Mock PDF content'], { type: 'application/pdf' });
  }
  const response = await api.post(`/api/official/challan/${auditId}`, {}, { responseType: 'blob' });
  return response.data;
};

export default api;