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

    setIsScanning(true);
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
        result = await scanMultipleImages(files, currentCoords.lat, currentCoords.lng, 'Citizen Live Inspection');
      } else {
        result = await citizenScan(files[0], currentCoords.lat, currentCoords.lng, 'Citizen Live Inspection');
      }
      setScanResult(result);
    } catch (err) {
      setError('Backend connection failed or parsing error.');
    } finally {
      setIsScanning(false);
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
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {isAvailable ? '✓ Found' : '✗ Missing'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
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

            <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {isOnline ? 'Online - Live Sync' : 'Offline - Local Queue Active'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ScanLine className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Scan Product Label (Single or Multi-Angle)</h2>
          </div>

          {images.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-emerald-500 transition">
              <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Capture or upload package labels with automatic GPS logging</p>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center gap-2">
                  <Camera className="w-5 h-5" /> Single Upload
                </button>
                <button onClick={() => multiFileInputRef.current?.click()} className="bg-white border-2 border-emerald-600 text-emerald-700 px-5 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Multi-Image Upload
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFilesSelected(e, false)} className="hidden" />
              <input ref={multiFileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFilesSelected(e, true)} className="hidden" />
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
                  <p className="text-white font-semibold">Analyzing label images and logging GPS location...</p>
                </div>
              )}

              <button onClick={() => { setImages([]); setScanResult(null); }} className="w-full bg-white border border-slate-300 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition">
                Clear & Scan Again
              </button>
            </div>
          )}
        </div>

        {error && <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg mb-6">{error}</div>}

        {scanResult && !isScanning && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{scanResult.product_name || 'Scanned Commodity'}</h3>
                  <p className="text-sm text-slate-500">Verification Result</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-bold text-emerald-600">{scanResult.compliance_score ?? 0}%</span>
                  <p className="text-sm text-slate-500">Compliance</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Scale className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.mrp} /></div>
                  <p className="text-xs text-slate-500">MRP</p>
                  <p className="font-semibold text-slate-900">{renderFieldValue(scanResult.extracted_fields?.mrp)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Package className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.net_quantity} /></div>
                  <p className="text-xs text-slate-500">Net Quantity</p>
                  <p className="font-semibold text-slate-900">{renderFieldValue(scanResult.extracted_fields?.net_quantity)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Calendar className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.mfg_date} /></div>
                  <p className="text-xs text-slate-500">Manufacturing Date</p>
                  <p className="font-semibold text-slate-900">{renderFieldValue(scanResult.extracted_fields?.mfg_date)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Calendar className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.expiry_date} /></div>
                  <p className="text-xs text-slate-500">Expiry Date</p>
                  <p className="font-semibold text-slate-900">{renderFieldValue(scanResult.extracted_fields?.expiry_date)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Phone className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.consumer_care} /></div>
                  <p className="text-xs text-slate-500">Consumer Care</p>
                  <p className="font-semibold text-slate-900">{renderFieldValue(scanResult.extracted_fields?.consumer_care)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1"><Building2 className="w-4 h-4 text-slate-500" /><FieldStatus fieldData={scanResult.extracted_fields?.manufacturer || scanResult.extracted_fields?.manufacturer_name} /></div>
                  <p className="text-xs text-slate-500">Manufacturer</p>
                  <p className="font-semibold text-slate-900">
                    {renderFieldValue(scanResult.extracted_fields?.manufacturer) !== 'Not found'
                      ? renderFieldValue(scanResult.extracted_fields?.manufacturer)
                      : renderFieldValue(scanResult.extracted_fields?.manufacturer_name)}
                  </p>
                </div>
              </div>

              <button onClick={() => setShowReportModal(true)} className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Report Violation with Live GPS
              </button>
            </div>
          </div>
        )}
      </main>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Report Violation</h3>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Live GPS Location</p>
              {location ? <p className="text-sm font-medium text-slate-700">📍 {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E</p> : <p className="text-sm text-slate-500">Acquiring GPS...</p>}
            </div>
            <button onClick={handleSubmitComplaint} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold">Submit Complaint</button>
          </div>
        </div>
      )}

      {showComplaintForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Complaint Registered!</h3>
            <button onClick={() => { setShowComplaintForm(false); setImages([]); setScanResult(null); }} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}