# คู่มือ Workshop 11: CI/CD Pipelines with GitHub Actions (ฉบับละเอียด)

เอกสารนี้อธิบายทีละขั้นตอนสำหรับกิจกรรมทั้ง 3 ของ Workshop 11 รายวิชา 01204425

> **หมายเหตุสำคัญ:** ขั้นตอนการเปิด Pull Request, push โค้ด, และตั้งค่า Secrets ต้องทำ **บนเว็บ GitHub ด้วยมือ** ไม่สามารถทำอัตโนมัติจากเครื่อง local ได้ โปรเจกต์นี้เตรียมไฟล์ทุกอย่างให้พร้อมแล้ว เหลือแค่ push ขึ้น repo ของตนเองแล้วทำตามขั้นตอนด้านล่าง

---

## กิจกรรมที่ 1: Continuous Integration (CI)

ไฟล์: `.github/workflows/ci.yml`

### Pipeline ทำอะไรบ้าง (ทีละ step)

1. **Checkout Source Code** (`actions/checkout@v4`) — ดึงโค้ดจาก branch ของ PR ลงมาบน runner
2. **Setup Node.js Environment** (`actions/setup-node@v4`) — ติดตั้ง Node.js เวอร์ชัน 20 พร้อม cache `npm` ให้ `npm ci` เร็วขึ้น (โจทย์เดิมใช้ Node 18 เราปรับเป็น 20 LTS)
3. **Install Project Dependencies** (`npm ci`) — ติดตั้ง dependencies ตาม `package-lock.json` แบบเป๊ะ ๆ (เหมาะกับ CI เพราะได้ผลซ้ำได้ทุกครั้ง)
4. **Run Linter** (`npm run lint`) — รัน ESLint ตรวจคุณภาพโค้ด ถ้ามีตัวแปรไม่ได้ใช้หรือใช้ตัวแปรที่ไม่ได้ประกาศ → fail
5. **Run Unit Tests** (`npm test`) — รัน Jest ทดสอบ `voltageChecker` และ API endpoints ถ้า test ใดไม่ผ่าน → fail

ถ้าทุก step ผ่าน → PR แสดงเครื่องหมายถูกสีเขียว ✅ ถ้า step ใด fail → กากบาทสีแดง ❌ และ (ถ้าตั้ง branch protection) merge ไม่ได้

### วิธี trigger pipeline

1. push โค้ดขึ้น GitHub repo ของตนเอง (branch `main`)
2. สร้าง branch ใหม่ เช่น `git checkout -b feature/demo-ci`
3. แก้โค้ดเล็กน้อย แล้ว push branch นั้นขึ้นไป
4. บนเว็บ GitHub: กด **Compare & pull request** → base = `main` → กด **Create pull request**
5. GitHub Actions จะรัน `ci.yml` อัตโนมัติ

### วิธีอ่านผลลัพธ์

- ในหน้า PR จะมีกล่อง **Checks** แสดงสถานะ: วงกลมสีเหลือง (กำลังรัน) / ถูกเขียว (ผ่าน) / กากบาทแดง (fail)
- คลิก **Details** เพื่อดู log ของแต่ละ step ว่า fail ตรงไหน
- หรือไปที่แท็บ **Actions** ด้านบนของ repo เพื่อดู workflow run ทั้งหมด

### แบบฝึกหัด "แกล้งทำพัง" (Break the Build)

#### แบบที่ 1: ทำให้ Lint พัง

เพิ่มบรรทัดนี้ใน `app.js` (เช่น หลัง `const express = ...`):

```js
const hackTheSystem = 999;
```

commit + push แล้วเปิด PR → CI จะ fail ที่ step **Run Linter** พร้อม error ประมาณนี้:

```
error: 'hackTheSystem' is assigned a value but never used (no-unused-vars)
```

เพราะ `eslint.config.js` ตั้ง `'no-unused-vars': 'error'` ไว้ — ตัวแปรที่ประกาศแล้วไม่ใช้จะกลายเป็น lint error ทันที

