# Lab 11: CI/CD Pipelines with GitHub Actions (01204425)

โปรเจกต์ IoT Backend ตัวอย่างสำหรับ Workshop 11 — สาธิตการทำ CI/CD Pipeline ด้วย GitHub Actions, ESLint, Jest และ Docker

## ภาพรวม

Backend API อย่างง่ายสำหรับรับค่า telemetry จากอุปกรณ์ IoT (เช่น ESP32) โดยไม่ต้องใช้ฐานข้อมูลจริง:

- `GET /api/health` — ตรวจสอบสถานะเซิร์ฟเวอร์ ตอบกลับ `{ "status": "ok" }`
- `POST /api/telemetry` — รับ `{ device_id, voltage, current? }` ตรวจสอบข้อมูล แล้วจัดประเภทแรงดันไฟฟ้าเป็น `LOW` / `NORMAL` / `CRITICAL` ด้วย `utils/voltageChecker.js`

## เทคโนโลยีที่ใช้

| ส่วน | เครื่องมือ |
|---|---|
| Runtime | Node.js 20 LTS (CommonJS) |
| Web framework | Express |
| Linter | ESLint 9 (flat config) |
| Test | Jest + Supertest |
| CI | GitHub Actions (lint + test ทุก pull request) |
| CD | GitHub Actions (build + push Docker image ไป Docker Hub) |
| Container | Docker (node:20-alpine) |

## โครงสร้างไฟล์

```
Lab11/
├── package.json
├── package-lock.json
├── eslint.config.js          # ESLint 9 flat config (CommonJS)
├── app.js                    # Express app + createApp() factory
├── app.test.js               # API tests (supertest)
├── Dockerfile
├── .dockerignore
├── .gitignore
├── README.md                 # ไฟล์นี้
├── DOCS_TH.md                # คู่มือละเอียดภาษาไทย (3 กิจกรรม)
├── utils/
│   ├── voltageChecker.js     # ตรรกะจัดประเภทแรงดันไฟฟ้า (pure function)
│   └── voltageChecker.test.js
└── .github/
    └── workflows/
        ├── ci.yml            # CI: lint + test เมื่อเปิด PR เข้า main
        └── cd.yml            # CD: build + push Docker image เมื่อ merge เข้า main
```

## วิธีรัน

```bash
npm install        # ติดตั้ง dependencies
npm run lint       # ตรวจคุณภาพโค้ดด้วย ESLint
npm test           # รัน unit tests ด้วย Jest
npm start          # รันเซิร์ฟเวอร์ (พอร์ต 3000 หรือกำหนดผ่าน PORT)
docker build -t lab11-test .   # สร้าง Docker image
docker run -p 3000:3000 lab11-test
```

## การทำงานของ Pipeline ตามกิจกรรมในห้องเรียน

| กิจกรรม | ไฟล์ | ทำงานเมื่อ | สิ่งที่ทำ |
|---|---|---|---|
| กิจกรรมที่ 1 (CI) | `.github/workflows/ci.yml` | เปิด Pull Request เข้า `main` | checkout → setup Node 20 → `npm ci` → `npm run lint` → `npm test` |
| กิจกรรมที่ 2 (Secrets) | — (ตั้งค่าบนเว็บ GitHub) | — | เพิ่ม `DOCKERHUB_USERNAME` และ `DOCKERHUB_TOKEN` ใน Settings → Secrets |
| กิจกรรมที่ 3 (CD) | `.github/workflows/cd.yml` | push/merge เข้า `main` | login Docker Hub → build image → push tag `latest` และ `<commit-sha>` |

รายละเอียดทีละขั้นตอน รวมถึงแบบฝึกหัด "แกล้งทำพัง" (break-the-build) ดูใน [DOCS_TH.md](DOCS_TH.md)
