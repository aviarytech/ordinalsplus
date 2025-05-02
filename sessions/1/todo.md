* [ x ] Set timer **? min**
* [ x ] Prompt A → create/refresh `prd.md`
* [ x ] Prompt B → generate `tasks.md`
* [ ] Commit tasks
* [ ] Prompt C → add test stubs
* [ ] Write code + tests
* [ ] Commit after each finished task
* [ ] Prompt D → write session summary
* [ ] Final commit
* [ ] Push + open PR with summary
* [ ] (Optional) Prompt E for improvement


Vibe Code Session Script (≤ 80 char/line)
## 1 – Prep
- Pick a feature + strict time limit (e.g., 90 min).  
- Open editor + terminal in repo root.  
- Start a timer.

### Prompt A – Create / Update PRD
"Write a concise PRD for **<feature>**.  
Include: Purpose, User Stories, Acceptance Criteria, Risks.  
Max 400 words. Markdown. Lines ≤ 80 chars."

## 2 – Task Breakdown
### Prompt B – Task Master
"From this PRD, list tasks with:  
• ID, Description, Complexity (1–5), Dependencies.  
Break high‑complexity tasks into subtasks."

- Paste output into `tasks.md`.  
- Optional: `git add tasks.md && git commit -m "tasks"`.

## 3 – Test Plan
### Prompt C – TDD Skeleton
"Create test stubs for each task in <language>/<framework>.  
Return code fenced."

- Save as `tests/<feature>_spec.*`.

## 4 – Code
- Work through tasks, writing tests first.  
- Frequent small commits:  
  `git commit -a -m "task <ID> done"`.

## 5 – Wrap‑up
### Prompt D – Session Summary
"Summarize completed tasks, remaining work, and blockers in  
≤ 150 words. Markdown list."

- Final commit: `git commit -a -m "session summary"`.  
- Push branch + open PR.  
- Paste summary as PR description.

## 6 – Retrospective (optional, 5 min)
### Prompt E
"Suggest one improvement for the next vibe code session."