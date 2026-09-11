# Legal Metrology Compliance Platform
An AI-driven compliance verification and enforcement system for evaluating pre-packaged commodities against the 
Legal Metrology (Packaged Commodities) Rules, 2011 and computing penalties under Section 36(1) of the Legal Metrology Act, 2009.

---
 Key Features

- Multi-angle product label upload
- OCR and label text extraction
- Mandatory declaration detection
- Deterministic legal rule engine
- Barcode / GS1 prefix cross-checking
- Font height and readability analysis
- Compliance score calculation
- Violation and penalty computation
- Visual bounding-box evidence on label images
- Downloadable PDF challan / inspection reports
- Scan history and audit trail
- Mobile-friendly interface
- GPS-assisted inspection support
- Offline-first provisional scan support

---
 System Architecture
## Frontend
- React SPA
- Vite
- Tailwind CSS
- Lucide Icons
- React Router
- Axios
### Backend
- Python
- FastAPI
- Uvicorn
### Infrastructure
- Vercel for frontend hosting
- AWS EC2 for backend deployment
- HTTPS-enabled API endpoint
- SQLite / Supabase for persistence
---
##  How It Works
1. User captures or uploads label images.
2. Frontend sends images and optional GPS data to backend.
3. OCR / vision model extracts label text and bounding boxes.
4. Rule engine checks extracted data against Legal Metrology rules.
5. Compliance score and violations are calculated.
6. Penalty amount is computed if violations exist.
7. Results are shown in the UI.
8. PDF challan / inspection report is generated for download.
9. Scan history is stored for future audit and review.
---
##  Core Modules

### `main.py`
Handles routing, request processing, and orchestration between frontend, OCR, rule engine, and reporting modules.

### `extraction.py`
Extracts statutory declarations from product label images using Gemini Vision or local fallback models.

### `rule_engine.py`
Applies Legal Metrology compliance rules, evaluates missing or incorrect declarations, and calculates penalties.

### `database.py`
Stores scan records, provisional results, and audit history.

### `pdf_generator.py`
Creates official PDF challans and inspection reports.

### `BoundingBoxInspector.jsx`
Displays highlighted bounding boxes directly on the scanned label image as visual evidence.

---

##  Compliance Checks

The system evaluates the following fields:

- MRP
- Net Quantity
- Manufacturer / Packer name and address
- Consumer Care details
- Manufacturing date
- Best before / expiry date
- Country of origin
- FSSAI number
- Barcode validity and GS1 prefix
- Font size and readability
- Label contrast and visibility

---

## 🌐 Offline-First Design

The platform follows a hybrid approach:

- **Online mode:** Uses Gemini Vision for higher accuracy and bounding-box evidence
- **Offline mode:** Falls back to a local LLaVA/Ollama model for provisional inspection
- **Auto re-verification:** Offline scans are rechecked when internet becomes available

Offline results are clearly marked as **provisional** until verified.
---

## 💡 Why This Project is Different

This is not just an OCR tool.

It is:
- a legal enforcement workbench
- a rule-based compliance engine
- a fine calculation system
- a court-ready reporting platform
- an offline-capable field inspection system

The legal verdict is determined by deterministic Python logic, not by AI guesswork.

---

## 🛠️ Technology Stack

| Layer | Technology |
|------|------------|
| Frontend | React, Vite, Tailwind CSS, React Router |
| Backend | FastAPI, Uvicorn |
| AI Vision | Google Gemini Vision / local LLaVA via Ollama |
| OCR / Detection | Vision extraction + bounding box coordinates |
| Storage | SQLite / Supabase |
| Reporting | ReportLab |
| Maps / Location | Google Maps links |
| Deployment | Vercel + AWS EC2 |

---

## 📦 Installation
### Prerequisites
- Node.js 18+
- Python 3.10+
- Git
---
### 1. Clone the Repository
```bash
git clone [https://github.com/jayantsharmatech/product_compliance.git](https://github.com/jayantsharmatech/product_compliance.git)
cd product_compliance
cd your-repo-name
2. Frontend Setup
bash
cd frontend
npm install

Create a .env file in the frontend root:
env
VITE_API_BASE_URL=https://3.109.159.235.nip.io
VITE_USE_MOCK=false

Run the frontend:
bash
npm run dev

3. Backend Setup
bash
cd backend
pip install -r requirements.txt
Run the backend:
bash
uvicorn main:app --reload --port 8000
🚀 Development
Frontend
Open:

text


http://localhost:5173
Backend
Open:

text


http://localhost:8000
🌍 Deployment
Frontend
Deployed automatically via Vercel using SPA rewrite rules.

Backend
Hosted on AWS EC2 behind an SSL-enabled endpoint.

Example Backend URL
text


https://3.109.159.235.nip.io
🔌 API Endpoints
POST /scan
Uploads and processes a product label image.

POST /scan-multiple
Uploads multiple label panels and consolidates them into one inspection context.

GET /report/{id}
Returns the downloadable PDF challan / inspection report.

POST /sync
Re-verifies provisional offline scans when internet becomes available.

📄 Output Generated
The system produces:

Compliance score
List of violations
Severity classification
Penalty amount
Visual evidence overlays
PDF challan
Inspection report
Persistent audit trail
📚 Research & References
Legal Metrology (Packaged Commodities) Rules, 2011
Legal Metrology Act, 2009
GS1 India Barcode & GTIN Standards
Google Gen AI Python SDK
Ollama Documentation
FSSAI Labelling and Display Regulations, 2020
🗺️ Future Scope
Role-based authentication
Officer dashboards
Case management workflow
PostgreSQL support
Advanced counterfeit detection
Native mobile app
Multi-language label verification
Integration with government databases

📄 License
This project is developed and is intended for educational and prototyping use.
