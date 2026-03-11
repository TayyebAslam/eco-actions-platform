# Thrive - Sustainability Engagement Platform

A full-stack sustainability engagement ecosystem that gamifies eco-friendly actions for schools and students. Built to connect schools, teachers, and students in tracking real-world environmental impact through a gamified reward system.

## Key Features

- **Multi-Role Hierarchy** — Super Admin, School Admin, Sub-Admin, Teacher, Student with granular RBAC
- **Gamification Engine** — XP system, leveling (Green Rookie → Eco-Champion), badges, streaks, and leaderboards
- **Eco-Action Tracking** — Students log activities (recycling, planting, conservation) with photo uploads and teacher verification
- **Sustainability Challenges** — Create challenges with difficulty variants (Easy/Hard) and track progress
- **Real-Time Analytics** — Dashboard with participation rates, environmental impact metrics, and growth trends
- **Content Management** — Rich text articles with Lexical editor, categories, and learning hub
- **Push Notifications** — Firebase Cloud Messaging for real-time engagement
- **Session Management** — Multi-device login tracking with active session controls
- **Audit Logging** — Complete trail of admin actions

## Tech Stack

### Admin Panel (Frontend)
| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework with App Router & Turbopack |
| React 19 | UI library |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Radix UI + shadcn/ui | Component library |
| TanStack React Query | Server state management |
| TanStack React Table | Data tables with sorting, filtering, pagination |
| React Hook Form + Zod | Form handling & validation |
| Recharts | Data visualization & charts |
| Lexical | Rich text editor |
| Socket.io Client | Real-time updates |
| Firebase | Push notifications (FCM) |
| Axios | HTTP client with CSRF handling |

### Backend (API)
| Technology | Purpose |
|-----------|---------|
| Express.js 5 | REST API framework |
| TypeScript | Type safety |
| PostgreSQL | Primary database |
| Knex.js | Query builder & migrations |
| Redis (ioredis) | Caching & session store |
| Socket.io | Real-time communication |
| JWT + bcrypt | Authentication & password hashing |
| Zod | Request validation |
| Firebase Admin | Push notifications |
| Nodemailer / Brevo | Email service |
| Multer | File uploads |
| Swagger | API documentation |
| Helmet | Security headers |
| Winston + Morgan | Logging |
| Jest + Supertest | Testing |
| Docker | Containerization |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Admin Panel    │────▶│   Express API   │────▶│  PostgreSQL   │
│   (Next.js 16)  │     │   (TypeScript)  │     │  (24 tables)  │
└─────────────────┘     └────────┬────────┘     └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  Redis   │ │ Firebase │ │  Email   │
              │ (Cache)  │ │  (FCM)   │ │ (SMTP)  │
              └──────────┘ └──────────┘ └──────────┘
```

## Database Schema

24 tables covering the complete domain:

`users` · `schools` · `classes` · `sections` · `students` · `staff` · `teacher_sections` · `modules` · `permissions` · `categories` · `activities` · `likes` · `comments` · `levels` · `badges` · `student_badges` · `points_log` · `challenges` · `challenge_variants` · `challenge_progress` · `articles` · `article_categories` · `leaderboards` · `notifications`

See [`schema.dbml`](./schema.dbml) for the complete database design.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for caching)
- Firebase project (optional, for push notifications)

### Backend Setup

```bash
cd backend
cp .env.example .env     # Configure environment variables
npm install
npm run docker:up        # Start PostgreSQL & Redis containers
npm run knex migrate:latest   # Run database migrations
npm run knex seed:run         # Seed initial data
npm run dev              # Start development server (port 5000)
```

### Admin Panel Setup

```bash
cd admin-panel
cp .env.example .env.local   # Configure environment variables
npm install
npm run dev              # Start Next.js dev server (port 3000)
```

### API Documentation

Once the backend is running, visit `http://localhost:5000/api-docs` for the interactive Swagger documentation.

## Project Structure

```
├── admin-panel/          # Next.js 16 Admin Dashboard
│   ├── src/
│   │   ├── app/          # Pages (App Router)
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # API client, utilities
│   │   ├── providers/    # Context providers
│   │   └── types/        # TypeScript definitions
│   └── public/
│
├── backend/              # Express.js REST API
│   ├── src/
│   │   ├── config/       # Database, CORS, Swagger, Firebase
│   │   ├── controller/   # Route handlers
│   │   ├── db/           # Migrations & seeds
│   │   ├── middlewares/  # Auth, rate limiting, CSRF
│   │   ├── routes/       # API route definitions
│   │   ├── services/     # Business logic
│   │   ├── validations/  # Zod schemas
│   │   └── utils/        # Helpers, Socket.io, Redis
│   └── tests/
│
└── schema.dbml           # Database schema documentation
```

## Security

- JWT authentication with encrypted tokens
- CSRF protection on state-changing requests
- Rate limiting on all endpoints
- Helmet security headers
- Role-based access control (RBAC) with fine-grained permissions
- Input validation with Zod on every endpoint
- Password hashing with bcrypt
