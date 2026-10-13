# คู่มือ Deploy เซิร์ฟเวอร์จริง — Workshop 12 (To the Cloud!)

คู่มือนี้ครอบคลุม **กิจกรรมที่ 2 (Server Provisioning)** และ **กิจกรรมที่ 3 (Final CD Pipeline)**
โดยใช้เซิร์ฟเวอร์ที่มีอยู่แล้วของนิสิต/ทีม ไม่ต้องสร้างผ่าน Terraform

## เครื่องนี้ไม่มี public IP — ใช้วิธีนี้แทน

ถ้าเซิร์ฟเวอร์อยู่หลัง NAT (ไม่มี public IP) GitHub Actions **ต่อ SSH เข้ามาไม่ได้**
เพราะการ deploy แบบเดิมต้องให้เครื่อง runner ของ GitHub เปิดออกไปหาเครื่องคุณเอง

วิธีที่ใช้คือ **self-hosted runner** — ติดตั้ง GitHub Actions runner ไว้บนเซิร์ฟเวอร์ของคุณ
แล้วให้มัน **โพลศึกษา GitHub ออกทางอินเทอร์เน็ต (ขาออก)** ซึ่งทำได้แม้ไม่มี IP สาธารณะ

ข้อดีที่ได้ตามมา:
- ไม่ต้องมี public IP และไม่ต้องเปิดพอร์ต 22 หรือ 3000 ออกสู่ภายนอก
- ไม่ต้องทำ SSH key pair ไม่ต้องแก้ `authorized_keys`
- ไม่ต้องใส่ GitHub Secret ฝั่งเซิร์ฟเวอร์เลย (เหลือแค่ 2 ตัวของ Docker Hub)
- สคริปต์ deploy ทำงานบนเครื่องเป้าหมายโดยตรง เร็วกว่า และดีบักได้ง่ายกว่า

```
push เข้า main
   ├─ ci.yml  (ubuntu-latest)             →  npm run lint + npm test
   └─ cd.yml
        ├─ build-and-push     (ubuntu-latest)               → build + push image ไป Docker Hub
        └─ deploy-to-server   ([self-hosted, linux, deploy]) → รันบนเซิร์ฟเวอร์จริง
              → docker compose pull → up -d → รอ healthcheck
```

---

## กิจกรรมที่ 2: เตรียมเซิร์ฟเวอร์และลงทะเบียน Runner

### 2.1 SSH เข้าเซิร์ฟเวอร์

```bash
ssh <user>@<SERVER_IP>
```

### 2.2 ติดตั้ง Docker + Docker Compose

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker            # ออกจาก session เดิมแล้วเข้าใหม่ เพื่อให้ group มีผล
docker --version && docker compose version
```

> สำคัญ: ต้องเป็น `docker compose` (ไม่มีขีดกลาง) คือ Compose **v2 plugin**
> ถ้า `docker compose` ใช้ไม่ได้ แต่ `docker-compose` ใช้ได้ แปลว่าเป็น v1 ต้องติดตั้ง v2 ใหม่ เพราะ workflow เรียก `docker compose`

### 2.3 วางไฟล์ Compose บนเซิร์ฟเวอร์

```bash
sudo mkdir -p /opt/iot-api && cd /opt/iot-api
# อัปโหลดจากเครื่องหลัก
scp docker-compose.yml <user>@<SERVER_IP>:/opt/iot-api/
scp .env.example        <user>@<SERVER_IP>:/opt/iot-api/
```

แก้ `.env` ให้เป็น Docker Hub namespace ของทีม:

```bash
cp .env.example .env
nano .env               # แก้ DOCKERHUB_USERNAME=<ชื่อ dockerhub ของทีม>
```

### 2.4 ทดสอบรันด้วยมือ (ก่อนต่อ GitHub Actions)

```bash
docker login                       # ใส่ Docker Hub username + access token
cd /opt/iot-api
docker compose pull
docker compose up -d
docker compose ps                  # ต้องขึ้นว่า healthy
curl http://127.0.0.1:3000/api/health
```

> ทดสอบด้วย `127.0.0.1` เพราะไม่มี public IP — ถ้าต้องการยิงจากภายนอกจริง
> ให้ใช้ Cloudflare Tunnel หรือ VPN ของมหาวิทยาลัย (ดูหัวข้อท้ายไฟล์)

### 2.5 ติดตั้ง GitHub Actions Runner

ไปที่ **Settings → Actions → Runners → New self-hosted runner**
เลือก **Linux** แล้วกดคัดลอกคำสั่งที่ GitHub ให้มา

> **Runner token มีอายุ 1 ชั่วโมง** ถ้าหมดอายุต้องกดสร้างใหม่ที่หน้าเว็บ

บนเซิร์ฟเวอร์:

```bash
mkdir -p /opt/actions-runner && cd /opt/actions-runner

