# Technical Audit — Trace

Date: 2026-03-22
Auditor: Codex (GPT-5)

## Follow-up Status (2026-03-22)

Implemented after the initial audit:
- Fixed lint-blocking issues in `ImageModal` (no ESLint errors remain).
- Hardened user search path:
  - client-side sanitization via `sanitizeSearchQuery`
  - new DB migration `supabase/migrations/20260322123000_harden_search_users.sql`
  - wildcard-only query blocking and search rate limiting (`users_search`)

Still open:
- Dependency advisories for `next@16.1.6` remain. Attempted upgrade to `>=16.1.7`,
  but registry in this environment currently reports `16.1.6` as latest stable.

## 1. Scope and Method

Audit includes static code review and executable checks for:
- Code style and lint discipline
- TypeScript typing correctness
- Security (app code, DB/RLS/RPC, dependencies)
- Performance and runtime behavior
- Maintainability and operational readiness

Executed checks:
- `pnpm lint` -> failed (`2` errors, `27` warnings)
- `pnpm exec tsc --noEmit` -> passed
- `pnpm build` -> passed (after allowing network for Google Fonts)
- `pnpm audit --prod` -> failed with known `next` vulnerabilities (`5` advisories)

Repository shape at audit time:
- `src/` files: `111`
- `src/components/`: `30`
- `src/hooks/`: `31`
- `src/services/`: `12`
- Supabase migrations: `10`

## 2. Executive Summary

Project architecture is generally solid: clear separation between UI/hooks/services, React Query for server state, Zustand for shared realtime/storage state, and DB-level controls via Supabase RLS + RPC.

Main blockers before production hardening:
1. Vulnerable `next` version (`16.1.6`) with published security advisories.
2. Lint-blocking logic errors in `ImageModal` (hooks/state-in-effect rules).
3. Search RPC can be abused for broad user enumeration (`SECURITY DEFINER` + unescaped `ILIKE`).
4. Upload validation contract is inconsistent and can reject all uploads during config fetch failures.
5. Message mutation logic is split between RPC and direct table updates, weakening backend invariants over time.

## 3. Findings by Severity

## Critical

### C1. Framework dependency vulnerabilities (`next` < `16.1.7`)
- Evidence:
  - `package.json:38` -> `"next": "^16.1.6"`
  - `pnpm audit --prod` reports 5 advisories (4 moderate, 1 low), all fixed in `>=16.1.7`
- Impact:
  - Exposes application to known upstream issues (request smuggling, DoS vectors, CSRF bypass conditions in specific contexts).
- Recommendation:
  - Upgrade `next` and `eslint-config-next` to `16.1.7+` and rerun `pnpm build`, `pnpm lint`, `pnpm audit --prod`.

### C2. Lint-blocking hooks correctness issue in image modal
- Evidence:
  - `src/components/chat/ImageModal.tsx:39` -> synchronous state update inside effect
  - `src/components/chat/ImageModal.tsx:125` + `:131` -> conditional hook call path (`useMemo` after early return)
  - Confirmed by `pnpm lint` failure
- Impact:
  - Risk of unstable rendering behavior and regressions under React Compiler/hook rules.
  - CI/release gates fail when lint is required.
- Recommendation:
  - Refactor state sync to derived state or keyed remount strategy.
  - Ensure all hooks are declared before any conditional early returns.

## High

### H1. User-search RPC enables broad email enumeration patterns
- Evidence:
  - `supabase/migrations/20260321154500_fix_users_search_policy.sql:23` -> `SECURITY DEFINER`
  - `...:43` -> `u.email ILIKE '%' || trim(p_query) || '%'`
  - `...:49` -> execute granted to authenticated users
  - Client sends raw trimmed query: `src/services/contacts/contacts.service.ts:16`
- Impact:
  - `%`/`_` wildcard probes can enumerate users faster than intended.
  - Function bypasses table-RLS intent by design (definer privileges).
- Recommendation:
  - Escape `%`/`_` (`sanitizeSearchQuery` exists but is not used).
  - Add server-side guardrails (rate limit, min entropy, prefix-only search, stricter result caps).
  - Consider `SECURITY INVOKER` + policy-driven access if feasible.

### H2. Upload validation contract mismatch and fail-closed UX path
- Evidence:
  - `src/config/storage.config.ts:47` defines MIME list in `uploadAllowedExtensions`
  - `src/utils/file-validation.ts:4-9` validates by filename extension against that MIME list
  - `src/hooks/useDynamicStorageConfig.ts:99-100` returns invalid when config is unavailable (`Service temporarily unavailable`)
- Impact:
  - Validation utility can produce false negatives due to MIME-vs-extension mismatch.
  - Temporary API/storage config failure blocks all uploads client-side.
- Recommendation:
  - Rename config field to `allowedMimeTypes` and align all validators.
  - Provide resilient fallback policy for offline/config-failure mode.