#### แบบที่ 2: ทำให้ Test พัง

แก้ assertion ใน `utils/voltageChecker.test.js` เช่น เปลี่ยน:

```js
expect(checkVoltage(260)).toBe('CRITICAL');
```

เป็น:

```js
expect(checkVoltage(260)).toBe('NORMAL');
```

commit + push → CI จะ fail ที่ step **Run Unit Tests** และ Jest จะบอกว่า expected `'NORMAL'` but received `'CRITICAL'`

#### สังเกตผล

- PR จะขึ้น ❌ สีแดง และถ้า repo เปิด **branch protection rule** (Settings → Branches → require status checks) ปุ่ม **Merge** จะถูก block จนกว่า CI จะผ่าน — นี่คือหัวใจของ CI: โค้ดที่พังไม่มีทางหลุดเข้า `main`
- จากนั้นแก้โค้ดกลับให้ถูกต้อง push ซ้ำ → pipeline รันใหม่อัตโนมัติ → เขียว ✅ แล้ว merge ได้

---

## กิจกรรมที่ 2: ตั้งค่า GitHub Secrets (Docker Hub)

CD pipeline ต้อง login Docker Hub แต่ **ห้าม hardcode รหัสผ่านลงใน repo เด็ดขาด** จึงใช้ GitHub Secrets แทน

### ขั้นตอนที่ 1: สร้าง Access Token บน Docker Hub

1. login ที่ <https://hub.docker.com>
2. คลิกรูปโปรไฟล์มุมขวาบน → **Account Settings**
3. เมนูซ้ายเลือก **Security** → กด **New Access Token**
4. ตั้งชื่อ เช่น `github-actions-cicd` → เลือกสิทธิ์ **Read & Write** → กด **Generate**
5. **คัดลอก token ทันที** (จะดูได้ครั้งเดียว ปิดหน้าแล้วหาย)

### ขั้นตอนที่ 2: เพิ่ม Secrets ใน GitHub Repo

1. เปิด repo บน GitHub → แท็บ **Settings**
2. เมนูซ้าย: **Secrets and variables** → **Actions**
3. กด **New repository secret** สองครั้ง เพิ่มทีละตัว:

| Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | username Docker Hub ของคุณ (เช่น `somchai123`) |
| `DOCKERHUB_TOKEN` | access token ที่คัดลอกจากขั้นตอนที่ 1 |

4. กด **Add secret** แต่ละครั้ง

### ทำไมต้องใช้ Secrets?

- ถ้าเขียนรหัสผ่านลงใน `cd.yml` ตรง ๆ ใครก็ตามที่เห็น repo (รวมถึงคนแปลกหน้าถ้า repo public) จะเอาไป push image ทับหรือลบ image ของเราได้
- Secrets ถูกเข้ารหัสโดย GitHub — แม้แต่คนที่มีสิทธิ์เข้า repo ก็อ่านค่ากลับมาไม่ได้ (เขียนทับได้อย่างเดียว)
- workflow อ้างถึงผ่าน `${{ secrets.DOCKERHUB_TOKEN }}` และ GitHub จะ mask ค่านี้ใน log อัตโนมัติ ถ้าเผลอ print ออกมาจะแสดงเป็น `***`
- ถ้า token รั่ว สามารถ revoke บน Docker Hub แล้วสร้างใหม่ได้โดยไม่ต้องแก้โค้ดเลย

---

## กิจกรรมที่ 3: Continuous Deployment (CD)

ไฟล์: `.github/workflows/cd.yml`

### Pipeline ทำอะไรบ้าง

trigger เมื่อมี **push เข้า `main`** (รวมถึงการ merge PR):

