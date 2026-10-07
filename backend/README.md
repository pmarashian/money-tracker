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
    "name": "Rent",
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

**Response `200`:**

```json
{
  "ok": true,
  "diff": {
    "added": ["chase:netflix"],
    "updated": ["chase:rent"],
    "deactivated": ["chase:old-gym"],
    "unchanged": [],
    "skippedProtected": ["chase:manual-bill"]
  },
  "recurring": [ /* full list after merge */ ]
}
```

Merge rules: new keys → `source: "auto"`; auto + not `userEdited` → update fields; missing auto keys → `inactive: true`; `source: "manual"` or `userEdited: true` → never changed.

## POST `/api/snapshot/push`

See [../docs/push-api.md](../docs/push-api.md).
