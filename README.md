# 🚀 ReachInbox Full-Stack Email Job Scheduler & Dashboard

A production-grade, distributed cold email scheduling service and modern dashboard built for **ReachInbox.ai (Outbox Labs)**.

Designed to reliably schedule, throttle, rate-limit, and deliver outreach emails at scale using **BullMQ + Redis** as a persistent job queue (**no cron jobs**), **PostgreSQL + Prisma ORM**, **Elasticsearch** for search indexing, **Ethereal Email** for fake SMTP testing with live preview links, and a **Tailwind CSS React dashboard** matching the ReachInbox Figma specification.

---

## 🏛️ Architecture Overview

```mermaid
flowchart TD
    subgraph Frontend["Frontend Dashboard (React 19 + Vite + Tailwind CSS)"]
        UI["ReachInbox Dashboard UI"]
        Compose["CSV Lead Upload & Compose Modal"]
        Search["Elasticsearch Full-Text Search Bar"]
        SlackPill["Slack OAuth / Webhook Integration"]
    end

    subgraph Backend["Express.js + TypeScript Service (Port 5000)"]
        API["REST APIs (/api/emails, /api/auth, /api/slack)"]
        Reconciler["Startup Persistence & Recovery Reconciler"]
        RateLimiter["Redis Atomic Hourly Rate Limiter"]
        SlackService["Slack Live Alert Dispatcher"]
        BullBoard["BullMQ Live Queue Dashboard (/admin/queues)"]
    end

    subgraph Infra["Persistence & Storage Layer (Docker)"]
        Postgres[("PostgreSQL 16\n(Prisma ORM Single-Source-of-Truth)")]
        RedisDB[("Redis 7\n(BullMQ ZSET Delayed Jobs & Rate Counters)")]
        Elastic[("Elasticsearch 7.17\n(reachinbox_emails Index)")]
    end

    subgraph Workers["BullMQ Worker (Configurable Concurrency)"]
        Worker["Concurrent Email Worker (concurrency=5)"]
        Throttler["Provider Throttling Delay (min 2000ms)"]
        SMTP["Nodemailer + Ethereal SMTP"]
    end

    UI --> API
    API --> Postgres
    API --> RedisDB
    API --> Elastic
    Worker --> RedisDB
    Worker --> RateLimiter
    Worker --> Throttler
    Worker --> SMTP
    RateLimiter -- "Limit Exceeded" --> SlackService
    SlackService -- "Live Alert" --> SlackChannel["Slack Channel (#email-alerts)"]
    Reconciler -- "On Boot" --> Postgres
    Reconciler -- "Ensure Jobs" --> RedisDB
```

---

## 🌟 Key Features

| Requirement | Implementation Details |
| :--- | :--- |
| **No Cron Jobs** | BullMQ delayed jobs backed by Redis sorted sets (`zset` by unix epoch). No `node-cron`, `cron`, or `agenda`. |
| **Restart Persistence** | Jobs persist in Redis. Startup `reconciler.service.ts` verifies DB vs Queue, recovering any stuck `PROCESSING` jobs without duplication. |
| **Worker Concurrency** | Configurable via `WORKER_CONCURRENCY=5` env variable. Safe parallel multi-worker execution with atomic DB locking. |
| **Provider Throttling Delay** | Configurable minimum delay (default `2000ms` / 2 seconds) between individual sends to prevent provider spam flags. |
| **Hourly Rate Limiting** | Configurable `MAX_EMAILS_PER_HOUR_PER_SENDER=50`. Multi-sender atomic Redis counters (`ratelimit:{sender}:{hour}`). **Jobs are never dropped**: automatically rescheduled into next hour window. |
| **Slack Live Alert on Rate Limit** | Real OAuth flow + direct Webhook URL support. Sends live formatted Block Kit notification the moment an hourly limit is hit. Disconnect/reconnect handled cleanly without redeploy. |
| **Search via Elasticsearch** | Emails indexed in `reachinbox_emails` index. Multi-match search across recipient, sender, subject, and body with resilient DB fallback. |
| **Live BullMQ Dashboard** | Bull Board mounted at `http://localhost:5000/admin/queues` with real-time inspection of active, delayed, waiting, and completed jobs. |
| **Fake SMTP (Ethereal Email)** | Zero-configuration auto-generated Ethereal test accounts. Sent emails store live preview URLs (`https://ethereal.email/message/...`) clickable directly from the UI. |
| **Google Login & Demo Mode** | Real Google OAuth + One-Click Demo Login (`Alex Mercer`) for frictionless evaluator walkthroughs. |
| **ReachInbox Dashboard** | Sleek dark UI matching Figma: CSV drag-and-drop lead parser with detected count badges, scheduled/sent tables, and real-time polling. |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, TypeScript, BullMQ, ioredis, Prisma ORM, Nodemailer, Elasticsearch JS Client, Bull Board
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Axios
- **Database & Storage**: PostgreSQL 16, Redis 7, Elasticsearch 7.17 (Docker Compose)
- **SMTP**: Ethereal Email (Nodemailer fake SMTP)

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm

