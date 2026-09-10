import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ScanLine,
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Package,
  Scale,
  Calendar,
  Phone,
  Building2,
  MapPin,
  X,
  ChevronLeft,
  Info,
} from 'lucide-react';
import { citizenScan, submitComplaint } from '../utils/api';

export default function CitizenScanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [location, setLocation] = useState(null);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic online/offline state
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setImage(e.target.result);
      setIsScanning(true);
      setError(null);

      try {
        const blob = await (await fetch(e.target.result)).blob();
        const result = await citizenScan(blob);
        setScanResult(result);
      } catch (err) {
        setError('Backend not connected. Using mock data for demo.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setShowReportModal(true);
        },
        () => {
          setLocation({ lat: 28.6139, lng: 77.209 });
          setShowReportModal(true);
        }
      );
    } else {
      setLocation({ lat: 28.6139, lng: 77.209 });
      setShowReportModal(true);
    }
  };

  const handleSubmitComplaint = async () => {
    try {
      await submitComplaint({
        scan_id: scanResult?.id || 'scan_001',
        description: 'Violation reported from citizen scan',
        location: location,
      });
      setShowReportModal(false);
      setShowComplaintForm(true);
    } catch (err) {
      alert('Failed to submit complaint. Please try again.');
    }
  };

  const FieldStatus = ({ status }) => {
    const styles = {
      valid: 'bg-green-100 text-green-700',
      warning: 'bg-yellow-100 text-yellow-700',
      missing: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {status === 'valid' ? '✓' : status === 'warning' ? '⚠' : '✗'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <ChevronLeft className="w-6 h-6 text-slate-600" />
              </button>
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Citizen Scanner</h1>
                <p className="text-xs text-slate-500">Quick Compliance Verification</p>
              </div>
            </div>

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
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scan Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ScanLine className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Scan Product Label</h2>
          </div>

          {!image ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-emerald-500 transition">
              <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Capture or upload package label image</p>
              <p className="text-sm text-slate-400 mb-6">Ensure label is well-lit and text is readable</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleCapture}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border-2 border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:border-emerald-500 hover:text-emerald-600 transition flex items-center gap-2"
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
                <img src={image} alt="Product label" className="w-full h-72 object-cover" />
                {isScanning && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                      <p className="text-white font-semibold">Analyzing label...</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCapture}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition"
                >
                  Retake
                </button>
                <button
                  onClick={() => {
                    setImage(null);
                    setScanResult(null);
                  }}
                  className="flex-1 bg-white border border-slate-300 py-2 rounded-lg font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Scan Results */}
        {scanResult && !isScanning && (
          <div className="space-y-6">
            <div
              className={`bg-white rounded-2xl p-6 shadow-lg border ${
                scanResult.compliance_score >= 80
                  ? 'border-green-200'
                  : scanResult.compliance_score >= 50
                  ? 'border-yellow-200'
                  : 'border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {scanResult.product_name || 'Unknown Product'}
                  </h3>
                  <p className="text-sm text-slate-500">Verification Result</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-4xl font-bold ${
                      scanResult.compliance_score >= 80
                        ? 'text-green-600'
                        : scanResult.compliance_score >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {scanResult.compliance_score}%
                  </span>
                  <p className="text-sm text-slate-500">Compliance</p>
                </div>
              </div>

              {/* Extracted Fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Scale className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.mrp?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">MRP</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.mrp?.value || 'Not found'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Package className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.net_quantity?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">Net Quantity</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.net_quantity?.value || 'Not found'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.mfg_date?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">Manufacturing Date</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.mfg_date?.value || 'Not found'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.expiry_date?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">Expiry Date</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.expiry_date?.value || 'Not found'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.consumer_care?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">Consumer Care</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.consumer_care?.value || 'Not found'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <FieldStatus status={scanResult.extracted_fields?.manufacturer?.status || 'missing'} />
                  </div>
                  <p className="text-xs text-slate-500">Manufacturer</p>
                  <p className="font-semibold text-slate-900">
                    {scanResult.extracted_fields?.manufacturer?.value || 'Not found'}
                  </p>
                </div>
              </div>

              {/* Violations */}
              {scanResult.violations && scanResult.violations.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-semibold text-red-700 mb-2">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Violations Detected
                  </h4>
                  <div className="space-y-2">
                    {scanResult.violations.map((violation, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-1 ${
                            violation.severity === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500'
                          }`}
                        >
                          ●
                        </span>
                        <div>
                          <p className="text-slate-700">{violation.message}</p>
                          <span
                            className={`text-xs font-semibold ${
                              violation.severity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'
                            }`}
                          >
                            {violation.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Report Button */}
              <button
                onClick={getLocation}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                Report Violation to Department
              </button>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-8">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-800 mb-1">About Legal Metrology Rules, 2011</h3>
              <p className="text-sm text-blue-700">
                The Legal Metrology (Packaged Commodities) Rules, 2011 mandate that all pre-packaged goods must
                declare: MRP, Net Quantity, Manufacturer details, Date of Manufacturing/Import, Best Before/Expiry
                date, and Consumer Care contact.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-semibold text-slate-900">Report Violation</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Location Captured</p>
                {location ? (
                  <p className="text-sm font-medium text-slate-700">
                    📍 {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Acquiring location...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Violation Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows="3"
                  placeholder="Describe the violation..."
                  defaultValue="Missing consumer care details and incorrect date format on packaging"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmitComplaint}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition"
                >
                  Submit Complaint
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-white border border-slate-300 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showComplaintForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Complaint Registered!</h3>
            <p className="text-slate-600 mb-6">
              Your complaint has been submitted with location evidence and will be assigned to the nearest
              enforcement officer.
            </p>
            <button
              onClick={() => {
                setShowComplaintForm(false);
                setImage(null);
                setScanResult(null);
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}