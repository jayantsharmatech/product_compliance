<div align="center">

# ⚖️ Legal Metrology Compliance Platform

**AI-powered, category-aware packaging label audit and enforcement for regulatory inspectors**

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-Vision-4285F4?logo=google&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS-S3-FF9900?logo=amazons3&logoColor=white)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
  - [End-to-End Pipeline](#end-to-end-pipeline) · [Request Sequence](#request-sequence) · [Rule Engine Flow](#rule-engine-decision-flow) · [Model Fallback](#gemini-model-fallback) · [Offline Queue](#offline-queue--sync) · [Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Docker Deployment](#docker-deployment)
- [Regulatory Reference](#regulatory-reference)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Overview

Enforcement officers traditionally inspect retail packages by hand, checking each label for the statutory declarations required under Indian law: MRP, net quantity, manufacturer details, country of origin, consumer care details, and FSSAI licence numbers. The process is slow, repetitive, and prone to inconsistency between inspectors.

The **Legal Metrology Compliance Platform** automates the full inspection lifecycle. An inspector photographs a package in the field, and the platform extracts the label text, evaluates it against the applicable rules for that product category, calculates the penalty, and produces an official challan PDF, all in one workflow.

## Key Features

| Feature | Description |
|---|---|
| 🔍 **Multimodal AI Extraction** | Google Gemini reads label text from package photos and returns spatial bounding boxes (`box_2d`) on a normalized **0–1000** coordinate grid. |
| 🧠 **Category-Aware Rule Engine** | Detects the product category (Food & Beverage, Electronics, Stationery, etc.) and applies the correct statutory requirements and exemptions, for example exempting non-food items from FSSAI and expiry checks. |
| 💰 **Automated Fine Calculation** | Evaluates infractions against **Section 36** of the Legal Metrology Act, applying compounding caps and first-offence relief rules. |
| 📄 **Professional PDF Challans** | Generates government-style inspection reports with GPS coordinates and a visual breakdown of violations using ReportLab. |
| 📅 **Date Normalization** | Parses messy manufacturing and expiry date formats found on real packages into a standard form. |
| 📡 **Offline Queue** | Scans captured with poor connectivity are queued locally and synchronized later. |
| ☁️ **Secure Cloud Storage** | Package images are uploaded to AWS S3, with a base64 data-URI fallback when S3 is unavailable. |
| 🔁 **Model Fallback Chain** | Automatically falls back across multiple Gemini models for resilience against quota or availability issues. |

## How It Works

### End-to-End Pipeline

```mermaid
flowchart LR
    A["📸 Inspector captures<br/>package photo + GPS"] --> B["extraction.py<br/>Gemini OCR + box_2d"]
    B --> C["date_engine.py<br/>Normalize MFG / Expiry"]
    C --> D["rule_engine.py<br/>Category rules + fine"]
    D --> E["pdf_generator.py<br/>Challan PDF"]
    D --> F[("database.py<br/>Scan records")]
    A -.-> G[("s3_service.py<br/>Image storage")]

    style A fill:#e3f2fd,stroke:#1976d2,color:#000
    style B fill:#fff3e0,stroke:#f57c00,color:#000
    style C fill:#fff3e0,stroke:#f57c00,color:#000
    style D fill:#fce4ec,stroke:#c2185b,color:#000
    style E fill:#e8f5e9,stroke:#388e3c,color:#000
    style F fill:#f3e5f5,stroke:#7b1fa2,color:#000
    style G fill:#f3e5f5,stroke:#7b1fa2,color:#000
```

1. **Capture**: the inspector uploads one or more package photos along with GPS coordinates.
2. **Extract**: Gemini returns structured JSON containing each declaration's text value and its bounding box.
3. **Normalize**: dates are parsed and standardized.
4. **Evaluate**: the rule engine detects the category, applies relevant rules and exemptions, deducts compliance score, and computes the fine.
5. **Report**: a challan PDF is generated and the scan is stored in history.

### Request Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Inspector
    participant API as FastAPI (main.py)
    participant S3 as s3_service.py
    participant AI as extraction.py (Gemini)
    participant DT as date_engine.py
    participant RE as rule_engine.py
    participant DB as database.py
    participant PDF as pdf_generator.py

    Inspector->>API: POST /scan (image + GPS)
    API->>S3: Upload image
    S3-->>API: URL (or base64 fallback)
    API->>AI: Extract label fields
    AI-->>API: Values + box_2d (0-1000)
    API->>DT: Normalize dates
    DT-->>API: Standard MFG / Expiry
    API->>RE: Evaluate compliance
    RE-->>API: Violations, score, fine
    API->>DB: Save scan record
    API-->>Inspector: Scan result + scan_id
    Inspector->>API: GET /report/{scan_id}
    API->>PDF: Build challan
    PDF-->>Inspector: PDF challan
```

### Rule Engine Decision Flow

```mermaid
flowchart TD
    S([Extracted label data]) --> C{"Detect product<br/>category"}
    C -->|Food & Beverage| F["Apply LM Rules<br/>+ FSSAI checks"]
    C -->|Electronics| N["Apply LM Rules<br/>FSSAI exempt"]
    C -->|Stationery / Other| N
    F --> M{"Mandatory declarations<br/>present?"}
    N --> M
    M -->|Missing items| V["Record violations<br/>deduct score"]
    M -->|All present| OK(["✅ Compliant"])
    V --> P{"First offence?"}
    P -->|Yes| R["Apply first-offence<br/>relief"]
    P -->|No| X["Standard penalty"]
    R --> CAP["Apply Section 36<br/>compounding cap"]
    X --> CAP
    CAP --> OUT(["Final fine + compliance score"])

    style OK fill:#e8f5e9,stroke:#388e3c,color:#000
    style OUT fill:#fce4ec,stroke:#c2185b,color:#000
    style V fill:#fff3e0,stroke:#f57c00,color:#000
```

### Gemini Model Fallback

```mermaid
flowchart LR
    R([Extraction request]) --> M1["Primary model<br/>gemini-3.8-flash"]
    M1 -->|Success| OK([Return JSON + box_2d])
    M1 -->|Quota / error| M2["Next fallback model"]
    M2 -->|Success| OK
    M2 -->|Quota / error| M3["Last fallback<br/>gemini-3.5-flash-lite"]
    M3 -->|Success| OK
    M3 -->|Fails| ERR(["Error returned /<br/>scan queued"])

    style OK fill:#e8f5e9,stroke:#388e3c,color:#000
    style ERR fill:#ffebee,stroke:#c62828,color:#000
```

### Offline Queue & Sync

```mermaid
flowchart TD
    A([Scan captured]) --> B{"Network / API<br/>available?"}
    B -->|Yes| C["Process immediately"]
    B -->|No| D["Save image to<br/>queued_scan_images/"]
    D --> E[("Queue record<br/>in database.py")]
    E --> F{"Connectivity<br/>restored?"}
    F -->|No| F
    F -->|Yes| G["Sync queued scans"]
    G --> C
    C --> H(["Result + challan available"])
```

### System Architecture

```mermaid
flowchart TB
    subgraph Client["Client"]
        U["Inspector device<br/>camera + GPS"]
    end

    subgraph Backend["FastAPI Backend (Docker)"]
        M["main.py<br/>routing + health"]
        X["extraction.py"]
        D["date_engine.py"]
        R["rule_engine.py"]
        P["pdf_generator.py"]
        S["s3_service.py"]
        DB["database.py"]
    end

    subgraph External["External Services"]
        G["Google Gemini API"]
        S3[("AWS S3")]
    end

    subgraph Data["Persistence"]
        SQL[("SQLite / PostgreSQL")]
    end

    U <--> M
    M --> X --> G
    M --> D
    M --> R
    M --> P
    M --> S --> S3
    M --> DB --> SQL
```

> The diagrams above use [Mermaid](https://mermaid.js.org/), which renders natively on GitHub, GitLab and most Markdown viewers. The flow shown reflects the module responsibilities described in this document; adjust the branches if your implementation differs.

## Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn |
| **AI Engine** | Google Gemini via the `google-genai` SDK, with multi-model fallback (`gemini-3.8-flash` down to `gemini-3.5-flash-lite`) |
| **Reports & Imaging** | ReportLab, Pillow |
| **Storage** | SQLite / PostgreSQL, AWS S3 (Boto3) |
| **HTTP** | Requests |
| **Deployment** | Docker |

## Project Structure

```
product_compliance/
└── backend/
    ├── queued_scan_images/   # Images held for offline queue sync
    ├── static/               # Static assets
    ├── .env                  # Environment variables (not committed)
    ├── database.py           # Persistent scan records & offline queue
    ├── date_engine.py        # MFG / expiry date normalization
    ├── Dockerfile            # Container configuration
    ├── extraction.py         # Gemini vision OCR & bounding box parser
    ├── main.py               # FastAPI app, routing & health checks
    ├── pdf_generator.py      # ReportLab challan generator
    ├── requirements.txt      # Python dependencies
    ├── rule_engine.py        # Legal Metrology & FSSAI rule engine
    └── s3_service.py         # S3 upload with base64 fallback
```

## Core Modules

| Module | Responsibility |
|---|---|
| **`main.py`** | FastAPI entrypoint. Exposes `/scan`, `/scan-multi`, `/history`, and `/report/{scan_id}` along with health checks. |
| **`extraction.py`** | Calls Gemini with multi-model fallback and a strict JSON schema, returning text values and `box_2d` boxes on the 0–1000 grid. |
| **`rule_engine.py`** | Evaluates compliance under Indian packaging law, deducts scores, and calculates compounding fines while respecting category exemptions. |
| **`pdf_generator.py`** | Builds category-aware, government-grade inspection challan PDFs with ReportLab. |
| **`date_engine.py`** | Standardizes manufacturing and expiry date formats. |
| **`s3_service.py`** | Handles secure uploads to AWS S3, falling back to base64 data URIs. |
| **`database.py`** | Manages scan records and offline queue synchronization. |

## Getting Started

### Prerequisites

- Python 3.10 or newer
- A [Google Gemini API key](https://aistudio.google.com/)
- (Optional) An AWS account and S3 bucket for image storage

### 1. Clone and install

```bash
git clone <your-repository-url>
cd product_compliance/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file inside `backend/` (see [Configuration](#configuration)).

### 3. Run the server

```bash
uvicorn main:app --reload --port 8000
```

The API is now available at `http://localhost:8000`, and interactive docs at `http://localhost:8000/docs`.

## Configuration

Create `backend/.env`:

```env
GEMINI_API_KEY=your_google_genai_api_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_STORAGE_BUCKET_NAME=your_s3_bucket_name
AWS_S3_REGION=ap-south-1
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key used for label extraction. |
| `AWS_ACCESS_KEY_ID` | Optional | AWS credentials for S3 uploads. |
| `AWS_SECRET_ACCESS_KEY` | Optional | AWS credentials for S3 uploads. |
| `AWS_STORAGE_BUCKET_NAME` | Optional | Target S3 bucket. |
| `AWS_S3_REGION` | Optional | S3 region (default shown: `ap-south-1`). |

> **Note:** If S3 credentials are not provided, images fall back to base64 data URIs.
> Never commit `.env` to version control. Make sure it is listed in `.gitignore`.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/scan` | Submit a single package image for extraction and compliance evaluation. |
| `POST` | `/scan-multi` | Submit multiple images (e.g. front, back, side panels) of one package for a combined audit. |
| `GET` | `/history` | List previously stored scan records. |
| `GET` | `/report/{scan_id}` | Download the generated PDF challan for a scan. |

Full request and response schemas are available in the auto-generated Swagger UI at `/docs`.

### Bounding Box Format

Each extracted field includes a `box_2d` value on a normalized 0–1000 grid, independent of the original image resolution:

```json
{
  "field": "mrp",
  "value": "₹ 120.00",
  "box_2d": [ymin, xmin, ymax, xmax]
}
```

To convert to pixels: `pixel_x = (x / 1000) * image_width` and `pixel_y = (y / 1000) * image_height`.

## Docker Deployment

```bash
cd backend
docker build -t legal-metrology-platform .
docker run -d \
  --name lm-platform \
  --env-file .env \
  -p 8000:8000 \
  legal-metrology-platform
```

## Regulatory Reference

| Instrument | Relevance |
|---|---|
| **Legal Metrology (Packaged Commodities) Rules, 2011** | Mandates declarations of MRP, net quantity, manufacturer details, consumer care, and country of origin. |
| **Legal Metrology Act, 2009** | Governs Section 36 offences and compounding of fines. |
| **FSSAI Packaging and Labelling Regulations, 2011** | Governs mandatory licence numbers and expiry declarations for food and beverage items. |

## Roadmap

- [ ] Mobile inspector companion app with offline-first capture
- [ ] Barcode / QR cross-verification against product databases
- [ ] Multilingual label support (Hindi and regional languages)
- [ ] Inspector dashboard with analytics and violation trends
- [ ] Role-based access control and audit logging

## Disclaimer

This platform is an inspection **aid**. AI-extracted values and computed penalties should be verified by an authorized officer before any enforcement action is taken. Statutory provisions, fine schedules, and exemptions are subject to amendment; always confirm against current notifications.

## License

Developed for regulatory compliance enforcement and inspection automation. Add your chosen license (e.g. MIT, Apache-2.0, or a proprietary/government license) in a `LICENSE` file and update this section accordingly.
