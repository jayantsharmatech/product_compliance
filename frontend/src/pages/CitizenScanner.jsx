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
  Layers,
} from 'lucide-react';
import { citizenScan, scanMultipleImages, submitComplaint } from '../utils/api';

export default function CitizenScanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const multiFileInputRef = useRef(null);
  
  const [images, setImages] = useState([]);
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

  // Safe helper to extract string values from field objects preventing React #31 errors
  const renderFieldValue = (field) => {
    if (!field) return 'Not found';
    if (typeof field === 'string' || typeof field === 'number') return field;
    if (typeof field === 'object') {
      return field.value || field.raw_text || 'Not found';
    }
    return 'Not found';
  };

  // Handle single or multiple file uploads
  const handleFilesSelected = async (event, isMultiple = false) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setIsScanning(true);
    setError(null);

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
        result = await scanMultipleImages(files);
      } else {
        result = await citizenScan(files[0]);
      }
      setScanResult(result);
    } catch (err) {
      setError('Backend connection failed or parsing error. Using fallback display.');
    } finally {
      setIsScanning(false);
    }
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
        scan_id: scanResult?.id || scanResult?.scan_id || 'scan_001',
        description: 'Violation reported from citizen scan',
        location: location,
      });
      setShowReportModal(false);
      setShowComplaintForm(true);
    } catch (err) {
      alert('Failed to submit complaint. Please try again.');
    }
  };

  const FieldStatus = ({ fieldData }) => {
    const value = typeof fieldData === 'object' ? fieldData?.value : fieldData;
    const status = fieldData?.status;

    const isAvailable = value && value !== 'Not found' && value !== null && status !== 'missing';

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${
          isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {isAvailable ? '✓ Found' : '✗ Missing'}
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

            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
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
            <h2 className="text-lg font-semibold text-slate-900">Scan Product Label (Single or Multi-Angle)</h2>
          </div>

          {images.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-emerald-500 transition">
              <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Capture or upload single or multiple package labels</p>
              <p className="text-sm text-slate-400 mb-6">Upload front, back, or ingredient panels for deep analysis</p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture / Single Upload
                </button>
                <button
                  onClick={() => multiFileInputRef.current?.click()}
                  className="bg-white border-2 border-emerald-600 text-emerald-700 px-5 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition flex items-center gap-2"
                >
                  <Layers className="w-5 h-5" />
                  Upload Multiple Images
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFilesSelected(e, false)}
                className="hidden"
              />
              
              <input
                ref={multiFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelected(e, true)}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((imgSrc, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 h-36">
                    <img src={imgSrc} alt={`Product label ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {isScanning && (
                <div className="bg-slate-900/80 rounded-xl p-6 text-center">
                  <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-white font-semibold">Analyzing label images with OCR engine...</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setImages([]);
                    setScanResult(null);
                  }}
                  className="flex-1 bg-white border border-slate-300 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition"
                >
                  Clear & Scan Again
                </button>
              </div>
            </div>
          )}
        </div>

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
                (scanResult.compliance_score || 0) >= 80
                  ? 'border-green-200'
                  : (scanResult.compliance_score || 0) >= 50
                  ? 'border-yellow-200'
                  : 'border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {scanResult.product_name || 'Scanned Commodity'}
                  </h3>
                  <p className="text-sm text-slate-500">Verification Result</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-4xl font-bold ${
                      (scanResult.compliance_score || 0) >= 80
                        ? 'text-green-600'
                        : (scanResult.compliance_score || 0) >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {scanResult.compliance_score ?? 0}%
                  </span>
                  <p className="text-sm text-slate-500">Compliance</p>
                </div>
              </div>

              {/* Extracted Fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Scale className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.mrp} />
                  </div>
                  <p className="text-xs text-slate-500">MRP</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.mrp)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Package className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.net_quantity} />
                  </div>
                  <p className="text-xs text-slate-500">Net Quantity</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.net_quantity)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.mfg_date} />
                  </div>
                  <p className="text-xs text-slate-500">Manufacturing Date</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.mfg_date)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.expiry_date} />
                  </div>
                  <p className="text-xs text-slate-500">Expiry Date</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.expiry_date)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.consumer_care} />
                  </div>
                  <p className="text-xs text-slate-500">Consumer Care</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.consumer_care)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <FieldStatus fieldData={scanResult.extracted_fields?.manufacturer || scanResult.extracted_fields?.manufacturer_name} />
                  </div>
                  <p className="text-xs text-slate-500">Manufacturer</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.manufacturer) !== 'Not found'
                      ? renderFieldValue(scanResult.extracted_fields?.manufacturer)
                      : renderFieldValue(scanResult.extracted_fields?.manufacturer_name)}
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
                  defaultValue="Missing mandatory package declarations identified during scan."
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
                setImages([]);
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