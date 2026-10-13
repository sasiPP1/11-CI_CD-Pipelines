# คู่มือ Deploy เซิร์ฟเวอร์จริง — Workshop 12 (To the Cloud!)

คู่มือนี้ครอบคลุม **กิจกรรมที่ 2 (Server Provisioning & Secrets)** และ **กิจกรรมที่ 3 (Final CD Pipeline)**
โดยใช้เซิร์ฟเวอร์ที่มีอยู่แล้วของนิสิต/ทีม ไม่ต้องสร้างผ่าน Terraform

> สมมติฐาน: นิสิต commit + push เข้า `main` แล้ว pipeline จะ build image ไป Docker Hub แล้ว SSH เข้ามาดึง image
> มารันบนเซิร์ฟเวอร์ให้อัตโนมัติ ดังนั้น **เซิร์ฟเวอร์ต้องเปิดพอร์ต 3000 ออกสู่ public**

---

## กิจกรรมที่ 2: เตรียมเซิร์ฟเวอร์และกุญแจ

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

ถ้าขึ้น `healthy` และ curl ได้ `{"status":"ok"}` แปลว่าเซิร์ฟเวอร์พร้อม

### 2.5 เปิดพอร์ต 3000 ออกสู่ public

```bash
sudo ufw allow 3000/tcp
sudo ufw status
curl http://<SERVER_IP>:3000/api/health     # ทดสอบจากเครื่องหลัก
```

### 2.6 สร้าง SSH Key Pair

บน**เครื่องหลัก** (ไม่ใช่เซิร์ฟเวอร์):

```bash
ssh-keygen -t ed25519 -C "github-actions-iot-api" -f ~/.ssh/iot_api_gh
```

> **ห้ามตั้ง passphrase** (`Enter passphrase (empty for no passphrase):` → กด Enter เปล่าๆ)
> GitHub Actions ใส่คีย์ผ่านทาง secret ที่ไม่มีช่องให้พิมพ์ passphrase ถ้าตั้งไว้ job จะ fail

ได้ไฟล์ 2 ไฟล์:
- `~/.ssh/iot_api_gh` — **private key** → เอาไปใส่ GitHub Secret
- `~/.ssh/iot_api_gh.pub` — **public key** → เอาไปใส่เซิร์ฟเวอร์

### 2.7 ใส่ public key บนเซิร์ฟเวอร์

```bash
ssh-copy-id -i ~/.ssh/iot_api_gh.pub <user>@<SERVER_IP>
# หรือทำเอง:
cat ~/.ssh/iot_api_gh.pub | ssh <user>@<SERVER_IP> 'cat >> ~/.ssh/authorized_keys'
```

ทดสอบว่าใช้คีย์ได้จริง (ต้องไม่ถาม password):

```bash
ssh -i ~/.ssh/iot_api_gh <user>@<SERVER_IP> 'echo SSH-KEY-OK'
```

### 2.8 ตั้งค่า GitHub Secrets

ไปที่ repo → **Settings → Secrets and variables → Actions → New repository secret**

#### Secrets (ค่าลับ — กรอกในตารางนี้)

| ชื่อ Secret | ค่าที่ใส่ | วิธีหาค่า |
|---|---|---|
| `DOCKERHUB_USERNAME` | ชื่อ Docker Hub ของทีม | ตัวเดียวกับ `DOCKERHUB_USERNAME` ใน `.env` บนเซิร์ฟเวอร์ |
| `DOCKERHUB_TOKEN` | Access Token จาก Docker Hub | Docker Hub → Account Settings → Personal access tokens → Read only |
| `SSH_PRIVATE_KEY` | **เนื้อหาไฟล์ private key ทั้งไฟล์** | `cat ~/.ssh/iot_api_gh` แล้ว copy ทั้งบรรทัดตั้งแต่ `-----BEGIN OPENSSH PRIVATE KEY-----` ถึง `-----END OPENSSH PRIVATE KEY-----` |
| `SERVER_HOST` | Public IP ของเซิร์ฟเวอร์ | `curl ifconfig.me` หรือดูจาก panel ของผู้ให้บริการ |
| `SERVER_USER` | ชื่อ user ที่ใช้ SSH เข้าได้ | เช่น `ubuntu` |

#### Variables (ค่าสาธารณะ — ไม่ลับ, ตั้งแท็บ Variables)

| ชื่อ Variable | ค่า | หมายเหตุ |
|---|---|---|
| `DEPLOY_PATH` | `/opt/iot-api` | โฟลเดอร์ที่วาง `docker-compose.yml` ไว้ ต้องตรงกับข้อ 2.3 |

