# Detailed Change Log for Branch bhavik

This document describes the implementation changes introduced on this branch compared to main, including architecture updates, API behavior changes, UI integration, authentication flow changes, and supporting scripts/data.

Generated on: 2026-03-17
Repository: hacknova-LegalAI
Branch: bhavik

## 1. High-Level Summary

The branch introduces a full agentic workflow for legal case processing (NyayaZephyr), Google OAuth integration for Gmail and Calendar operations, richer backend result shaping for human-readable case outputs, frontend controls for running and tracking agent workflows, live-status behavior, and output-cleaning improvements to avoid raw markdown/noisy scrape artifacts in UI.

## 2. File-by-File Detailed Changes

### Root and deployment/config files

1. .gitignore (modified)
- Added ignore rule for Backend/legal_researcher/client_secret.json to avoid committing OAuth client secret JSON.

2. package.json (added)
- Added root-level Node package manifest for workspace-level script/dependency support.

3. package-lock.json (added)
- Added lockfile for root package dependency reproducibility.

4. render.yaml (added)
- Added deployment configuration for backend service startup on Render.
- Sets Python runtime and backend start command with uvicorn.

5. README.md (modified)
- Updated project documentation to reflect expanded backend/frontend capabilities and setup details.

6. macos.md (added)
- Added macOS-specific setup/runtime notes.

7. scrape_indian_kanoon.py (added)
- Added standalone scraper utility for Indian Kanoon searches and document fetches.
- Supports Firecrawl-based scrape flow and local JSON output generation.

8. scrape_outputs/murder_scrape_1.json (added)
- Added captured sample scrape output set 1.

9. scrape_outputs/murder_scrape_2.json (added)
- Added captured sample scrape output set 2.

10. scrape_outputs/summary.json (added)
- Added summary metadata for scrape runs.

### Backend core API and orchestration

11. Backend/legal_researcher/api.py (modified)
- Integrated case composer output generation into research result pipeline.
- Extended research response objects to include formatted_output per case.
- Included agent router registration into standalone app bootstrap.
- Added favicon endpoint handling to suppress browser callback-page favicon 404 noise.

12. Backend/legal_researcher/api_agent.py (added, then further modified)
- Added complete agent API router under /legal/agent.
- Added endpoints for:
  - synchronous run
  - asynchronous run
  - run status polling
  - run history
  - Google OAuth start and callback
- Added run-state persistence logic in tenant DB (agent_state table usage).
- Added execution logging, stop-reason handling, timeout/recursion/rate-limit categorization, and response assembly helpers.
- Added formatted_cases response population using composer for run/status/history.
- OAuth robustness changes:
  - canonical redirect URI preference from env
  - support for user context transfer via OAuth state
  - callback no longer depends on JWT bearer header path for browser redirect flow
  - fallback user_id query support in callback path

13. Backend/legal_researcher/case_composer.py (added)
- Added deterministic formatter for case output with normalized sections:
  - title
  - details
  - judgement
  - summary
  - key_points
  - ai_message
  - other_sections
- Added agent-specific formatted case composition fallback behavior.
- Added text sanitization logic to clean markdown/scrape artifacts:
  - link markdown flattening
  - escaped character cleanup
  - heading/list marker stripping
  - boilerplate suppression (promo and utility blocks)
  - emphasis marker removal and line normalization

14. Backend/legal_researcher/database_manager.py (modified)
- Added/ensured schema support for:
  - google_credentials table
  - agent_state table
- Enables OAuth credential persistence and long-running agent state tracking.

15. Backend/legal_researcher/jwt_auth.py (modified)
- Added Request typing import for optional auth bearer implementation.
- Refined optional bearer dependency typing to avoid runtime/type inconsistencies.
- Supports flexible auth behavior used across development and callback flows.

16. Backend/legal_researcher/requirements.txt (modified)
- Added agent/OAuth related dependencies including:
  - langgraph
  - google-auth-oauthlib
  - google-api-python-client
- Supports graph orchestration and Google integrations.

17. Backend/legal_researcher/.env.example (modified)
- Updated environment template to include settings required by new agent and integration paths.

18. Backend/legal_researcher/translation.py (modified)
- Updated translation behavior/utilities as part of backend feature expansion.

### Backend agent package

19. Backend/legal_researcher/agent/__init__.py (added)
- Added package initialization for agent module.

20. Backend/legal_researcher/agent/agent_tools.py (added)
- Added tool definitions used by the agent graph:
  - legal precedent search
  - case-doc Q and A
  - claim verification
  - email send
  - calendar create/read