### H3. Mutation path inconsistency (RPC vs direct table writes)
- Evidence:
  - Service RPC methods exist: `src/services/chat/messages.service.ts:90`, `:130`
  - UI hooks bypass RPC and write directly:
    - `src/hooks/chat/useDeleteMessage.ts:19-20`
    - `src/hooks/chat/useEditMessage.ts:19-20`
- Impact:
  - Business rules can drift when logic is split across DB RPC and client table mutations.
  - Future server-side controls added to RPC may be silently bypassed by direct writes.
- Recommendation:
  - Standardize one write path for message mutations (prefer RPC for invariant-heavy operations).
  - Remove dead/unused mutation functions to avoid accidental divergence.

## Medium

### M1. `MessageMediaGrid` has race-prone async effect and expensive state churn
- Evidence:
  - `src/components/chat/MessageMediaGrid.tsx:83` -> `forEach(async ...)` inside effect without cancellation control
  - Repeated map cloning and key scans: `:100`, `:115`, `:122`, `:154`, `:165`, `:177`
- Impact:
  - Potential stale updates after unmount/prop change.
  - Extra CPU work under large media batches, leading to jank on weaker devices.
- Recommendation:
  - Use `Promise.allSettled` with abort/cancel guards.
  - Move per-item media state updates to keyed reducer or batched writes.

### M2. Type safety is weakened by broad casting patterns
- Evidence:
  - `src/services/chat/messages.service.ts:40` -> `as unknown as Message[]`
  - `src/hooks/chat/useChatEvents.ts:36` -> `state as unknown as PresenceState`
  - Multiple `as FullChat` casts in service/query layers
- Impact:
  - Runtime shape mismatches can bypass compile-time checks.
  - Harder refactors and less reliable domain contracts.
- Recommendation:
  - Validate external payloads at boundaries (zod or narrow type guards) before casting.
  - Reduce `unknown as` to explicit schema parsing for DB/RPC responses.

### M3. Unused validation layer / dead code increases maintenance cost
- Evidence:
  - `src/hooks/useDebouncedSearch.ts` exists but no runtime usage outside itself.
  - `searchSchema` in `src/lib/validations/chat.ts:71` effectively not part of active search flow.
- Impact:
  - Security/validation assumptions may be false because code is not on execution path.
- Recommendation:
  - Either wire these validators into real search flow or remove dead modules.

### M4. Scroll position hook currently does not track real scroll state
- Evidence:
  - `src/hooks/ui/useScrollPosition.ts:24` function unused
  - `:30-31` hardcodes bottom state values in check logic
- Impact:
  - Consumer code may rely on inaccurate `isAtBottom` / percentage semantics.
- Recommendation:
  - Implement real Virtuoso scroll callbacks or delete unused hook to avoid confusion.

## Low

### L1. Environment template has duplicated variable entry
- Evidence:
  - `.env.example:8` and `.env.example:10` both define `SUPABASE_SERVICE_ROLE_KEY`
- Impact:
  - Developer confusion in setup and secret handling.
- Recommendation:
  - Keep a single canonical entry with clear server-only annotation.

### L2. Quality command mutates source during checks
- Evidence:
  - `package.json:13` -> `"check": "biome check --write ./src && pnpm lint"`
- Impact:
  - CI/local checks may introduce source diffs unexpectedly.
- Recommendation:
  - Split into non-mutating `check` and explicit `format:fix` command.

## 4. Positive Observations

- `tsconfig` strict mode enabled and typecheck currently clean.
- Realtime/chat state management is thoughtfully layered (`services` + `hooks` + cache helpers).
- DB rate limit config is centralized and access to config table is locked to `service_role`:
  - `supabase/migrations/20260321153000_limits_tuning_and_schema_cleanup.sql:173-174`
- Auth callback validates redirect path to local route-only values:
  - `src/app/auth/callback/route.ts` (`safeNext`)

## 5. Production Readiness Checklist

Minimum before production rollout:
1. Upgrade Next.js to patched version (`>=16.1.7`) and re-audit dependencies.
2. Fix lint errors in `ImageModal` and make lint pass cleanly.
3. Harden user-search RPC against wildcard enumeration.
4. Unify message mutation path (RPC or direct table writes, not both).
5. Align upload validation contract and add resilient fallback behavior.

Recommended next:
1. Add tests for:
   - chat/message mutation invariants
   - upload validation matrix (mime/size/count/config-failure)
   - search RPC abuse cases (`%`, `_`, high-frequency queries)
2. Add CI gates: `lint`, `tsc --noEmit`, `build`, `audit`.

## 6. Suggested 7-Day Remediation Plan

Day 1-2:
- Upgrade `next` and related packages; fix breakages.
- Resolve `ImageModal` hook violations.

Day 3-4:
- Refactor search RPC + query sanitization.
- Consolidate message mutation API path.

Day 5:
- Repair upload validation model and fallback logic.

Day 6-7:
- Add minimum automated test suite + CI workflow.

## 7. Notes and Limitations

- This audit is based on code inspection + local command execution.
- No end-to-end runtime load testing was performed.
- Build initially failed in sandbox due blocked network fetch for Google Fonts, then succeeded with network access.
