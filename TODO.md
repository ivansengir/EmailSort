# TODO - EmailSort AI

## Core Product Requirements
- [x] Persist Gmail OAuth tokens after sign-in and support multiple Gmail accounts per user.
- [x] Build dashboard sections for account connections, category list, and new category workflow.
- [x] Implement category detail view listing imported emails with AI summaries and selection controls.
- [x] Provide email detail viewer to read full original content.
- [x] Implement bulk delete and unsubscribe actions across selected emails.
- [x] Build agent automation to follow unsubscribe links when present.
- [x] Import new emails from Gmail, categorize them with AI using category descriptions, and archive them in Gmail.
- [x] Generate AI summaries for each email stored.

## Platform & Infrastructure
- [x] Create Supabase Edge Functions covering email ingestion, Gmail token refresh, AI summarization, bulk actions, and unsubscribe agent orchestration.
- [ ] Define scheduled job (cron) for periodic Gmail sync per connected account.
- [x] Harden database layer with RPC helpers for category stats and email retrieval.
- [ ] Expand Supabase policies to cover new operations.

## Frontend Enhancements
- [x] Add Supabase data hooks/services for categories, accounts, emails, and bulk actions.
- [x] Add UI state management for selections and long-running tasks.
- [x] Provide user feedback (toasts, loaders) for background processes.
- [ ] Localize strings where needed and ensure accessibility basics.

## Testing & Quality
- [x] Integrate Vitest + Testing Library for component/unit tests.
- [ ] Add end-to-end smoke tests (Playwright) covering auth + core flows (mocks).
- [ ] Provide testing strategy for edge functions (unit mocks for Gmail/OpenAI).
- [ ] Update documentation (README, ESTADO_ACTUAL) with new instructions.

## Observability & Ops
- [x] Add logging and error tracking in edge functions.
- [x] Provide Supabase storage for unsubscribe artifacts/logs.
- [ ] Document environment variables and deployment steps for Vercel/Supabase.
