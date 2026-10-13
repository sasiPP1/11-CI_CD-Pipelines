# Lab 11: CI/CD Pipelines with GitHub Actions (01204425)

โปรเจกต์ IoT Backend ตัวอย่างสำหรับ Workshop 11 — สาธิตการทำ CI/CD Pipeline ด้วย GitHub Actions, ESLint, Jest และ Docker

## ภาพรวม

Backend API อย่างง่ายสำหรับรับค่า telemetry จากอุปกรณ์ IoT (เช่น ESP32) โดยไม่ต้องใช้ฐานข้อมูลจริง:

- `GET /api/health` — ตรวจสอบสถานะเซิร์ฟเวอร์ ตอบกลับ `{ "status": "ok", "message": "Hello Sakon Nakhon Cloud!" }`
- `POST /api/telemetry` — รับ `{ device_id, voltage, current? }` ตรวจสอบข้อมูล แล้วจัดประเภทแรงดันไฟฟ้าเป็น `LOW` / `NORMAL` / `CRITICAL` ด้วย `utils/voltageChecker.js`

## เทคโนโลยีที่ใช้

| ส่วน | เครื่องมือ |
|---|---|
| Runtime | Node.js 20 LTS (CommonJS) |
| Web framework | Express |
| Linter | ESLint 9 (flat config) |
| Test | Jest + Supertest |
| CI | GitHub Actions (lint + test เมื่อเปิด PR และเมื่อ push เข้า `main`) |
| CD | GitHub Actions (build + push Docker image ไป Docker Hub) |
| Deploy | GitHub Actions + `appleboy/ssh-action` (SSH ดึง image มารันบนเซิร์ฟเวอร์จริง) |
| Container | Docker (node:20-alpine) ผ่าน `docker-compose.yml` |

## โครงสร้างไฟล์

```
Lab11/
├── package.json
├── package-lock.json
├── eslint.config.js          # ESLint 9 flat config (CommonJS)
├── app.js                    # Express app + createApp() factory
├── app.test.js               # API tests (supertest)
├── Dockerfile
├── docker-compose.yml         # runtime บนเซิร์ฟเวอร์จริง (pull image จาก Docker Hub)
├── .env.example               # ต้นแบบ .env สำหรับ compose (ตัว .env ถูก gitignore)
├── .dockerignore
├── .gitignore
├── README.md                 # ไฟล์นี้
├── DEPLOY_TH.md              # คู่มือ deploy ถึงเซิร์ฟเวอร์จริง (Workshop 12)
├── utils/
│   ├── voltageChecker.js     # ตรรกะจัดประเภทแรงดันไฟฟ้า (pure function)
│   └── voltageChecker.test.js
└── .github/
    └── workflows/
        ├── ci.yml            # CI: lint + test เมื่อเปิด PR และเมื่อ push เข้า main
        └── cd.yml            # CD: build + push image แล้ว SSH ไป deploy บนเซิร์ฟเวอร์
```

## วิธีรัน

```bash
npm install        # ติดตั้ง dependencies
npm run lint       # ตรวจคุณภาพโค้ดด้วย ESLint
npm test           # รัน unit tests ด้วย Jest
npm start          # รันเซิร์ฟเวอร์ (พอร์ต 3000 หรือกำหนดผ่าน PORT)
docker build -t lab11-test .   # สร้าง Docker image
docker run -p 3000:3000 lab11-test

# รันเหมือนบนเซิร์ฟเวอร์จริง (ต้องมี .env ซึ่งทำจาก .env.example)
docker compose up -d && docker compose ps
```

## การทำงานของ Pipeline ตามกิจกรรมในห้องเรียน

| กิจกรรม | ไฟล์ | ทำงานเมื่อ | สิ่งที่ทำ |
|---|---|---|---|
| W11 กิจกรรมที่ 1 (CI) | `.github/workflows/ci.yml` | เปิด Pull Request เข้า `main` | checkout → setup Node 20 → `npm ci` → `npm run lint` → `npm test` |
| W11 กิจกรรมที่ 2 (Secrets) | — (ตั้งค่าบนเว็บ GitHub) | — | เพิ่ม `DOCKERHUB_USERNAME` และ `DOCKERHUB_TOKEN` ใน Settings → Secrets |
| W11 กิจกรรมที่ 3 (Build & Push) | `.github/workflows/cd.yml` | push/merge เข้า `main` | login Docker Hub → build image → push tag `latest` และ `<commit-sha>` |
| W12 กิจกรรมที่ 2 (Provisioning) | `docker-compose.yml` + `DEPLOY_TH.md` | เตรียมเซิร์ฟเวอร์ด้วยมือ | ติดตั้ง Docker → วาง compose + `.env` → เปิดพอร์ต 3000 → สร้าง SSH key → ใส่ GitHub Secrets |
| W12 กิจกรรมที่ 3 (Deploy) | `.github/workflows/cd.yml` | หลัง `build-and-push` สำเร็จ | SSH เข้าเซิร์ฟเวอร์ → `docker compose pull` → `up -d` → รอ healthcheck เป็น `healthy` (ถ้าไม่ healthy job จะ fail พร้อม log) |

คู่มือตั้งค่าเซิร์ฟเวอร์และ GitHub Secrets ทีละขั้นตอน ดูใน [DEPLOY_TH.md](DEPLOY_TH.md)