# เวอร์ชันปัจจุบัน v2.338.0 — ถ้ามีเวอร์ชันใหม่กว่าให้ดูหน้า releases ของ actions/runner
RUNNER_VER=2.338.0
curl -sSL -o actions-runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VER}/actions-runner-linux-x64-${RUNNER_VER}.tar.gz"
tar xzf actions-runner.tar.gz && rm actions-runner.tar.gz
```

ลงทะเบียนกับ repo (วาง token ที่ได้จากหน้าเว็บ):

```bash
./config.sh \
  --url https://github.com/<ORG>/<REPO> \
  --token <RUNNER_TOKEN> \
  --labels deploy \
  --unattended
```

> `--labels deploy` คือเพิ่มป้ายกำกับชื่อ `deploy` เพิ่มจาก `self-hosted`, `linux`, `x64` ที่มีอยู่แล้ว
> ต้องตรงกับ `runs-on: [self-hosted, linux, deploy]` ใน `cd.yml` ไม่งั้น job จะค้างรอ runner ไม่มีวันเสร็จ

### 2.6 สั่งให้ runner ทำงาน

ทดสอบก่อนแบบ foreground:

```bash
cd /opt/actions-runner
./run.sh
```

ถ้าขึ้น `Listening for Jobs` แปลว่าสำเร็จ ให้กด `Ctrl+C` แล้วติดตั้งเป็น service (เปิดเครื่องใหม่แล้วยังทำงาน):

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

> ถ้า `svc.sh install` ไม่ได้ ให้รัน runner ใน `tmux` แทน: `tmux new -s runner '/opt/actions-runner/run.sh'`
> ต้องรันด้วย user ที่อยู่ในกลุ่ม `docker` แล้วเท่านั้น ไม่งั้น `docker compose` ใน job จะได้ permission denied

### 2.7 ตั้งค่า GitHub Secrets

เหลือแค่ 2 ตัว (ของ Docker Hub) ไปที่ **Settings → Secrets and variables → Actions → New repository secret**

| ชื่อ Secret | ค่าที่ใส่ | วิธีหาค่า |
|---|---|---|
| `DOCKERHUB_USERNAME` | ชื่อ Docker Hub ของทีม | ตัวเดียวกับ `DOCKERHUB_USERNAME` ใน `.env` บนเซิร์ฟเวอร์ |
| `DOCKERHUB_TOKEN` | Access Token จาก Docker Hub | Docker Hub → Account Settings → Personal access tokens → Read only |

#### Variables (ทางเลือก)

| ชื่อ Variable | ค่า | หมายเหตุ |
|---|---|---|
| `DEPLOY_PATH` | `/opt/iot-api` | โฟลเดอร์ที่วาง `docker-compose.yml` ไว้ **ถ้าไม่ตั้งจะใช้ค่า default นี้อยู่แล้ว** |

> ไม่ต้องตั้ง Secrets ฝั่งเซิร์ฟเวอร์อีกแล้ว เพราะ job รันบนเครื่องนั้นเลย
> ถ้าตั้ง `DEPLOY_PATH` ผิดโฟลเดอร์ workflow จะ error ว่า `No such file or directory`

---

## กิจกรรมที่ 3: Final CD Pipeline

### 3.1 เปลี่ยน API เล็กน้อย (The Moment of Truth)

แก้ `app.js`:

```js
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hello Sakon Nakhon Cloud!' });
});
```

> อย่าลืมแก้ test ใน `app.test.js` ให้ตรงกัน มิฉะนั้น CI จะ fail ตรงนี้
> (ซึ่งเป็นเรื่องปกติ — ให้นิสิตเข้าใจว่าต้องแก้ test คู่กัน)

### 3.2 Commit แล้วดูผล

```bash
git add .
git commit -m "feat: greet Sakon Nakhon from the cloud"
git push origin feature/<ชื่อ branch>
```

เปิดแท็บ **Actions** รอให้เขียวทั้งหมด แล้วทดสอบบนเซิร์ฟเวอร์:

```bash
curl http://127.0.0.1:3000/api/health
```

ถ้าได้ `"message": "Hello Sakon Nakhon Cloud!"` → **CI/CD ทำงานสมบูรณ 100%**

---

## Troubleshooting

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| Job ค้างสถานะ "Waiting for a runner" ไม่เขียนสักที | ยังไม่มี runner ออนไลน์ หรือ label ไม่ตรง | `sudo /opt/actions-runner/svc.sh status` แล้วเช็กว่า label `deploy` ตรงกับใน `cd.yml` |
| `required variable DOCKERHUB_USERNAME is missing a value` | เซิร์ฟเวอร์ไม่มีไฟล์ `.env` หรือค่าว่าง | `cd /opt/iot-api && cp .env.example .env` แล้วแก้ค่า |
| `manifest unknown` ตอน pull | `.env` ชี้ Docker Hub ผิดตัว หรือ image ยังไม่ถูก push | `cat /opt/iot-api/.env` แล้วเทียบกับชื่อที่ push ใน log ของ job ก่อนหน้า |
| `No such file or directory` ตอน `cd $DEPLOY_PATH` | Variable `DEPLOY_PATH` ไม่ตรงกับโฟลเดอร์จริง | ตรวจ `Settings → ... → Actions → Variables` |
| `docker: permission denied` ใน job | user ที่รัน runner ไม่ได้อยู่ในกลุ่ม `docker` | `sudo usermod -aG docker $USER` แล้วรีสตาร์ท runner |
| `The runner has received a shutdown signal` | runner ถูกปิด หรือเครื่อง reboot | `sudo /opt/actions-runner/svc.sh start` |
| Container ขึ้น `unhealthy` หรือ `Restarting` | job จะ fail พร้อม dump log ให้อยู่แล้ว | ดู log ที่แนบมา หรือ `cd /opt/iot-api && docker compose logs --tail 100` |
| Runner ขึ้น `Unable to configure the runner` | token หมดอายุ (อายุ 1 ชั่วโมง) | สร้าง runner token ใหม่ที่ Settings → Actions → Runners แล้วรัน `./config.sh` ใหม่ |

### ดู log ของ pipeline เอง

ในหน้า Actions คลิกเข้า job `Deploy to Target Server` → step **Deploy and wait for health**
จะเห็นผลลัพธ์ของแต่ละคำสั่งที่รันบนเซิร์ฟเวอร์แบบสด ๆ รวมถึงสถานะ healthcheck ทีละครั้ง

---

## สรุปไฟล์ที่ต้องมีบนเซิร์ฟเวอร์

```
/opt/iot-api/
├── docker-compose.yml     ← จาก repo
└── .env                   ← สร้างเอง ไม่ต้อง commit (DOCKERHUB_USERNAME, HOST_PORT)

