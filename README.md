
# Trip Planner API

Backend-first project for a collaborative trip planning tool.

- **Stack:** NestJS (TypeScript) · Prisma (PostgreSQL) · JWT Auth · Class-Validator · Swagger  
- **Status:** `v0.5.0` in progress (collaboration phase)  
- **Tag history:**
  - `v0.1.0` — base API (Auth, Users, Trips + health/version) with e2e tests
  - `v0.5.0` — collaboration (Members & Invites, Items, Votes)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Database & Prisma](#database--prisma)
- [Run & Dev UX](#run--dev-ux)
- [Testing](#testing)
- [API Overview](#api-overview)
  - [Error Model](#error-model)
  - [Pagination](#pagination)
  - [Auth](#auth)
  - [Users](#users)
  - [Trips](#trips)
  - [Members & Invites](#members--invites)
  - [Items](#items)
  - [Votes](#votes)
- [Observability & Standards](#observability--standards)
- [Versioning & Releases](#versioning--releases)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### v0 (tag `v0.1.0`)
- **Auth:** register, login, refresh (JWT access/refresh).
- **Users:** `GET /users/me`, `PATCH /users/me`.
- **Trips:** owner-only CRUD (`POST /trips`, `GET /trips`, `GET /trips/:id`, `PATCH /trips/:id`, `DELETE /trips/:id`).
- **Infra:**
  - Global request ID (`x-request-id`) via middleware/interceptor.
  - Standard error payload and exception filter.
  - Pagination DTOs and Swagger (`/docs`).

### v0.5 (in progress)
- **Members & Invites:** list members (OWNER/EDITOR), change role (OWNER), remove member (OWNER); create invites (OWNER → EDITOR/VIEWER, EDITOR → VIEWER), `/me/invites`, accept/decline (email match).
- **Items:** CRUD with date/timezone validation and within-trip-range rules; pagination, sorting (`createdAt|startAt|votes`), daily filter.
- **Votes:** upvote/unvote items; 1 per user/item; `votesCount` in item responses.
- **DB:** Prisma models `Invite`, `Item`, `ItemVote` with `onDelete: Cascade`.

---

## Architecture

- **NestJS modules** by domain: `auth`, `users`, `trips`, `members`, `invites`, `items`, `votes`.
- **TripAccessService** centralizes role checks (OWNER/EDITOR/VIEWER).
- **DTOs** with strict validation (class-validator) and **definite assignment** (`!`) for required fields.
- **Prisma** for data access; Postgres schemas & migrations versioned.

---

## Getting Started

### Requirements
- Node.js 18+
- PostgreSQL 13+
- pnpm

### Install
```bash
pnpm i
```

---

## Configuration

Create `.env` from `.env.example`:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_TTL=900
JWT_REFRESH_SECRET=change-me-too
JWT_REFRESH_TTL=604800
CORS_ORIGINS=http://localhost:3000
APP_VERSION=0.5.0
```

---

## Database & Prisma

Run migrations and generate the client:

```bash
pnpm prisma migrate dev
pnpm prisma generate
```

For production deploys:

```bash
pnpm prisma migrate deploy
```

**Cascade deletes:** relations from `Trip` to `TripMember`, `Invite`, and `Item`; from `Item` to `ItemVote`.

---

## Run & Dev UX

Start the API (dev):

```bash
pnpm start:dev
```

Swagger UI:

```
http://localhost:3000/docs
```

Swagger is configured with persisted authorization and example payloads for all endpoints with request bodies (POST/PATCH).

---

## Testing

We separate **unit** and **e2e** projects in Jest.

Scripts:

```bash
pnpm test
pnpm test:unit
pnpm test:e2e
```

**E2E environment:**

- Uses `.env.test` loaded via `dotenv/config` and `DOTENV_CONFIG_PATH=.env.test`.
- Each suite resets DB:

```bash
pnpm prisma migrate reset --force --skip-generate --skip-seed
```

**Suites included:**

- Auth e2e
- Users e2e
- Trips e2e
- Members & Invites e2e
- Items e2e
- Votes e2e

---

## API Overview

> Full contracts & examples in Swagger (`/docs`).

### Error Model

All errors conform to:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | TRIP_FORBIDDEN | INVITE_NOT_FOUND | ...",
    "message": "Human-friendly message",
    "details": { "field": "optional details" },
    "requestId": "uuid-correlating-the-request"
  }
}
```

- `requestId` is also returned in the `x-request-id` response header.

### Pagination

List endpoints return:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "pageSize": 20, "total": 123 }
}
```

Query params: `page`, `pageSize`, plus endpoint-specific filters/sort.

---

### Auth

- `POST /auth/register` → create user, returns `{ user, accessToken, refreshToken }`.
- `POST /auth/login` → `{ user, accessToken, refreshToken }`.
- `POST /auth/refresh` → rotatable `{ accessToken, refreshToken }`.

**Notes**

- Access token is used as `Authorization: Bearer <token>`.
- Refresh token is posted to `/auth/refresh`.

---

### Users

- `GET /users/me` → current profile.
- `PATCH /users/me` → update profile fields (e.g., `name`, `avatarUrl`).

---

### Trips

- `POST /trips` → create trip (owner).
- `GET /trips` → list trips (owner’s).
- `GET /trips/:tripId` → detail.
- `PATCH /trips/:tripId` → update.
- `DELETE /trips/:tripId` → delete (cascade removes members/items/votes/invites).

**Validation**

- `startDate <= endDate`, `timezone` must be IANA.

---

### Members & Invites

- `GET /trips/:tripId/members` (OWNER/EDITOR)
- `PATCH /trips/:tripId/members/:userId` (OWNER) → update role to `EDITOR|VIEWER`.
- `DELETE /trips/:tripId/members/:userId` (OWNER) → cannot remove OWNER.
- `POST /trips/:tripId/invites` (OWNER/EDITOR)
  - OWNER can invite as `EDITOR` or `VIEWER`.
  - EDITOR can invite **only** as `VIEWER`.
  - Duplicate pending invites return `409 VALIDATION_ERROR`.
- `GET /me/invites` → invites by authenticated email.
- `POST /invites/:id/accept` → creates membership (email must match).
- `POST /invites/:id/decline` → marks declined.

---

### Items

- `POST /trips/:tripId/items` (OWNER/EDITOR)
- `GET /trips/:tripId/items` (member) — pagination, sorting (`createdAt|startAt|votes`), filter by `date=YYYY-MM-DD`.
- `GET /trips/:tripId/items/:itemId` (member)
- `PATCH /trips/:tripId/items/:itemId` (OWNER/EDITOR or **author**)
- `DELETE /trips/:tripId/items/:itemId` (OWNER/EDITOR or **author**)

**Validation**

- Optional `startAt/endAt` must satisfy `startAt <= endAt`.
- Provided datetimes must fall within trip’s `[startDate, endDate]`.
- `timezone` must be IANA; `currency` must be ISO-4217 (3 letters); `costCents >= 0`.

**Response**

- Items include `votesCount`.

---

### Votes

- `POST /trips/:tripId/items/:itemId/votes` (member) → `201 { itemId, votesCount }`
  - `409 VOTE_CONFLICT` if already voted.
- `DELETE /trips/:tripId/items/:itemId/votes` (member) → `204`
  - `404 VOTE_NOT_FOUND` if no existing vote.

---

## Observability & Standards

- **Request ID**: generated/propagated via middleware/interceptor; returned in `x-request-id` and embedded in error payloads.
- **Logging**: errors logged by `HttpExceptionFilter`; success logs configurable in dev/test.
- **Security**:
  - JWT auth (access/refresh).
  - Passwords stored as hashes (implementation-specific).
  - CORS origins configurable via `CORS_ORIGINS`.
- **TypeScript**: `strict: true`; DTOs use definite assignment (`!`) to align with runtime transformation/validation.

---

## Versioning & Releases

- **SemVer**:
  - `v0.1.0` — base release.
  - `v0.5.0` — collaboration (current).

**Tagging:**

```bash
git tag -a v0.1.0 -m "Base API"
git push origin v0.1.0

git tag -a v0.5.0 -m "Members+Invites, Items, Votes"
git push origin v0.5.0
```

---

## Roadmap

- **v0.6**: Public shared trips (LINK visibility), read-only share tokens.
- **v0.7**: External providers (places, maps) behind feature flags; enrichment jobs.
- **v0.8**: Notifications & email invites; audit logs.
- **v1.0**: Billing & organizations (if needed); production hardening (rate limiting, caching, SLOs).

---

## License

Copyright © You.
License to be defined (MIT/Apache-2.0/Proprietary). Update this section when you decide.

<!-- EOF -->
