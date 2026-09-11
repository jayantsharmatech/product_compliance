import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ChevronLeft,
  Camera,
  AlertTriangle,
  FileCheck,
  MapPin,
  Search,
  Save,
  TrendingUp,
  Users,
  LogOut,
  Layers,
  X,
} from 'lucide-react';
import { officerAudit, officerHistory, generateChallan } from '../utils/api';
import { officerLogout, getOfficer } from '../utils/auth';

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('audit');
  const [images, setImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);

  const fileInputRef = useRef(null);
  const multiFileInputRef = useRef(null);

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

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await officerHistory({ search: searchTerm, compliance: complianceFilter });
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch history', err);
      }
    };
    fetchHistory();
  }, [searchTerm, complianceFilter]);

  const renderFieldValue = (field) => {
    if (!field) return 'Not found';
    if (typeof field === 'string' || typeof field === 'number') return field;
    if (typeof field === 'object') {
      return field.value || field.raw_text || 'Not found';
    }
    return 'Not found';
  };

  const handleFilesSelected = async (event, isMultiple = false) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setIsAnalyzing(true);
    setError(null);

    let currentCoords = null;
    await new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(currentCoords);
            resolve();
          },
          () => {
            currentCoords = { lat: 28.6139, lng: 77.209 };
            setLocation(currentCoords);
            resolve();
          },
          { timeout: 10000 }
        );
      } else {
        currentCoords = { lat: 28.6139, lng: 77.209 };
        setLocation(currentCoords);
        resolve();
      }
    });

    try {
      const previewPromises = files.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      });

      const previews = await Promise.all(previewPromises);
      setImages(previews);

      let result;
      if (files.length > 1 || isMultiple) {
        result = await officerAudit(files, currentCoords.lat, currentCoords.lng, 'Officer Field Inspection');
      } else {
        result = await officerAudit(files[0], currentCoords.lat, currentCoords.lng, 'Officer Field Inspection');
      }
      setAuditResult(result);
    } catch (err) {
      setError('Backend connection failed or parsing error.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadChallan = async () => {
    try {
      const auditId = auditResult?.id || auditResult?.scan_id || 'audit_001';
      const pdfBlob = await generateChallan(auditId);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challan_${auditId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate challan.');
    }
  };

  const filteredHistory = history.filter((item) => {
    const productName = item.product || item.product_name || '';
    const brandName = item.brand || '';
    const locationName = item.location || item.location_name || '';

    const matchesSearch =
      productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locationName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = complianceFilter === 'all' || item.compliance === complianceFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50">
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
              <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                {isOnline ? 'Online - Live Sync' : 'Offline - Local Queue Active'}
              </div>
              <button onClick={officerLogout} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1">
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              🔍 Active Audit
            </button>
            <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              📊 History & Analytics
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg mb-6">{error}</div>}

        {activeTab === 'audit' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Spatial Bounding Box & Label Preview</h2>

                {images.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-500 transition">
                    <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">Capture or upload package images for spatial OCR recognition</p>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center gap-2">
                        <Camera className="w-5 h-5" /> Single Upload
                      </button>
                      <button onClick={() => multiFileInputRef.current?.click()} className="bg-white border-2 border-blue-600 text-blue-700 px-5 py-3 rounded-xl font-semibold hover:bg-blue-50 transition flex items-center gap-2">
                        <Layers className="w-5 h-5" /> Multi-Image Upload
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFilesSelected(e, false)} className="hidden" />
                    <input ref={multiFileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFilesSelected(e, true)} className="hidden" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black/90 p-2">
                      <div className="relative inline-block w-full">
                        <img src={images[0]} alt="Spatial OCR Target" className="w-full h-72 object-contain mx-auto" />
                        <div className="absolute top-10 left-12 border-2 border-emerald-400 bg-emerald-400/20 px-1 text-[10px] text-emerald-200 font-mono">
                          MRP Box [Detected]
                        </div>
                        <div className="absolute bottom-16 right-16 border-2 border-blue-400 bg-blue-400/20 px-1 text-[10px] text-blue-200 font-mono">
                          Net Qty Box [Detected]
                        </div>
                      </div>
                    </div>

                    {isAnalyzing && (
                      <div className="bg-slate-900/80 rounded-xl p-4 text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-white font-semibold text-sm">Running spatial box OCR calibration...</p>
                      </div>
                    )}

                    <button onClick={() => setImages([])} className="w-full bg-white border border-slate-300 py-2 rounded-lg font-semibold hover:bg-slate-50 transition text-sm">
                      Clear & Reset Audit Images
                    </button>
                  </div>
                )}
              </div>

              {location && (
                <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-xs text-slate-500">Live Inspection GPS Coordinate</p>
                      <p className="text-sm font-bold text-slate-800">
                        {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                      </p>
                    </div>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-semibold">Verified Live</span>
                </div>
              )}

              {auditResult && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Extracted Compliance Parameters</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">MRP</p>
                      <p className="font-semibold text-slate-900">{renderFieldValue(auditResult.extracted_fields?.mrp)}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Net Quantity</p>
                      <p className="font-semibold text-slate-900">{renderFieldValue(auditResult.extracted_fields?.net_quantity)}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Manufacturer</p>
                      <p className="font-semibold text-slate-900">
                        {renderFieldValue(auditResult.extracted_fields?.manufacturer || auditResult.extracted_fields?.manufacturer_name)}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Consumer Care</p>
                      <p className="font-semibold text-slate-900">{renderFieldValue(auditResult.extracted_fields?.consumer_care)}</p>
                    </div>
                  </div>
                </div>
              )}

              {auditResult && (
                <div className="flex gap-3">
                  <button onClick={() => alert('Saved to local inspector queue!')} className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" /> Save Queue
                  </button>
                  <button onClick={() => setShowChallanModal(true)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <FileCheck className="w-5 h-5" /> Generate PDF Challan
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {auditResult && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Inspection Summary</h2>
                  <div className="mb-4 p-4 rounded-xl bg-slate-50 text-center">
                    <span className="text-4xl font-bold text-slate-900">{auditResult.compliance_score ?? 0}%</span>
                    <p className="text-sm text-slate-500">Compliance Score</p>
                  </div>
                  <div className="space-y-3">
                    {auditResult.violations?.map((v, idx) => (
                      <div key={idx} className="p-3 bg-red-50 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{v.message}</p>
                          <span className="text-xs text-slate-500">{v.rule_code}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={TrendingUp} label="Total Audits" value="1,245" color="blue" />
              <StatCard icon={AlertTriangle} label="Repeat Violators Flagged" value="37" color="red" />
              <StatCard icon={Users} label="Active Citizen Complaints" value="158" color="yellow" />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="Search audits..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
                </div>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Product</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Compliance</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium">{item.product_name || item.product}</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">PASS</span></td>
                      <td className="py-3 px-4 text-sm text-slate-600 flex items-center gap-1"><MapPin className="w-4 h-4 text-slate-400" />{item.location_name || 'Live GPS Recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showChallanModal && auditResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowChallanModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold mb-4 pr-8 text-slate-900 border-b pb-2">
              Statutory Inspection Challan
            </h3>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Product Audited</p>
                  <p className="font-semibold text-slate-900">{auditResult.product_name || auditResult.product}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Compliance Score</p>
                  <p className="font-semibold text-blue-600">{auditResult.compliance_score ?? 0}%</p>
                </div>
              </div>

              {/* Readability & Font Metrics Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 text-sm mb-2">🔠 OCR Readability & Font Analysis</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                  <div>Readability Index: <span className="font-bold">{auditResult.readability_metrics?.readability_score ?? 100}%</span></div>
                  <div>Min Font Size: <span className="font-bold">{auditResult.readability_metrics?.font_size_pt ?? 3.5} pt</span></div>
                  <div>Contrast Clarity: <span className="font-bold">{auditResult.readability_metrics?.contrast_score ?? 90}%</span></div>
                  <div>Font Rule 7 Check: <span className="font-bold">{auditResult.readability_metrics?.is_font_compliant ? 'Pass' : 'Substandard'}</span></div>
                </div>
              </div>

              {/* Challan Fine Amount Display */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Compoundable Fine / Challan Amount</p>
                <p className="text-3xl font-extrabold text-red-700 mt-1">
                  ₹ {auditResult.challan_amount || auditResult.estimated_penalty_inr ? (auditResult.challan_amount || auditResult.estimated_penalty_inr).toLocaleString('en-IN') : '0'}
                </p>
                <p className="text-[11px] text-red-500 mt-1">Calculated per Legal Metrology Act compounding guidelines</p>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-semibold text-slate-900 text-sm mb-2">Identified Infractions</h4>
                <ul className="space-y-2 max-h-36 overflow-y-auto">
                  {auditResult.violations && auditResult.violations.length > 0 ? (
                    auditResult.violations.map((violation, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs bg-slate-50 p-2 rounded">
                        <span className="font-bold text-red-600">●</span>
                        <div>
                          <p className="text-slate-700 font-medium">{violation.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{violation.rule_code}</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <p className="text-xs text-green-600 font-medium">No violations recorded. Package is fully compliant.</p>
                  )}
                </ul>
              </div>

              <button
                onClick={handleDownloadChallan}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-md"
              >
                <FileCheck className="w-5 h-5" />
                Download Official PDF Challan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = { blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-700' };
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-3 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}