> **แยก Secrets กับ Variables อย่างชัดเจน**
> - **Secrets** = ข้อมูลลับ (private key, token) → GitHub จะไม่แสดงค่าให้ใครเห็น
> - **Variables** = ค่าที่ไม่ลับ (IP, path) → เห็นได้ตามปกติ และใช้ใน `secrets.` ก็ได้แต่ไม่แนะนำ
> - ถ้าตั้ง path ผิดโฟลเดอร์ workflow จะ error ว่า `No such file or directory`

---

## กิจกรรมที่ 3: Final CD Pipeline

Pipeline ทำงาน 3 ขั้น:

```
push เข้า main
   ├─ ci.yml       →  npm run lint + npm test          (ต้องผ่านก่อน)
   └─ cd.yml
        ├─ build-and-push  →  docker login → build → push <user>/iot-api:latest
        └─ deploy-to-server (needs: build-and-push)
              └─ SSH เข้าเซิร์ฟเวอร์ → docker compose pull → up -d → รอ healthcheck
```

### 3.1 เปลี่ยน API เล็กน้อย (The Moment of Truth)

แก้ `app.js`:

```js
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hello Sakon Nakhon Cloud!' });
});
```

> อย่าลืมแก้ test ใน `app.test.js` ให้ตรงกัน มิฉะนั้น CI จะ fail ตรงนี้ (ซึ่งเป็นเรื่องปกติ — ให้นิสิตเข้าใจว่าต้องแก้ test คู่กัน)

### 3.2 Commit แล้วดูผล

```bash
git add .
git commit -m "feat: greet Sakon Nakhon from the cloud"
git push origin main
```

เปิดแท็บ **Actions** รอให้เขียวทั้งหมด แล้วทดสอบจากเครื่องหลัก:

```bash
curl http://<SERVER_IP>:3000/api/health
```

ถ้าได้ `"message": "Hello Sakon Nakhon Cloud!"` → **CI/CD ทำงานสมบูรณ์ 100%**

---

## Troubleshooting

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `required variable DOCKERHUB_USERNAME is missing a value` | เซิร์ฟเวอร์ไม่มีไฟล์ `.env` หรือค่าว่าง | `cd /opt/iot-api && cp .env.example .env` แล้วแก้ค่า |
| `No such file or directory` ตอน `cd $DEPLOY_PATH` | Variable `DEPLOY_PATH` ไม่ตรงกับโฟลเดอร์จริง | ตรวจ `Settings → ... → Actions → Variables` |
| `Permission denied (publickey)` | public key ไม่ได้อยู่ใน `authorized_keys` ของเซิร์ฟเวอร์ | ทำข้อ 2.7 ใหม่ |
| `Load key ... incorrect passphrase supplied` | private key มี passphrase | สร้างคีย์ใหม่แบบไม่ตั้ง passphrase (ข้อ 2.6) |
| `docker: permission denied` | user ไม่ได้อยู่ในกลุ่ม `docker` | `sudo usermod -aG docker $USER` แล้ว reconnect |
| Job เขียว แต่ `curl` ต่อไม่ได้ | firewall ยังไม่เปิด 3000 | `sudo ufw allow 3000/tcp` |
| Container ขึ้น `unhealthy` หรือ `Restarting` | ดู log: `cd /opt/iot-api && docker compose logs --tail 100` | มักเป็น port ชนกับ service เดิม หรือ image ยังไม่ถูก push |

### ดู log ของ pipeline เอง

ในหน้า Actions คลิกเข้า job `deploy-to-server` → ดูหัวข้อ **Deploy via SSH** จะเห็นผลลัพธ์ของแต่ละคำสั่งที่รันบนเซิร์ฟเวอร์แบบสด ๆ

---

## สรุปไฟล์ที่ต้องมีบนเซิร์ฟเวอร์

```
/opt/iot-api/
├── docker-compose.yml     ← จาก repo
└── .env                   ← สร้างเอง ไม่ต้อง commit (DOCKERHUB_USERNAME, HOST_PORT)
```

ถ้ามีไฟล์อื่นในโฟลเดอร์นี้ **ไม่ต้องลบ** แต่ถ้ามี `.env` ที่ค่าไม่ตรงกับ Docker Hub ที่ใช้จริง
ระบบจะ pull image ผิดตัวแล้วได้ `manifest unknown` — ให้ตรวจ `cat /opt/iot-api/.env` ก่อน deploy