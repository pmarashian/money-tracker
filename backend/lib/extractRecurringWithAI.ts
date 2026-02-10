import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { RecurringPattern } from "./recurring";
import type { NormalizedTransaction } from "./csv";
import { normalizeMerchantName, normalizeDescriptionForTable } from "./csv";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Max groups written to file (all merchants); may be capped when very large. */
const MAX_MERCHANT_GROUPS_FILE = 500;

type Frequency = "monthly" | "weekly" | "biweekly";

export type MerchantGroup = {
  name: string;
  occurrences: { postingDate: string; amount: number }[];
};

/**
 * Normalize date from MM/DD/YYYY to YYYY-MM-DD for the model.
 */
function toISODate(postingDate: string): string {
  const [m, d, y] = postingDate.split("/");
  if (!m || !d || !y) return postingDate;
  const pad = (s: string) => s.padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Build merchant groups from parsed transactions (debits only).
 * Groups by normalizedMerchant (with fallback to description so no debit is dropped).
 * Includes every merchant (single-occurrence and repeat). Written file is capped at
 * MAX_MERCHANT_GROUPS_FILE for usability when there are many unique merchants.
 */
function buildMerchantGroups(
  transactions: NormalizedTransaction[]
): MerchantGroup[] {
  const byMerchant = new Map<string, { postingDate: string; amount: number }[]>();

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const merchant = (
      tx.normalizedMerchant?.trim() ||
      normalizeMerchantName(normalizeDescriptionForTable(tx.description)) ||
      tx.description?.trim() ||
      "unknown"
    ).trim();
    if (!byMerchant.has(merchant)) {
      byMerchant.set(merchant, []);
    }
    byMerchant.get(merchant)!.push({
      postingDate: toISODate(tx.postingDate),
      amount: tx.amount,
    });
  }

  const groups: MerchantGroup[] = [];
  for (const [name, occs] of byMerchant.entries()) {
    occs.sort((a, b) => a.postingDate.localeCompare(b.postingDate));
    groups.push({ name, occurrences: occs });
  }

  if (groups.length > MAX_MERCHANT_GROUPS_FILE) {
    groups.sort((a, b) => b.occurrences.length - a.occurrences.length);
    return groups.slice(0, MAX_MERCHANT_GROUPS_FILE);
  }
  return groups;
}

const SYSTEM_PROMPT_MERCHANT_GROUPS = `You are a financial data analyst. You receive a list of merchant groups and a reference date (today). Each group has:
- name: merchant name
- occurrences: array of { postingDate (YYYY-MM-DD), amount (negative number) }

Not all expenses are recurring. Include a group in recurring_expenses only if BOTH conditions hold:

1) Clear recurring pattern: consistent date spacing (~30 days = monthly, ~14 = biweekly, ~7 = weekly) and consistent or stable typical amount.
2) Currently active as of the reference date: at least one occurrence within the last 1.5–2 billing cycles. For monthly, last occurrence within ~45–60 days of the reference date; for weekly, within ~2 weeks; for biweekly, within ~3 weeks. If the last occurrence is older than that, omit the group (treat as ended).

Exclusions — do NOT include:
- One-off or sporadic items: individual checks, Zelle/transfers, single hotel stays, one-time purchases, or anything that does not show a regular repeat.
- Credit card or loan payments with highly variable amounts (omit unless there is a clear fixed minimum payment pattern).

For each group you include, output one recurring_expenses entry with:
- name: the group's name (use as-is)
- amount: typical amount as a positive number (median or average of the absolute amounts)
- frequency: one of "monthly", "weekly", or "biweekly" from date spacing
- typicalDayOfMonth: for monthly, a number 1-31 for the typical day of month; for weekly or biweekly, use 0

Output only the JSON object with key "recurring_expenses" containing an array of these objects. No other text.`;

/**
 * Parse and validate OpenAI response into RecurringPattern[].
 */
function parseAndValidateResponse(content: string | null): RecurringPattern[] {
  if (!content || typeof content !== "string") return [];

  let parsed: { recurring_expenses?: unknown[] };
  try {
    const trimmed = content.trim();
    const jsonStr = trimmed.startsWith("```")
      ? trimmed.replace(/^```\w*\n?|\n?```$/g, "").trim()
      : trimmed;
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  const arr = Array.isArray(parsed.recurring_expenses)
    ? parsed.recurring_expenses
    : [];
  const valid: RecurringPattern[] = [];
  const validFreq: Frequency[] = ["monthly", "weekly", "biweekly"];

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const amount = typeof o.amount === "number" ? o.amount : Number(o.amount);
    const frequency = validFreq.includes(o.frequency as Frequency)
      ? (o.frequency as Frequency)
      : undefined;
    const typicalDayOfMonth =
      typeof o.typicalDayOfMonth === "number" &&
      o.typicalDayOfMonth >= 1 &&
      o.typicalDayOfMonth <= 31
        ? o.typicalDayOfMonth
        : undefined;

    if (!name || !Number.isFinite(amount) || amount <= 0 || !frequency)
      continue;

    valid.push({
      name,
      amount: Math.abs(amount),
      frequency,
      ...(typicalDayOfMonth !== undefined && { typicalDayOfMonth }),
    });
  }

  // Deduplicate by name (keep first occurrence per name)
  const seen = new Set<string>();
  return valid.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });
}