1. **Checkout Source Code** — ดึงโค้ดล่าสุดของ `main`
2. **Log in to Docker Hub** (`docker/login-action@v3`) — login ด้วย secrets จากกิจกรรมที่ 2
3. **Build and Push Main API Image** (`docker/build-push-action@v5`) — build image จาก `./Dockerfile` แล้ว push ขึ้น Docker Hub พร้อม **2 tags**:
   - `<username>/iot-api:latest` — tag เสมอสำหรับเวอร์ชันล่าสุด
   - `<username>/iot-api:<commit-sha>` — tag ผูกกับ commit นั้น ๆ ทำให้ rollback หรือ deploy เวอร์ชันเฉพาะเจาะจงได้

### วิธี trigger

merge PR จากกิจกรรมที่ 1 (หรือ push ตรงเข้า `main`) → ไปที่แท็บ **Actions** จะเห็น workflow **IoT Backend CD Pipeline** กำลังรัน

### วิธีตรวจสอบผลบน Docker Hub

1. เปิด <https://hub.docker.com/repositories> แล้ว login
2. คลิกเข้า repository `<username>/iot-api` (ถ้า push สำเร็จ repo จะถูกสร้างอัตโนมัติ)
3. เปิดแท็บ **Tags** จะต้องเห็น 2 tags:
   - `latest`
   - `<commit-sha>` (ตัวอักษรยาว ๆ = SHA ของ commit ที่ trigger — ดูได้จากหน้า Actions run หรือ `git log`)
4. ทดลอง pull กลับมารัน (optional): `docker pull <username>/iot-api:latest` แล้ว `docker run -p 3000:3000 <username>/iot-api:latest`

---

## Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| CI fail ที่ `npm ci` | `package-lock.json` ไม่ sync กับ `package.json` หรือไม่ได้ commit lockfile | รัน `npm install` ที่ local แล้ว commit `package-lock.json` ใหม่ |
| CI fail ที่ lint: `no-undef` ในไฟล์ test | ลืม block jest globals ใน `eslint.config.js` | ตรวจว่ามี block `files: ['**/*.test.js']` พร้อม globals `describe/it/test/expect` |
| CI fail ที่ test | assertion ผิดหรือโค้ดเปลี่ยนพฤติกรรม | รัน `npm test` ที่ local ก่อน push ทุกครั้ง |
| CD fail ที่ **Log in to Docker Hub** | ชื่อ secret ไม่ตรง / token หมดอายุ / username ผิด | ตรวจ Settings → Secrets ว่ามี `DOCKERHUB_USERNAME` และ `DOCKERHUB_TOKEN` สะกดตรงกับใน `cd.yml` เป๊ะ ๆ |
| CD fail ที่ build-push: `denied` | token ไม่มีสิทธิ์ Read & Write | สร้าง access token ใหม่บน Docker Hub พร้อมสิทธิ์ Read & Write แล้วอัปเดต secret |
| ไม่เห็น repository บน Docker Hub | push ยังไม่สำเร็จ | เปิด log ของ step **Build and Push** ใน Actions ดู error |
| `docker build` ช้าหรือ cache ไม่ทำงาน | ลืม `.dockerignore` | ตรวจว่ามี `.dockerignore` ที่ไม่รวม `node_modules` (build context จะเล็กและเร็วขึ้นมาก) |
| pipeline ไม่รันเลย | workflow file อยู่ผิด path / YAML ผิด format | ไฟล์ต้องอยู่ที่ `.github/workflows/*.yml` เป๊ะ ๆ และ YAML ต้อง parse ผ่าน |

---

## สรุปสิ่งที่ได้จาก Workshop นี้

- เข้าใจความแตกต่างของ CI (ตรวจสอบโค้ดอัตโนมัติทุก PR) และ CD (ส่งมอบ artifact อัตโนมัติเมื่อ merge)
- ใช้ ESLint + Jest เป็น quality gate ที่ block โค้ดพังไม่ให้เข้า `main`
- จัดการ credential อย่างปลอดภัยด้วย GitHub Secrets
- Build และ push Docker image อัตโนมัติพร้อม tag ทั้ง `latest` และ commit SHA เพื่อรองรับ rollback
