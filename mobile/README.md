# KSK VASU & Co — Mobile / Web App (React Native + Expo)

Unified app for **customers**, **staff**, and **admin** with centralized login. Runs on **Android**, **iOS**, and **web** (same codebase via React Native Web).

## Prerequisites

- Node 18+
- Backend running: `npm start` from project root (port 5500)
- [Expo Go](https://expo.dev/go) on your phone, or Android emulator

## Setup

```bash
cd mobile
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_API_URL to your machine IP for real devices
npm install
```

## Run

```bash
# From project root
npm run mobile          # Expo dev server
npm run mobile:web      # Browser
npm run mobile:android  # Android emulator
```

## Centralized login

| Role | Identifier | Secret |
|------|------------|--------|
| Customer | 10-digit mobile | Same mobile in both fields |
| Staff | username | staff password |
| Admin | username | admin password |

Use role chips on the login screen, or **Auto** (mobile → customer; otherwise tries admin then staff).

## Architecture

- `src/api/` — HTTP client with JWT (`Authorization: Bearer`)
- `src/context/` — Auth + Cart
- `src/navigation/` — Role-based navigators
- `src/screens/` — User, admin, staff UI
- Backend: `/api/auth/login`, `/api/auth/me` + existing routes (session hydrated from JWT)

## Physical device

Set `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5500` in `mobile/.env`.

## Web + existing React site

The original Vite app in `client/` remains available. This Expo app adds **web** via `npm run web` and shares the same API server.
