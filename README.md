# CashMine payback (Expo web)

**Live:** https://cashmine-payback.expo.app (open it on a phone and paste your API token)

## Run locally

```bash
npm install
npx expo start --web      # http://localhost:8081
npm test                  # Vitest: amount math, claim submit/retry, balance adjustment
npm run typecheck
```

The app asks for the API token on first open and keeps it in this browser's localStorage only. Use **Change token** on Home to switch. The API base URL is set in `src/api/config.ts`.

## What works

- **Balances (Home):** shows each asset's available, pending and claiming amounts and their USD value, plus a total in USD. It shows how fresh the data is ("As of 12:27:29 · 9 s ago", with a warning after 60 s). There are loading, error-with-retry, refresh and "showing last data" states, and it refreshes automatically every 15 s.
- **Claim:** pick an asset, then type an amount or tap **Max** (the exact available amount). The amount is checked live against the API rules: format, decimal places, minimum and available, and the fee. You see the fee and **You receive**, choose a destination, review, then claim. The status screen polls until the claim completes or fails.
- **Safe claiming:** a stable Idempotency-Key is saved before sending. Timeouts, 5xx and 429 are retried automatically with the same key. A reload in the middle of a claim resumes it, and a double tap can't create two claims. Right after a claim, the balance drops once and doesn't jump back. See [NOTES.md](NOTES.md).
- **Activity & insights:** a 30-day payback chart (tap or hover a day for exact values), earned, reversed and claimed totals, top exchanges, filters by type and asset, and history grouped by day with "Load more".
- **Tests:** 36 unit tests in `src/lib/money.test.ts`, `src/lib/insights.test.ts` and `src/claims/submit.test.ts`.
