# Money Tracker Backend

Next.js API for Money Tracker. User auth uses JWT; assistant automation uses `MT_PUSH_TOKEN`.

## Assistant auth

All assistant endpoints require:

```
Authorization: Bearer <MT_PUSH_TOKEN>
```

If `MT_PUSH_TOKEN` is unset → `503`. Set `MT_PUSH_DEFAULT_USER_EMAIL` to the app user's login email (single-user setup).

## GET `/api/inputs`

Returns projection inputs for the default push user.

**Response `200`:**

```json
{
  "email": "you@example.com",
  "userId": "uuid",
  "settings": {
    "balance": 0,
    "paycheckAmount": 2000,
    "nextBonusDate": "2026-10-31",
    "bonusAmount": 0,
    "nextPaycheckDate": "2026-10-17",
    "timezone": "America/New_York"
  },
  "recurring": [
    {
      "name": "Rent",
      "amount": 2100,
      "frequency": "monthly",
      "typicalDayOfMonth": 1,
      "externalKey": "chase:rent",
      "source": "auto",
      "userEdited": false,
      "inactive": false,
      "paused": false,
      "nextDate": "2026-11-01"
    }
  ]
}
```

`settings` is the stored user settings object (extra keys preserved). `recurring` is the full `mt:recurring:{userId}` list including inactive items.

## POST `/api/recurring/sync`

Merge Chase-detected bills into recurring storage.

**Request body:** JSON **array** of bills:

```json
[
  {
    "externalKey": "chase:rent",
    "name": "Rent (Zelle to Sacha)",
    "adoptName": "Rent",
    "amount": 2100,
    "frequency": "monthly",
    "typicalDayOfMonth": 1,
    "nextDate": "2026-11-01"
  }
]
```

- `externalKey` (string, required) — stable match key
- `name`, `amount`, `frequency` (`monthly` | `weekly` | `biweekly`) — required
- `typicalDayOfMonth`, `nextDate` — optional
- `adoptName` (string, optional) — if a stored bill has no `externalKey` and its name matches this value (case-insensitive, trimmed), that legacy bill is adopted instead of inserting a new row. The first un-keyed match wins.

**Response `200`:**

```json
{
  "ok": true,
  "diff": {
    "added": ["chase:netflix"],
    "updated": ["chase:rent"],
    "deactivated": ["chase:old-gym"],
    "unchanged": [],
    "skippedProtected": ["chase:manual-bill"],
    "adopted": ["chase:rent"]
  },
  "recurring": [ /* full list after merge */ ]
}
```

Merge rules:

- `adoptName` matches an un-keyed bill → set `externalKey`, set `inactive` to false, copy name/amount/frequency/typicalDayOfMonth/nextDate from the item, and set `source` to `"auto"` so later syncs manage this row. Any other row that already has that `externalKey` (the leftover duplicate) is hard-deleted. The key is listed in `diff.adopted`.
- That un-keyed bill is `userEdited` → only `externalKey` is attached. Name, amount, frequency, dates, `inactive`, `paused`, and `source` stay as they are. The key is listed in `diff.adopted` and `diff.skippedProtected`. The keyed duplicate is still deleted.
- No `adoptName`, or it matches nothing un-keyed → same as before. New keys are inserted with `source: "auto"`. Existing auto bills that are not `userEdited` are updated. Keyed auto bills missing from the payload are set `inactive: true`. Keyed bills with `source: "manual"` or `userEdited: true` are never changed. `paused` is never cleared.
- Un-keyed bills that no item names via `adoptName` are left alone, including manual bills. Deactivation still applies only to keyed auto bills.
- Sending the same payload again does not change stored bills.

## POST `/api/recurring/assistant`

Manage individual recurring bills with the assistant push token (same auth as `/api/recurring/sync` and `/api/inputs`).

**Request body:** a single action object, or `{ "actions": [ ... ] }`.

```json
{
  "actions": [
    {
      "action": "create",
      "name": "Netflix",
      "amount": 15.99,
      "frequency": "monthly",
      "day": 12,
      "externalKey": "chase:netflix",
      "nextDate": "2026-11-12"
    },
    {
      "action": "update",
      "externalKey": "chase:rent",
      "amount": 2100,
      "day": 1,
      "nextDate": "2026-11-01"
    },
    { "action": "pause", "id": "uuid-here" },
    { "action": "unpause", "externalKey": "chase:gym" },
    { "action": "deactivate", "externalKey": "chase:old", "force": true }
  ]
}
```

| Field | Notes |
| --- | --- |
| `action` | `create` \| `update` \| `pause` \| `unpause` \| `deactivate` |
| `id` / `externalKey` | Target for update/pause/unpause/deactivate (one required). Create may set either; `id` is generated if omitted. |
| `name`, `amount`, `frequency` | Required for `create`; optional fields for `update` |
| `day` / `typicalDayOfMonth` | Optional (1–31) |
| `nextDate` | Optional `YYYY-MM-DD` |
| `force` | Default `false`. Rows with `userEdited: true` are **skipped** unless `force: true` |

Rules:

- Assistant mutations never set `userEdited`.
- Create uses `source: "auto"`.
- After any successful change in the request, the app snapshot is recomputed (same as user expense/settings routes).

**Response `200`:**

```json
{
  "ok": true,
  "results": [
    { "action": "create", "status": "ok", "id": "...", "externalKey": "chase:netflix", "index": 3 },
    {
      "action": "update",
      "status": "skipped",
      "reason": "userEdited",
      "externalKey": "chase:power",
      "index": 1
    }
  ],
  "recurring": [ /* full list after apply */ ]
}
```

## POST `/api/snapshot/push`

See [../docs/push-api.md](../docs/push-api.md).
