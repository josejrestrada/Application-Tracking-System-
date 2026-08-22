# Meridian ATS

Applicant tracking for **Meridian Technologies** staffing operations (Pune, Bangalore, Goa). Built for IT services delivery: every requisition carries client, project, and billing context, and candidates move through a strict hiring pipeline.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- SQLite (`data/ats.db`) via `better-sqlite3`
- Session auth with httpOnly JWT cookies

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first boot the database is created and seeded.

Optional: copy `.env.example` to `.env` and set `ATS_JWT_SECRET` (required in production).

## Demo accounts

Password for all seeded users: `demo`

| Role | Name | Email |
|---|---|---|
| Head of TA | Ananya Kulkarni | `ananya@meridian.tech` |
| Recruiter | Rahul Mehta | `rahul@meridian.tech` |
| Hiring manager | Priya Nair | `priya@meridian.tech` |

## Domain rules

**Requisitions**

- Always show client name, project name, and monthly billing rate (INR).
- Classification is **Project-Specific** or **Bench Hiring**. Bench roles are unbilled until mapped.

**Pipeline**

Applied → Screened → Internal Interview → Client Round → Offered → BGV → Joined

- Rejected or Dropped Out can happen from any active stage.
- Client Round has **Client Approval Status**: Pending / Approved / Rejected.
- Offered is blocked until client approval is Approved. Client Rejected exits the candidate.

**Operations**

- **Notice-period risk:** highlight candidates with notice **> 60 days** when the job’s target close is **< 21 days**.
- **Duplicates:** warn (do not block) when email or phone already exists.
- **Source:** LinkedIn, Naukri, Employee Referral, Direct, or Consultancy (with name).

## API

Authenticated routes expect the session cookie from login/signup.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/signup` | Create recruiter account |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/workspace` | Jobs, candidates, stage events |
| `GET` `POST` | `/api/jobs` | List / create requisitions |
| `GET` | `/api/jobs/:id` | Requisition detail |
| `GET` `POST` | `/api/candidates` | List / create; `?email=&phone=` for duplicate scan |
| `GET` | `/api/candidates/:id` | Candidate + history |
| `POST` | `/api/candidates/:id/advance` | Next pipeline stage |
| `POST` | `/api/candidates/:id/client-approval` | `{ "status": "pending\|approved\|rejected" }` |
| `POST` | `/api/candidates/:id/exit` | `{ "toStage": "rejected\|dropped_out", "reason", "notes" }` |
| `GET` | `/api/health` | Liveness |

SQLite files under `data/` are gitignored; only the directory is kept in the repo.