/** Max days since last occurrence to consider a pattern still active. */
const MAX_DAYS_SINCE_LAST_OCCURRENCE: Record<Frequency, number> = {
  monthly: 60,
  biweekly: 21,
  weekly: 14,
};

/**
 * Filter out patterns whose last transaction is older than the recency window
 * (programmatic backstop when the model still returns stale expenses).
 */
function filterStalePatterns(
  patterns: RecurringPattern[],
  groupsByName: Map<string, MerchantGroup>,
  referenceDateStr: string
): RecurringPattern[] {
  const ref = new Date(referenceDateStr);
  if (Number.isNaN(ref.getTime())) return patterns;

  return patterns.filter((p) => {
    const group = groupsByName.get(p.name);
    if (!group?.occurrences.length) return true; // no data, keep (AI said recurring)
    const lastDateStr = group.occurrences[group.occurrences.length - 1]?.postingDate;
    if (!lastDateStr) return true;
    const last = new Date(lastDateStr);
    if (Number.isNaN(last.getTime())) return true;
    const maxDays = MAX_DAYS_SINCE_LAST_OCCURRENCE[p.frequency];
    const daysSince = Math.round((ref.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= maxDays;
  });
}

const OPENAI_RESPONSE_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "recurring_expenses_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        recurring_expenses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              frequency: {
                type: "string",
                enum: ["monthly", "weekly", "biweekly"],
              },
              typicalDayOfMonth: { type: "number" },
            },
            required: ["name", "amount", "frequency", "typicalDayOfMonth"],
            additionalProperties: false,
          },
        },
      },
      required: ["recurring_expenses"],
      additionalProperties: false,
    },
  },
};

/**
 * Extract recurring expenses using OpenAI from a normalized table of transactions
 * (parsed CSV rows with postingDate, description, amount — debits only, no Redis).
 * Transactions are pre-grouped by normalizedMerchant so every candidate is considered.
 * Throws on API error or missing key so caller can fall back to algorithm.
 */
export async function extractRecurringExpensesWithAIFromNormalizedTable(
  transactions: NormalizedTransaction[]
): Promise<RecurringPattern[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const merchantGroups = buildMerchantGroups(transactions);
  const merchantGroupsPath = path.join(
    process.cwd(),
    "openai-expenses-merchant-groups.json"
  );
  fs.writeFileSync(
    merchantGroupsPath,
    JSON.stringify(merchantGroups, null, 2),
    "utf-8"
  );
  console.log(
    "[extractRecurringWithAI] Wrote merchant groups to",
    merchantGroupsPath,
    "—",
    merchantGroups.length,
    "groups (all merchants)"
  );

  const recurringCandidates = merchantGroups.filter(
    (g) => g.occurrences.length >= 2
  );
  if (recurringCandidates.length === 0) {
    console.log("[extractRecurringWithAI] No merchant groups with 2+ debits, skipping OpenAI");
    return [];
  }

  console.log(
    "[extractRecurringWithAI] Calling OpenAI —",
    recurringCandidates.length,
    "merchant groups (2+ occurrences)"
  );
  const referenceDate = new Date().toISOString().slice(0, 10);
  const userPayload = JSON.stringify(recurringCandidates, null, 0);
  const userContent = `Merchant groups (name, occurrences with postingDate and amount):\n${userPayload}\n\nReference date (today) for "currently active" judgment: ${referenceDate}`;

  const payloadForFile = {
    model: "gpt-4o-mini",
    max_tokens: 2000,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_MERCHANT_GROUPS },
      { role: "user", content: userContent },
    ],
  };
  const payloadPath = path.join(process.cwd(), "openai-expenses-payload.json");
  fs.writeFileSync(
    payloadPath,
    JSON.stringify(payloadForFile, null, 2),
    "utf-8"
  );
  console.log("[extractRecurringWithAI] Wrote request payload to", payloadPath);

  const payloadArrayPath = path.join(
    process.cwd(),
    "openai-expenses-payload-array.json"
  );
  fs.writeFileSync(
    payloadArrayPath,
    JSON.stringify(recurringCandidates, null, 2),
    "utf-8"
  );
  console.log(
    "[extractRecurringWithAI] Wrote payload array (recurring candidates) to",
    payloadArrayPath
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT_MERCHANT_GROUPS },
      { role: "user", content: userContent },
    ],
    max_tokens: 2000,
    temperature: 0.2,
    response_format: OPENAI_RESPONSE_SCHEMA,
  });

  const responsePath = path.join(
    process.cwd(),
    "openai-expenses-response.json"
  );
  fs.writeFileSync(
    responsePath,
    JSON.stringify(
      {
        id: response.id,
        model: response.model,
        usage: response.usage,
        choices: response.choices.map((c) => ({
          index: c.index,
          message: c.message,
          finish_reason: c.finish_reason,
        })),
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(
    "[extractRecurringWithAI] Wrote chat completion response to",
    responsePath
  );

  const content = response.choices[0]?.message?.content ?? null;
  let patterns = parseAndValidateResponse(content);
  const groupsByName = new Map(recurringCandidates.map((g) => [g.name, g]));
  patterns = filterStalePatterns(patterns, groupsByName, referenceDate);
  console.log(
    "[extractRecurringWithAI] OpenAI response —",
    patterns.length,
    "recurring expenses:",
    patterns.map((p) => p.name).join(", ") || "(none)"
  );
  return patterns;
}
