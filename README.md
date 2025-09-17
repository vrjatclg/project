**# Canteen Management System (Frontend + Firebase)

Fast, efficient, web-based canteen management with:
- Student UI (no login): browse, order, cancel; payment code generation.
- Admin UI (login): verify payments, manage menu, block/unblock students, settings.

Tech:
- HTML + CSS + JavaScript (ES Modules)
- Firebase (Auth + Firestore). No localStorage reliance.

## Setup

1) Firebase Console
- Enable Firestore (Native mode)
- Enable Authentication: Email/Password

2) Admin Account
- Create user: **admin@gmail.com**
- Password: **admin123** (change after first login via Admin UI)

3) Security Rules
- Deploy `firestore.rules` (see file) so only the admin can mutate privileged data.

4) Config
- Both `index.html` and `admin.html` inject `window.__FIREBASE_CONFIG__` for your project:
  - projectId: `time2eat-a3617`
  - storageBucket corrected to `time2eat-a3617.appspot.com`

## Data Model

- settings/globals
  - cancelThreshold: number

- menu (collection)
  - name, price, image, available, createdAt, updatedAt

- orders (collection)
  - pid, items[{itemId,name,price,qty,subtotal}], subtotal
  - status: PENDING_PAYMENT | PAID_UNVERIFIED | VERIFIED | FULFILLED | CANCELLED
  - paymentCode, paymentVerifiedAt, createdAt, updatedAt

- students (collection, docId = PID)
  - blocked: boolean, blockReason
  - cancellations (subcollection)
    - { orderId, ts }

## Develop/Run

- Serve the folder with any static server. Example:
  - `npx serve .` or use VS Code Live Server
- Open `index.html` for Student UI, `admin.html` for Admin UI.

Notes:
- Payment flow is front-end only; students generate a unique code after paying externally; admin verifies it.
- Students never authenticate; only the admin uses Firebase Auth.**
