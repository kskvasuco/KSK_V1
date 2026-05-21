# React Native App — KSK VASU & Co

This repo now includes a **unified Expo app** in `mobile/` for Android, iOS, and web, alongside the existing React web client in `client/`.

## Quick start

1. **Restart the backend** (required after auth updates):
   ```bash
   npm start
   ```

2. **Run the mobile app**:
   ```bash
   cd mobile
   cp .env.example .env
   # For a physical phone: EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5500
   npm run start
   ```
   Press `w` for web, `a` for Android emulator, or scan QR with Expo Go.

## Centralized login (`POST /api/auth/login`)

One screen for all roles:

| Role | Login |
|------|--------|
| Customer | 10-digit mobile (same in both fields) |
| Staff | `staff1` / `password1` (defaults) |
| Admin | env `ADMIN_USER` / `ADMIN_PASS` |

Returns JWT used as `Authorization: Bearer <token>` on all API calls.

## What's included

### Customer
- Product catalog, search, cart, place/edit/cancel orders
- Profile (district/taluk, address)
- My orders + delivery history
- Order quantity limits

### Staff
- All order workflow lists (pending → cancelled)
- Read-only products
- User list + block

### Admin
- Dashboard analytics
- Full order management (status, adjustments, dispatch agent)
- Products (visibility, image upload)
- Users, payment settings view, recycle bin, app settings

### Backend
- `middleware/auth.js` — JWT + session hydration
- `routes/auth.js` — centralized login
- CORS enabled for Expo clients

## Emulator storage error (`INSTALL_FAILED_INSUFFICIENT_STORAGE`)

If Expo Go fails to install:

1. Run `mobile\scripts\prepare-emulator.bat` (trims cache)
2. Uninstall unused apps on the emulator (Settings → Apps)
3. Android Studio → Device Manager → **Wipe Data** on the AVD (recommended after increasing disk to 12GB in config)
4. Or install Expo Go from **Play Store** inside the emulator, then run `npm run start` and press `a`

## 100% feature parity

- **Customer flows**: native screens (catalog, cart, orders, profile)
- **Admin/Staff advanced features** (PDF bills, dispatch batches, reports): open drawer → **Full Admin (Web UI)** or **Full Staff (Web UI)** — loads your existing React web panel with JWT session bridge
- **Native order lists**: improved `OrderCard` with delivery recording, history, adjustments

Real-time updates use **8s polling** instead of SSE (works on all platforms).

## Projects

| Path | Purpose |
|------|---------|
| `client/` | Original Vite React web shop + admin |
| `mobile/` | Expo React Native (Android + web + iOS) |
| `server.js` | Shared API |
