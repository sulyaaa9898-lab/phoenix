# Fullstack Education CRM (Starter)

This starter includes two apps:

- backend: Node.js + Express + PostgreSQL
- frontend: React + Tailwind + Lucide

## 1) Backend Setup

Path: fullstack-crm/backend

1. Create PostgreSQL database, for example: education_crm.
2. Copy .env.example to .env and set DATABASE_URL.
3. Run schema from src/sql/schema.sql.
4. Install and run backend:

```bash
cd fullstack-crm/backend
npm install
npm run dev
```

Backend URL: http://localhost:4000

## 2) Frontend Setup

Path: fullstack-crm/frontend

1. Install and run frontend:

```bash
cd fullstack-crm/frontend
npm install
npm run dev
```

Frontend URL: http://localhost:5173

To override API URL for frontend, set:

```bash
VITE_API_URL=http://localhost:4000/api
```

## API Endpoints

- GET /api/health
- GET /api/owner/snapshot
- POST /api/owner/tariffs
- POST /api/owner/teachers
- POST /api/owner/rooms
- GET /api/manager/matching-resources?language=English&level=B1
- POST /api/manager/register
- POST /api/manager/attendance

## Matching Logic

GET /api/manager/matching-resources returns:

- matchingTeachers: teachers who support language + level
- availableGroups: existing groups with free seats
- availableSlots: if no groups available, free intersections of teacher availability and room availability

## Business Rules

- Collision prevention: trigger on groups table blocks teacher/room overlap by day/time
- Balance tracking: attendance insertion decrements students.lessons_left
- Registration: selected tariff total_lessons is added to students.lessons_left