/opt/actions-runner/       ← GitHub Actions runner (ลงทะเบียนไว้ อย่าลบ)
```

---

## ถ้าอยากให้ Pi Pico ยิงเข้ามาได้จริง (ยังไม่มี public IP)

ตัว API จะรับอยู่บนเซิร์ฟเวอร์อยู่ดี แต่ขาดทางเข้าจากภายนอก 3 ทางเลือก:

1. **Cloudflare Tunnel** — เปิด `api.example.com` ให้ยิงจากที่ไหนก็ได้ โดยไม่ต้องเปิดพอร์ต 3000
   (ระวัง: Cloudflare บังคับ HTTPS อัตโนมัติ ESP32 ต้องต่อ TLS ได้)
2. **VPN ของมหาวิทยาลัย** — ถ้าเครื่องนั้นต่อ VPN ของมหาวิทยาลัยอยู่ ให้ใช้ IP ภายในนั้นยิงได้เลย
3. **Port forwarding บน router** — ถ้าคุณคุมเราเตอร์เอง ให้ทำ DNAT พอร์ต 3000 → เครื่องนี้

ไฟล์ `docker-compose.yml` เปิดพอร์ตไว้อยู่แล้ว (`HOST_PORT:3000`) ทั้งสามทางใช้ไฟล์เดิมได้ ไม่ต้องแก้อะไรเพิ่ม
