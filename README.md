# POS System — Local-First, Event-Driven

A desktop Point of Sale application built with **Next.js**, **Tauri**, and **Firebase**, designed for zero-latency cashier operations with background sync to a remote API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri Desktop App                       │
│                                                              │
│  ┌──────────────────┐    Firestore     ┌──────────────────┐  │
│  │   Main Window    │  ◄──onSnapshot──►│  Customer Display │  │
│  │   (Cashier)      │                  │  (/display)       │  │
│  │                  │                  │                    │  │
│  │  Zustand Store   │                  │  Real-time mirror  │  │
│  │  ───► Firestore  │                  │  of cart items     │  │
│  └──────────────────┘                  └──────────────────┘  │
│           │                                                  │
│           │ writes LOCAL_PAID                                 │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions                          │
│                                                                │
│  onDocumentUpdated("pos_orders/{id}")                         │
│    ├── status → SYNCING                                       │
│    ├── MD5 sign → order_create (HK API)                       │
│    ├── MD5 sign → order_pay   (HK API)                        │
│    └── status → SYNC_SUCCESS / SYNC_FAILED                    │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Desktop | Tauri v2 (Rust + WebView) |
| Database | Firebase Firestore |
| State | Zustand |
| Sync Worker | Firebase Cloud Functions (v2) |
| Signature | MD5 (Node.js `crypto`) |

## Project Structure

```
├── src/                          # Next.js frontend (static export)
│   ├── app/
│   │   ├── page.tsx              # Cashier POS terminal
│   │   └── display/page.tsx      # Customer-facing display
│   ├── components/
│   │   ├── pos/                  # Cart, Checkout components
│   │   └── display/              # CustomerView component
│   └── lib/
│       ├── firebase/client.ts    # Firebase Client SDK
│       ├── services/orderService.ts  # Firestore CRUD
│       ├── stores/useCartStore.ts    # Zustand cart state
│       └── types/                # TypeScript interfaces
│
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── index.ts              # Firestore trigger (sync worker)
│       ├── config/firebase.ts    # Admin SDK init
│       ├── services/hkApiService.ts  # HK API caller
│       ├── utils/hk-signature.ts     # MD5 signature utility
│       └── types/order.ts        # Shared types (duplicated)
│
├── src-tauri/                    # Tauri v2 backend (Rust)
│   ├── src/lib.rs                # Commands (open_customer_display)
│   └── tauri.conf.json           # Dual-window config
│
├── firebase.json                 # Firebase project config
├── firestore.rules               # Firestore security rules (DEV)
└── .env.example                  # Environment template
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Rust toolchain ([rustup.rs](https://rustup.rs))
- Tauri CLI (`pnpm add -D @tauri-apps/cli`)
- Firebase CLI (`npm install -g firebase-tools`)

### Setup

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   cd functions && npm install && cd ..
   ```

2. **Configure environment:**
   ```bash
   cp .env.example.local .env.local
   # Use the same Firebase client values as bduck-system/.env.local
   
   cp functions/.env.example functions/.env.local
   # Fill in HK API credentials (server-side only)
   ```

3. **Run in development mode:**
   ```bash
   # Next.js only (browser)
   pnpm dev
   
   # Tauri desktop app (includes Next.js dev server)
   pnpm tauri:dev
   ```

4. **Run Firebase emulators (optional):**
   ```bash
   firebase emulators:start
   ```

### Build for Production

```bash
# Build static export
pnpm build

# Build Tauri desktop binary
pnpm tauri:build

# Deploy Cloud Functions
cd functions && npm run deploy
```

## Order Lifecycle

```
DRAFT → LOCAL_PAID → SYNCING → SYNC_SUCCESS
                             → SYNC_FAILED (auto-retry)
```

1. **DRAFT**: Cashier is building the cart
2. **LOCAL_PAID**: Payment completed at terminal, saved to Firestore
3. **SYNCING**: Cloud Function picked up the order, calling HK API
4. **SYNC_SUCCESS**: HK API confirmed, `hkOrderNumber` stored
5. **SYNC_FAILED**: HK API error, `retryCount` incremented

## Security

- HK API key (`HK_API_KEY`) is **never** exposed to the frontend
- MD5 signature generation runs **exclusively** in Cloud Functions
- Firebase Client SDK uses only public configuration
- Firestore rules must be hardened before production deployment
