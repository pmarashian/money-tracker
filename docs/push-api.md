# Assistant snapshot push API

The Money Tracker backend accepts financial snapshots pushed by Phillip’s assistant. The mobile app reads the latest snapshot for the logged-in user via `GET /api/snapshot`.

## Authentication

- **Push (assistant):** `Authorization: Bearer <MT_PUSH_TOKEN>`
- **Read (app):** existing JWT (`Authorization: Bearer <login token>` or `auth-token` cookie)

`MT_PUSH_TOKEN` must be set on Vercel. If it is unset, push requests receive `503`.

## Target user

Push requests identify the account with an **`email`** field in the JSON body (must match the user’s login email in Redis).

Optionally set **`MT_PUSH_DEFAULT_USER_EMAIL`** on the server so the assistant can omit `email` when there is only one user.

The bearer token proves the caller is the assistant; **email** selects which user receives the snapshot (one shared push secret, multiple users later).

## POST `/api/snapshot/push`

### Example

```bash
curl -sS -X POST "https://money-tracker-backend.vercel.app/api/snapshot/push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MT_PUSH_TOKEN" \
  -d '{
    "email": "you@example.com",
    "as_of": "2026-10-07T16:00:00.000Z",
    "current_available_balance": 4200.50,
    "next_bonus_date": "2026-10-31",
    "projected_low_to_bonus": { "amount": 150.00, "date": "2026-10-20" },
    "topoff_needed_after_bonus": 800.00,
    "following_bonus_date": "2027-01-31",
    "low_after_topoff": { "amount": 200.00, "date": "2026-11-15" },
    "status": "needs_topoff",
    "topoff_needed_now": 250.00,
    "bills": [
      { "name": "Rent", "amount": 2100, "frequency": "monthly", "next_date": "2026-11-01" }
    ]
  }'
```

### Success (`200`)

```json
{
  "ok": true,
  "userId": "...",
  "as_of": "2026-10-07T16:00:00.000Z",
  "received_at": "2026-10-07T16:00:01.123Z"
}
```

### Storage

- Latest (shown in the app): `mt:snapshot:{userId}` — may be the last assistant push or an app-side recompute after expense/settings edits (`source: app-recompute`).
- Assistant baseline (bank balance / as-of for recomputes): `mt:snapshot:assistant:{userId}` — updated only on push; the next push fully replaces it.
- History: `mt:snapshot:history:{userId}` (last 90 entries, newest first; assistant pushes only)

## GET `/api/snapshot`

Requires app login. Returns:

```json
{
  "snapshot": { /* fields from push, plus any extra keys */ },
  "as_of": "2026-10-07T16:00:00.000Z",
  "received_at": "2026-10-07T16:00:01.123Z",
  "stale": false
}
```

`stale` is `true` when `as_of` is more than 3 days old.