21. Backend/legal_researcher/agent/google_auth.py (added)
- Added Google OAuth flow bootstrap and credential serialization helpers.
- Uses client_secret.json and expected callback URI.

22. Backend/legal_researcher/agent/nyaya_agent.py (added)
- Added LangGraph-based agent runtime with nodes for:
  - context loading
  - model response/tool routing
  - legal research
  - QA
  - verification
  - email and calendar actions
- Added safeguards for max steps, tool hops, recursion/termination controls.
- Added structured execution logs for live/status views.

### Backend data, evaluation, tests, and migration helpers

23. Backend/legal_researcher/evaluate_ndcg.py (added)
- Added ranking evaluation utility for relevance quality checks.

24. Backend/legal_researcher/legal_pairs.json (added)
- Added dataset/config file for legal text/ranking workflows.

25. Backend/legal_researcher/multilingual_finetune.ipynb (added)
- Added notebook for multilingual finetuning experimentation.

26. Backend/legal_researcher/patch_connection.py (added)
- Added helper to patch/adjust connection behavior for backend DB/runtime paths.

27. Backend/legal_researcher/reranker.py (added)
- Added reranking utility used by research endpoint to reorder case results by relevance.

28. Backend/legal_researcher/test_system.py (added)
- Added system-level test script coverage for new backend behavior.

29. Backend/legal_researcher/test_turso_live.py (added)
- Added live Turso-related connectivity or behavior checks.

30. Backend/legal_researcher/test_out.txt (added)
- Added captured test output artifact.

31. Backend/rewrite_db.py (added)
- Added DB rewrite utility script.

32. Backend/test_turso.py (added)
- Added Turso test helper script.

33. Backend/test_turso_2.py (added)
- Added additional Turso test helper script.

34. Backend/legal_researcher/databases/lawyer_1.db (modified binary)
- SQLite DB content changed as a result of schema additions/runtime executions.
- Includes persisted runtime data and/or table creation side-effects from new features.

### Frontend app and integration

35. landing1/package.json (modified)
- Updated frontend dependencies/scripts to support newly integrated features.

36. landing1/package-lock.json (modified)
- Lockfile updated after dependency graph changes.

37. landing1/vercel.json (added)
- Added frontend deployment configuration for Vercel.

38. landing1/src/api/legalResearcher.ts (modified)
- Expanded API client with agent endpoints:
  - runAgent
  - runAgentAsync
  - getAgentRunStatus
  - getAgentHistory
  - startGoogleAuth
- Added interfaces for formatted case outputs and agent logs/history payloads.
- Added support for passing user_id during OAuth start call.
- Added timeout flexibility in safeFetch wrapper.

39. landing1/src/LegalResearcherPage.tsx (modified)
- Added full agent UI controls in case detail flow:
  - optional instructions
  - run trigger
  - live status/log panel
  - latest run summary
  - history panel with expand/collapse
  - Google connect action
- Added reusable ExpandableCaseOutputs renderer with section-level expanders.
- Replaced raw/flat research and agent case rendering with structured human-readable section cards.
- Added client-side text cleanup helper to sanitize display of legacy or noisy content.
- Updated OAuth connect call to send user id.

40. landing1/src/ClientsPage.tsx (modified)
- Updated case list/page behavior to align with expanded backend/frontend workflows.

41. landing1/src/DraftingAssistant.tsx (modified)
- Updated drafting assistant integration and/or UI behavior for new backend capabilities.

## 3. Key Functional Outcomes

1. Agentic legal workflow added end-to-end.
2. OAuth-based Google integration added for email/calendar actions.
3. Research and agent outputs transformed into structured, readable case sections.
4. Live run status, logs, and historical run inspection available in frontend.
5. OAuth callback flow hardened for browser-redirect context (without requiring incoming JWT header).
6. Markdown/scrape noise significantly reduced in UI output rendering.

## 4. Recent Fixes Applied Near End of Work

1. Redirect URI mismatch hardening
- Callback/start now uses canonical env-driven redirect URI handling.

2. OAuth callback Not authenticated fix
- Callback user resolution moved to OAuth state plus query fallback, so browser redirect can persist credentials.

3. Callback-page console cleanliness
- Added favicon route returning 204 to avoid callback-page favicon 404 console noise.

4. Output formatting cleanup
- Added stronger markdown/emphasis and boilerplate stripping in backend and frontend sanitizers.

## 5. Notes

- Some files are generated artifacts or runtime outputs (lockfiles, DB file, scrape outputs, test output file).
- Sensitive OAuth secret file is intentionally ignored by git through .gitignore.
- This document reflects branch-level changes relative to main and includes the most recent uncommitted updates as part of the same feature line.
