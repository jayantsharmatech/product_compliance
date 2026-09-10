// Auth helpers for Officer Login
const AUTH_KEY = 'officer_auth';

export const officerLogin = (officerId, password) => {
  // Demo credentials - replace with real API call later
  const DEMO_ID = 'inspector';
  const DEMO_PASS = 'inspector123';

  if (officerId === DEMO_ID && password === DEMO_PASS) {
    const authData = {
      officerId,
      name: 'Inspector Ramesh',
      role: 'LEGAL_INSPECTOR',
      loginTime: new Date().toISOString(),
      token: btoa(`${officerId}:${Date.now()}`),
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
    return { success: true, data: authData };
  }

  return { success: false, error: 'Invalid Officer ID or Password' };
};

export const getOfficer = () => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const isOfficerLoggedIn = () => {
  return !!getOfficer();
};

export const officerLogout = () => {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = '/officer-login';
};