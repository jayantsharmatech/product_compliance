import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Shield,
  ScanLine,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Scale,
  Package,
  Calendar,
  Phone,
  MapPin,
  Building2,
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">MetrologyGuard</h1>
                <p className="text-xs text-slate-500">Legal Metrology Compliance System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          {/* <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Scale className="w-4 h-4" />
            Government of India · Legal Metrology Compliance System
          </div> */}
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Verify Packaged Commodities
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Under Legal Metrology Rules, 2011
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Scan, validate, and enforce compliance of packaged goods. Protect consumers and empower enforcement
            officers with AI-powered label analysis.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
          {/* Citizen Card */}
          <button
            onClick={() => navigate('/citizen')}
            className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-emerald-500 text-left"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <ScanLine className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Citizen Quick Scan</h2>
                <p className="text-slate-500">For Consumers</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Instant product verification
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-5 h-5 text-emerald-500" />
                Expiry date detection
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <AlertTriangle className="w-5 h-5 text-emerald-500" />
                Report violations
              </li>
            </ul>
            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-emerald-700 font-semibold mb-2">What you can verify:</p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">MRP</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Net Quantity</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Manufacturer</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Expiry Date</span>
              </div>
            </div>
            <div className="bg-emerald-600 text-white py-3 rounded-xl font-semibold text-center group-hover:bg-emerald-700 transition">
              Scan a Product →
            </div>
          </button>

          {/* Officer Card */}
          <button
            onClick={() => navigate('/officer-login')}
            className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-500 text-left"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-100 p-3 rounded-xl">
                <ClipboardCheck className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Enforcement Officer</h2>
                <p className="text-slate-500">Legal Metrology Officials</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-slate-600">
                <FileCheck className="w-5 h-5 text-blue-500" />
                Full audit engine
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <Scale className="w-5 h-5 text-blue-500" />
                Scale calibration
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-5 h-5 text-blue-500" />
                Violation tracking
              </li>
            </ul>
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-700 font-semibold mb-2">Workbench features:</p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Audit Canvas</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Challan Generation</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Analytics</span>
                <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">Offline Queue</span>
              </div>
            </div>
            <div className="bg-blue-600 text-white py-3 rounded-xl font-semibold text-center group-hover:bg-blue-700 transition">
              Login to Workbench →
            </div>
          </button>
        </div>

        {/* Statutory Checklist */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-slate-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                Mandatory Declarations Under Legal Metrology Rules, 2011
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Package, label: 'Net Quantity', desc: 'Weight/Volume in standard units' },
                { icon: Scale, label: 'MRP', desc: 'Maximum Retail Price incl. taxes' },
                { icon: Building2, label: 'Manufacturer Address', desc: 'Full registered address' },
                { icon: Calendar, label: 'Mfg Date', desc: 'Date of manufacture/import' },
                { icon: Calendar, label: 'Best Before', desc: 'Expiry or best before date' },
                { icon: Phone, label: 'Consumer Care', desc: 'Contact details for complaints' },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                  <item.icon className="w-6 h-6 text-emerald-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.label}</h3>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-500 text-sm">© 2026 MetrologyGuard · Built for Smart India Hackathon</p>
        </div>
      </footer>
    </div>
  );
}