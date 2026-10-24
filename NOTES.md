# Notes

## Decisions

**1. Amounts are exact BigInt fixed-point.** Amounts are strings at every edge (API, storage, display). For math, they are parsed into a BigInt count of the asset's smallest unit (`10^-decimals`) in `src/lib/money.ts`. Parsing is strict and follows the API format, so `.5`, `1.`, `05` and `1e-3` are rejected. Values are sent back in canonical form ("0.50" becomes "0.5"). USD is `amount × usdPrice` computed exactly, summed across assets, and rounded half up to cents only when displayed. *Alternatives:* JS numbers can't hold the real ETH balance `12.345678901234591676` (18 decimals). A decimal library (big.js or decimal.js) would also be correct, but it adds a dependency and its own rounding settings. Since every asset comes with its `decimals`, scaled integers are simpler and easy to test.

**2. The balance right after a claim: "subtract and hold".** Once a claim exists, Home moves its amount from available to claiming right away and shows "Claim in progress". The local adjustment holds until a snapshot with `asOf >= claim.createdAt` arrives. From then on the server's numbers already include the claim and we add nothing (`src/claims/adjustments.ts`). An older snapshot can therefore never undo the drop. The only time money comes back is a claim that actually **failed**, and that comes with a notice and the reason. The claim form checks the next claim against this adjusted available amount. *Alternatives we considered* (log turn #14):
- (A) Show only the server snapshot, plus a banner and a lock. Nothing ever jumps, but the balance doesn't change for up to 15 s, which is the complaint "I claimed and my balance didn't change".
- (C) Subtract, then trust the next fetch. That fetch is often still the old snapshot, so the balance drops, jumps back and drops again, which is the complaint "I stopped trusting the app".
- (D) Show the server number and an "after your claim" number side by side. It's honest, but having two balances is confusing.

B fixes both user complaints.

**3. Unknown outcome: the app keeps confirming, and never shows success or failure.** Before the first POST, the attempt `{Idempotency-Key, body}` is saved to localStorage. Timeouts, 504, 5xx, network loss and 429 are retried with the **same key and body**. The backoff is 1, 2, 4 and 8 s, or `retryAfterMs` on a 429. The API returns the original claim for a replay, so a retry can't double-claim. A 400 means "not created" and shows the error. A 401 keeps the attempt for after re-entering the token. During this, the user sees "Confirming your claim…" with the amount held on their balance. If retries run out, they see "Couldn't confirm yet" and a **Check again** button, which re-sends the same key. **New claims for that asset are blocked** until the attempt resolves, because a new key is the only way to create a double claim. Unresolved attempts are resumed automatically on the next app open. This isn't theoretical. While building, a real POST returned **504 even though it had created the claim**, and re-sending with the same key returned `200 Idempotent-Replayed: true` (turn #24). Treating that 504 as a failure would have invited a second claim.

**Other decisions:**
- TanStack Query: GETs retry only on 429, 5xx and network errors. POSTs are never retried by the library, only by the same-key loop.
- The query cache resets when the token changes, so one token's data can't show under another.
- Local claim state is namespaced by a hash of the token.
- Expo Router.
- A plain `fetch` client with a 15 s timeout.
- Total payback = available + pending (claiming is already on its way out).

## Working with AI

I used Claude Code (in plan mode first, then building), and the full session is in `ai-logs/`. `session-01-claude-code.md` is a readable export with numbered turns. `session-01-raw.jsonl` is the untouched transcript with only the token and email redacted. The readable export lacks some of the short progress notes the agent wrote between tool calls, because Claude Code doesn't store them in its transcript.

1. **A prompt that didn't get what I wanted** (turns #5–#11). I pasted the brief in parts. After each part the AI asked whether to finalize, and twice it tried to close planning and start building while I still had sections to paste. I interrupted ("sorry I still have inputs", "I still have inputs)") and changed how I prompted: I pasted every section first, then said explicitly "That's it for now… make a perfect plan" (turn #18).
2. **AI output that was wrong or risky** (turn #29). The AI reported "Home and Claim are live" after deploying. When it took a headless screenshot of production, the Activity screen there was still the placeholder: `expo export` had reused a stale Metro cache, and the AI's own checks had run against the dev server, not the deployed build. It was fixed with `expo export --clear` and checked again on the live URL. Since then, every deploy is checked against production.
3. **A suggestion I disagreed with** (turns #12–#14). The AI's first plan had already picked the balance-after-claim behavior on its own. The brief asks for at least two approaches before choosing, so I didn't accept that. The AI then laid out A–D with trade-offs, and I chose B. I also refused to let it finalize the plan early (turn #10, a rejected tool call).

## Not done / known issues

- **A rejected resumed attempt is silent.** If an attempt resumed on app open gets a 400 (for example, the balance changed), it's dropped without a visible message. Next: keep a per-asset notice.
- **The token is stored in localStorage,** which is fine for a 24 h test token. A real app would use secure storage on native and a short-lived session on web.
- **No end-to-end tests.** I tested flows manually with a headless browser script (validation, Max, double tap, resume after reload). Next: Playwright against a mock API that injects 504s.
- **Clock skew:** freshness ("N s ago") uses the device clock against the server's `asOf`, clamped at 0. The D2 release rule compares two server timestamps, so skew doesn't affect money.
- **Native:** only tested on web, as the brief requires. Inputs use `inputMode="decimal"`, but locale-specific number input on native wasn't checked.
- **Activity** has no filters, and reversals show the related accrual id rather than linking to it.
