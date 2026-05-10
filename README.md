# OpenDesk Parcel

**PROPRIETARY NOTICE:** This software and its source code are the exclusive property of the copyright holder. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without prior written permission.

---

Multi-tenant parcel management SaaS built with Node.js + Express, PostgreSQL, React, and Tailwind CSS. Enables logistics companies to manage parcel lifecycles with M-Pesa payments, WhatsApp notifications, QR scanning, and PDF receipts.

## Architecture

```
opendeskparcel/
├── backend/          # Express REST API (Node.js)
│   ├── middleware/    # Auth middleware (JWT + role-based)
│   ├── routes/        # auth, admin, company, office, scan, mpesaCallback
│   ├── utils/         # cron, encryption, mpesa, pdf, qr, whatsapp, idgen, helpers
│   ├── db.js          # PostgreSQL connection pool
│   └── server.js      # Entry point
├── frontend/         # React SPA (Vite + Tailwind CSS v4)
│   └── src/
│       ├── api/       # Axios client configuration
│       ├── contexts/  # Auth context provider
│       └── pages/     # admin/, company/, office/, Login, Register, Scan, etc.
├── migrations/       # SQL migration files (run in sorted order)
├── seed.js           # Database seeder (root-level)
├── docker-compose.yml
└── render.yaml       # Render deployment manifest
```

## Features

- Multi-tenant data isolation (per-company)
- Parcel lifecycle: create → dispatch → arrival → pickup
- M-Pesa Daraja STK Push (two-layer: platform subscription + per-parcel fees)
- WhatsApp notifications via Twilio
- AES-256-CBC encrypted storage of company M-Pesa credentials
- QR code sticker printing and PDF receipt generation
- QR code scanning via device camera
- Role-based access: Super Admin, Company Admin, Office Staff
- Rate limiting, Helmet security headers, morgan logging

## Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Backend     | Node.js, Express, pg (node-postgres)    |
| Frontend    | React 19, React Router 7, Tailwind CSS 4|
| Database    | PostgreSQL 15                           |
| Payments    | Safaricom M-Pesa Daraja API             |
| Messaging   | Twilio WhatsApp API                     |
| Auth        | JWT (jsonwebtoken + bcryptjs)           |
| PDF/QR      | PDFKit, QRCode, jsQR                    |
| Deployment  | Render (render.yaml), Docker            |

## Quick Start

```bash
# 1. Install dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# 2. Create and seed the database
createdb opendesk
node seed.js

# 3. Start backend (http://localhost:5000)
cd backend && npm run dev

# 4. Start frontend (http://localhost:5173)
cd frontend && npm run dev
```

## Default Credentials (after seed)

| Role               | Email                       | Password   |
|--------------------|-----------------------------|------------|
| Super Admin        | admin@opendesk.com          | admin123   |
| Company Admin      | admin@demologs.com          | company123 |
| Staff (Nairobi)    | staff.nairobi@demologs.com  | staff123   |
| Staff (Mombasa)    | staff.mombasa@demologs.com  | staff123   |

## Docker

```bash
docker-compose up postgres -d
docker-compose up backend
```

## License

**Proprietary.** All rights reserved. See the [LICENSE](./LICENSE) file for terms.