---

### Step 1: Start Infrastructure (Docker Compose)

From the project root (`E:\ReachInbox`), start PostgreSQL, Redis, and Elasticsearch in one command:

```powershell
docker compose up -d
```

Verify containers are running:
```powershell
docker ps
```
You should see:
- `reachinbox_postgres` on port `5432`
- `reachinbox_redis` on port `6379`
- `reachinbox_elasticsearch` on port `9200`

---

### Step 2: Configure & Start Backend

1. Navigate to `backend`:
   ```powershell
   cd E:\ReachInbox\backend
   ```

2. Review `.env` (pre-configured for local docker):
   ```env
   PORT=5000
   DATABASE_URL="postgresql://reachinbox:reachinboxpassword@127.0.0.1:5432/reachinbox_db?schema=public"
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   ELASTICSEARCH_NODE=http://127.0.0.1:9200
   JWT_SECRET=super-secret-reachinbox-jwt-key-2026
   WORKER_CONCURRENCY=5
   MIN_DELAY_BETWEEN_EMAILS_MS=2000
   MAX_EMAILS_PER_HOUR=200
   MAX_EMAILS_PER_HOUR_PER_SENDER=50
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   SLACK_REDIRECT_URI=http://127.0.0.1:5000/api/slack/oauth/callback
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   FRONTEND_URL=http://localhost:5173
   ```

3. Sync database schema (Prisma):
   ```powershell
   npx prisma db push
   ```

4. Build and run backend server:
   ```powershell
   npm run build
   node dist/server.js
   ```
   *(Or for hot-reload development: `npm run dev`)*

Backend will start at: `http://localhost:5000`  
Live BullMQ Dashboard: `http://localhost:5000/admin/queues`

---

### Step 3: Start Frontend

1. Open a new terminal and navigate to `frontend`:
   ```powershell
   cd E:\ReachInbox\frontend
   ```

2. Start the Vite dev server:
   ```powershell
   npm run dev
   ```

Frontend will open at: `http://localhost:5173`

---

## 🎯 How Core Requirements Are Implemented

### 1. Delay & Scheduling without Cron
- Delayed scheduling uses **BullMQ delayed jobs**:
  $$\text{delay} = \max(0, \text{scheduledAt} - \text{Date.now()})$$
- Added to queue: `emailQueue.add('send-email', data, { jobId: email.id, delay })`
- Backed strictly by Redis sorted sets (score = epoch timestamp). No cron libraries or polling loops used.

### 2. Restart Persistence & Idempotency
- When an email is scheduled, its state is written to PostgreSQL as `SCHEDULED` and to Redis as a delayed job with deterministic `jobId: email.id`.
- On server crash/restart, `reconciler.service.ts` runs automatically during bootstrap:
  1. Finds any jobs stuck in `PROCESSING` and resets them to `SCHEDULED`.
  2. Scans pending DB jobs and ensures they are active in the BullMQ queue.
  3. Already `SENT` or `CANCELLED` emails are never re-enqueued.
- When workers execute a job, an atomic database condition prevents double execution across parallel worker instances:
  ```ts
  const updated = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMITED'] } },
    data: { status: 'PROCESSING' }
  });
  if (updated.count === 0) return; // Already processed
  ```

