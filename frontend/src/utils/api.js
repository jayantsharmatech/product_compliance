import axios from 'axios';

// Directly target your secure HTTPS EC2 backend domain
const API_BASE_URL = 'https://3.109.159.235.nip.io';

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
  formData.append('file', imageFile);
  const response = await api.post('/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Get citizen's scan history
 * @returns {Promise<Array>} list of past scans
 */
export const citizenHistory = async () => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return mockHistory;
  }

  const response = await api.get('/history');
  return response.data;
};

/**
 * Submit a complaint
 * @param {Object} complaintData - { scan_id, description, location }
 * @returns {Promise<Object>} confirmation
 */
export const submitComplaint = async (complaintData) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { success: true, message: 'Complaint submitted successfully' };
  }

  const response = await api.post('/complaints', complaintData);
  return response.data;
};

// ------------------------------------------------------------------
// Official (Inspector) Endpoints
// ------------------------------------------------------------------

/**
 * Run an official audit on an image
 * @param {File|Blob} imageFile
 * @returns {Promise<Object>} audit result
 */
export const officerAudit = async (imageFile) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return mockOfficerAudit;
  }

  const formData = new FormData();
  formData.append('file', imageFile);
  const response = await api.post('/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Get official audit history (filterable)
 * @param {Object} filters - { brand, compliance, location }
 * @returns {Promise<Array>} list of audits
 */
export const officerHistory = async (filters = {}) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      { id: 1, product: 'Biscuit Pack', brand: 'Britannia', compliance: 'VIOLATION', location: 'Mumbai', date: '2026-09-01' },
      { id: 2, product: 'Juice Bottle', brand: 'Real', compliance: 'PASS', location: 'Delhi', date: '2026-08-31' },
      { id: 3, product: 'Chips Packet', brand: "Lay's", compliance: 'WARNING', location: 'Chennai', date: '2026-08-30' },
      { id: 4, product: 'Chocolate Bar', brand: 'Cadbury', compliance: 'PASS', location: 'Kolkata', date: '2026-08-29' },
    ];
  }

  const response = await api.get('/history', { params: filters });
  return response.data;
};

/**
 * Generate challan PDF for a specific audit
 * @param {string} auditId
 * @returns {Promise<Blob>} PDF blob
 */
export const generateChallan = async (auditId) => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return new Blob(['Mock PDF content'], { type: 'application/pdf' });
  }

  const response = await api.get(`/report/${auditId}`, { responseType: 'blob' });
  return response.data;
};

export default api;