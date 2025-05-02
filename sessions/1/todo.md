# Vibe Code Session TODO

- [ x ] **Init repo for Task Master**  
      `task-master init`
- [ x ] **Create feature branch**  
      `git checkout -b feat/<feature>-vibe`
- [ x ] **Set session timer (__ min)**
- [ x ] **Prompt A – Draft / refresh PRD**  
      "Write a concise PRD for **__feature__** including Purpose,  
      User Stories, Acceptance Criteria, Risks.  
      Max 400 words. Markdown. Lines ≤ 80 chars."  
      ⬇ save as `scripts/<feature>-prd.txt`
- [ x ] **Parse PRD into tasks**  
      `task-master parse-prd scripts/<feature>-prd.txt`
- [ x ] **Analyze complexity**  
      `task-master analyze-complexity`
- [ x ] **Expand high‑complexity tasks**  
      `task-master expand`
- [ x ] **Regenerate task files**  
      `task-master generate`
- [ x ] **Commit tasks**  
      `git add scripts tasks && git commit -m "tasks"`
- [ x ] **Prompt C – Create test stubs**  
      "Create test stubs for each task in <lang>/<framework>. save under `tests/` of the respective package"
- [ x ] **Commit tests**  
      `git add tests && git commit -m "tests"`
- [ ] **Work loop (repeat until timer ends)**  
      - [ ] `task-master next` – view top task  
      - [ ] Write failing test  
      - [ ] Write code to pass test  
      - [ ] Run tests  
      - [ ] `task-master complete --id=<id>`  
      - [ ] `git commit -a -m "task <id>: done"`
- [ ] **Prompt D – Session summary**  
      "Summarize completed tasks, remaining work, blockers  
      in ≤ 150 words. Markdown list."  
      ⬇ save as `summary.md`
- [ ] **Final commit**  
      `git commit -a -m "session summary"`
- [ ] **Push branch & open PR**  
      `git push -u origin HEAD`  
      ⬇ paste `summary.md` as PR description
- [ ] **Prompt E – Retro**  
      "Suggest one improvement for the next vibe code session."