### 3. Throughput, Rate Limiting & Concurrency
- **Worker Concurrency**: Worker initialized with `concurrency: config.WORKER_CONCURRENCY` (default: 5 parallel jobs).
- **Delay Between Sends**: Built-in minimum throttle delay `MIN_DELAY_BETWEEN_EMAILS_MS` (default: 2000ms / 2 seconds) applied before/after SMTP dispatch to mimic provider warming and avoid throttling penalties.
- **Hourly Rate Limiter**:
  - Key format: `ratelimit:{senderEmail}:{YYYY-MM-DD-HH}`
  - Atomic Redis `INCR` + 2-hour TTL expiration.
  - When `currentCount > limit`:
    - Counter rolled back: `await redis.decr(key)`.
    - Next hour window calculated: $(60 - \text{minutes}) \times 60 \times 1000 + 5000\text{ ms}$.
    - Job is **not dropped**: status updated to `DELAYED_RATE_LIMITED` and re-enqueued into BullMQ for the next hour window.
    - Live Slack rate limit alert is dispatched immediately.

### 4. Slack Notification on Rate Limit Hit
- Accessible from the **Connect Slack** button in the top navigation.
- Supports both **Slack OAuth authorization flow** and **direct Slack Incoming Webhook URL**.
- Live verifiable alert dispatched the exact moment an hourly limit is reached.
- Test alert button included in modal to verify Slack webhook connectivity instantly.
- Safe disconnect/reconnect without needing server restarts.

### 5. Elasticsearch Search
- Every email is indexed into Elasticsearch `reachinbox_emails` upon creation and status change.
- Multi-field fuzzy search: `recipientEmail^3`, `senderEmail^2`, `subject^2`, `body`.
- Includes graceful fallback to PostgreSQL if Elasticsearch is ever offline.

---

## 📹 Demo Video Walkthrough Guide (5-Minute Script)

1. **Authentication (0:00 - 0:30)**
   - Open `http://localhost:5173`.
   - Click "One-Click Demo Account Login" (or Google OAuth).
   - Show top header with avatar, name ("Alex Mercer"), Slack button, and BullMQ link.

2. **Schedule Emails & CSV Leads (0:30 - 1:45)**
   - Click **Compose New Email**.
   - Drag and drop `E:\ReachInbox\Details\leads_sample.csv` (15 leads auto-detected with badge).
   - Set delay to 2 seconds and hourly limit to 50.
   - Click **Schedule Emails**.
   - Show emails appearing in the **Scheduled Emails** table.
   - Open `/admin/queues` in a new tab to show jobs live in the BullMQ dashboard!

3. **Sent Emails & Ethereal SMTP Preview (1:45 - 2:30)**
   - Wait a few seconds for emails to send.
   - Switch to **Sent Emails** tab.
   - Click **View in Ethereal** on any sent email to open the live browser preview generated by Ethereal SMTP!

4. **Server Restart Persistence Demo (2:30 - 3:30)**
   - Schedule an email for 2 minutes into the future.
   - Terminate the backend server (`Ctrl+C` or kill process).
   - Show in console that the server is completely stopped.
   - Start server again (`node dist/server.js`).
   - Point out startup log: `✅ Reconciler completed: Verified 1 pending email(s). Re-enqueued 0 missing job(s)`.
   - Wait for the scheduled time and show that the email sends on time without duplicate or loss!

5. **Rate Limiting & Live Slack Notification (3:30 - 5:00)**
   - Click **Connect Slack** in header. Paste your Slack Incoming Webhook URL.
   - Schedule bulk emails with `hourlyLimit = 2`.
   - Watch email #1 and #2 send, and email #3 get marked as `DELAYED_RATE_LIMITED` (scheduled for next hour).
   - Show the live Slack notification received in your Slack channel!

---

## ⚙️ Assumptions & Trade-Offs

1. **Ethereal Test Accounts**: Nodemailer creates dynamic Ethereal test accounts on first run, providing instant live message preview URLs without external credentials.
2. **Elasticsearch Resilience**: Elasticsearch 7.17 was chosen for low memory footprint (~256MB) and stability in Docker containers. A PostgreSQL fallback is built in to ensure continuous availability if search clusters experience downtime.
3. **Multi-Tenant / Multi-Sender Design**: Sender accounts each maintain independent rate-limit keys in Redis (`ratelimit:{sender}:{hour}`), preventing high-volume senders from starving lower-volume senders.

---

## 👥 Repository Access & Submission

Repository granted access to:
- `Mitrajit`
- `Yadav036`

ReachInbox Full-Stack Engineering Assignment • Outbox Labs