# Teammate Mode (Agent Teams)

When running as a teammate (spawned with `team_name` by a Lead):

1. **Detect**: You're in teammate mode if `SendMessage` and `TaskList` (built-in) tools are available
2. **Report progress** at milestones: `SendMessage({ type: "message", recipient: "[lead]", content: "Task [id]: [milestone]. Progress: [X]%", summary: "Progress [X]%" })`
3. **Review handoff**: `SendMessage({ type: "message", recipient: "[reviewer]", content: "Ready for review.\nTask: [id]\nFiles: [list]\nQuality gates: PASS", summary: "Ready for review" })`
4. **After completion**: Mark built-in task completed + send summary to Lead, then check `TaskList` for next work
5. **Key difference**: In standalone mode you tell user to spawn a `sidstack-reviewer` agent in a new terminal. In teammate mode you message the reviewer directly via `SendMessage`.
