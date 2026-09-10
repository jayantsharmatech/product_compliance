import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ChevronLeft,
  Camera,
  Upload,
  Scale,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  MapPin,
  Search,
  Save,
  X,
  Languages,
  TrendingUp,
  Users,
  LogOut,
} from 'lucide-react';
import { officerAudit, officerHistory, generateChallan } from '../utils/api';
import { officerLogout, getOfficer } from '../utils/auth';

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('audit');
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  // Officer session + online/offline detection
  const officer = getOfficer();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch history when filters change
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await officerHistory({
          search: searchTerm,
          compliance: complianceFilter,
        });
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch history', err);
      }
    };
    fetchHistory();
  }, [searchTerm, complianceFilter]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setImage(e.target.result);
      setIsAnalyzing(true);
      setError(null);

      try {
        const blob = await (await fetch(e.target.result)).blob();
        const result = await officerAudit(blob);
        setAuditResult(result);
      } catch (err) {
        setError('Backend not connected. Using mock data for demo.');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadChallan = async () => {
    try {
      const pdfBlob = await generateChallan(auditResult.id || 'audit_001');
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challan_${auditResult.id || 'audit_001'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate challan. Check backend.');
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = complianceFilter === 'all' || item.compliance === complianceFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <ChevronLeft className="w-6 h-6 text-slate-600" />
              </button>
              <div className="bg-blue-600 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Officer Workbench</h1>
                <p className="text-xs text-slate-500">Legal Metrology Enforcement</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Dynamic Online/Offline Indicator */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                ></span>
                {isOnline ? 'Online - Live Sync' : 'Offline - Local Queue Active'}
              </div>

              {/* Officer Info
              <div className="hidden md:flex flex-col items-end pl-3 border-l border-slate-200">
                <span className="text-xs font-semibold text-slate-900">
                  {officer?.name || 'Officer'}
                </span>
                <span className="text-[10px] text-slate-500">
                  ID: {officer?.officerId || '—'}
                </span>
              </div> */}

              {/* Logout */}
              <button
                onClick={officerLogout}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                activeTab === 'audit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔍 Active Audit
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 History & Analytics
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {activeTab === 'audit' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column – Image & Calibration */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Image Preview & Calibration</h2>

                {!image ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-500 transition">
                  <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-2">Capture or upload package image</p>
                  <p className="text-sm text-slate-400 mb-6">Ensure label is well-lit and text is readable</p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Capture
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white border-2 border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition flex items-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Upload
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={image} alt="Audit image" className="w-full h-64 object-cover" />
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date Engine */}
              {auditResult && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Dynamic Date Engine</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Inspection Date (Today)</p>
                      <p className="font-semibold text-slate-900">{auditResult.inspection_date || new Date().toISOString().split('T')[0]}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Manufacturing Date</p>
                      <p className="font-semibold text-slate-900">{auditResult.fields?.mfg_date?.value || 'Not found'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Expiry / Best Before</p>
                      <p className="font-semibold text-slate-900">{auditResult.fields?.expiry_date?.value || 'Not found'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="font-semibold text-slate-900">
                        {auditResult.fields?.expiry_date?.value ? 'Valid' : 'Needs Check'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Language Diff */}
              {auditResult && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Languages className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Indic Script Comparison</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">English (Mandatory)</p>
                      <p className="text-sm font-medium">Net Qty: 500g | MRP: ₹120</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Hindi (Mandatory)</p>
                      <p className="text-sm font-medium">मात्रा: 500ग्राम | मूल्य: ₹120</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Regional Language (Tamil – Required by Rule 9(4))</p>
                      <p className="text-sm font-medium">அளவு: 500கிராம் | விலை: ₹120</p>
                      <p className="text-xs text-red-600 mt-2">⚠ Mismatch detected – Regional declaration does not match English/Hindi</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {auditResult && (
                <div className="flex gap-3">
                  <button
                    onClick={() => alert('Saved to local queue!')}
                    className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save to Local Queue
                  </button>
                  <button
                    onClick={() => setShowChallanModal(true)}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <FileCheck className="w-5 h-5" />
                    Generate PDF Challan
                  </button>
                </div>
              )}
            </div>

            {/* Right Column – Results Summary */}
            <div className="space-y-6">
              {auditResult && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Inspection Summary</h2>
                  <div className={`mb-4 p-4 rounded-xl ${
                    auditResult.compliance_score >= 80 ? 'bg-green-50' :
                    auditResult.compliance_score >= 50 ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}>
                    <div className="text-center">
                      <span className="text-4xl font-bold text-slate-900">{auditResult.compliance_score}%</span>
                      <p className="text-sm text-slate-500">Compliance Score</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {auditResult.violations && auditResult.violations.map((violation, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-5 h-5 ${
                            violation.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                          }`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{violation.message}</p>
                            <span className="text-xs text-slate-500">{violation.rule}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!auditResult.violations || auditResult.violations.length === 0) && (
                      <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-green-700">No violations found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={TrendingUp} label="Total Audits" value="1,245" color="blue" />
              <StatCard icon={AlertTriangle} label="Repeat Violators Flagged" value="37" color="red" />
              <StatCard icon={Users} label="Active Citizen Complaints" value="158" color="yellow" />
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by product, brand, location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={complianceFilter}
                  onChange={(e) => setComplianceFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="PASS">PASS</option>
                  <option value="WARNING">WARNING</option>
                  <option value="VIOLATION">VIOLATION</option>
                </select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Product</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Brand</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Compliance</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Location</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{item.product}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{item.brand}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.compliance === 'PASS' ? 'bg-green-100 text-green-700' :
                            item.compliance === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.compliance}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {item.location}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{item.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Violation Heat Map Placeholder */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Violation Hotspots (Heat Map)</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {['Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Hyderabad', 'Bangalore', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kochi', 'Nagpur'].map((city, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl text-center ${
                      idx === 0 ? 'bg-red-100 text-red-700' :
                      idx === 2 || idx === 4 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}
                  >
                    <p className="font-semibold text-sm">{city}</p>
                    <p className="text-xs">{idx === 0 ? 'High' : idx === 2 || idx === 4 ? 'Medium' : 'Low'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Challan Modal */}
      {showChallanModal && auditResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Inspection Challan Summary</h3>
              <button onClick={() => setShowChallanModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">Product</p>
                <p className="font-semibold text-slate-900">{auditResult.product}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Inspection Date</p>
                  <p className="font-semibold text-slate-900">{auditResult.inspection_date}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Score</p>
                  <p className="font-semibold text-slate-900">{auditResult.compliance_score}%</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-2">Violations</h4>
                <ul className="space-y-2">
                  {auditResult.violations && auditResult.violations.map((violation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                        violation.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                      <div>
                        <p className="text-slate-700">{violation.message}</p>
                        <span className="text-xs text-slate-500">{violation.rule}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={handleDownloadChallan}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <FileCheck className="w-5 h-5" />
                Download Challan PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-3 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}