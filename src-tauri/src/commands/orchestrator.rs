use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

// =============================================================================
// Data Structures
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestAnalysisResult {
    pub intent: String,
    pub keywords: Vec<String>,
    #[serde(rename = "affectedAreas")]
    pub affected_areas: Vec<String>,
    #[serde(rename = "suggestedRoles")]
    pub suggested_roles: Vec<String>,
    #[serde(rename = "specContext")]
    pub spec_context: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParentTask {
    pub title: String,
    pub description: String,
    pub priority: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subtask {
    pub title: String,
    pub description: String,
    #[serde(rename = "suggestedRole")]
    pub suggested_role: String,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskBreakdownResult {
    #[serde(rename = "parentTask")]
    pub parent_task: ParentTask,
    pub subtasks: Vec<Subtask>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestPreview {
    pub analysis: RequestAnalysisResult,
    pub breakdown: TaskBreakdownResult,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestSubmitResult {
    pub success: bool,
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "createdTaskCount")]
    pub created_task_count: usize,
    pub error: Option<String>,
}

// =============================================================================
// Area Detection
// =============================================================================

fn detect_affected_areas(text: &str) -> Vec<String> {
    let lower_text = text.to_lowercase();
    let mut areas: Vec<String> = Vec::new();

    let area_keywords: &[(&str, &[&str])] = &[
        ("frontend", &["ui", "react", "component", "tailwind", "css", "style", "layout", "button", "form", "modal", "page", "view"]),
        ("backend", &["api", "endpoint", "server", "rust", "tauri", "command", "invoke", "handler", "route"]),
        ("database", &["sqlite", "database", "db", "table", "query", "schema", "migration", "model"]),
        ("orchestrator", &["task", "agent", "delegation", "workflow", "orchestrator", "breakdown", "assign"]),
        ("terminal", &["terminal", "pty", "session", "spawn", "claude", "prompt"]),
        ("specs", &["spec", "openspec", "requirement", "scenario", "proposal", "change"]),
    ];

    for (area, keywords) in area_keywords {
        for keyword in *keywords {
            if lower_text.contains(keyword) {
                if !areas.contains(&area.to_string()) {
                    areas.push(area.to_string());
                }
                break;
            }
        }
    }

    if areas.is_empty() {
        areas.push("frontend".to_string());
    }

    areas
}

fn get_suggested_roles(areas: &[String]) -> Vec<String> {
    let role_mapping: &[(&str, &str)] = &[
        ("frontend", "frontend"),
        ("backend", "backend"),
        ("database", "backend"),
        ("orchestrator", "orchestrator"),
        ("terminal", "backend"),
        ("specs", "orchestrator"),
    ];

    let mut roles: HashSet<String> = HashSet::new();

    for area in areas {
        for (a, role) in role_mapping {
            if a == area {
                roles.insert(role.to_string());
            }
        }
    }

    roles.into_iter().collect()
}

// =============================================================================
// Intent Detection
// =============================================================================

fn determine_intent(request: &str) -> String {
    let lower_request = request.to_lowercase();

    if lower_request.contains("fix") || lower_request.contains("bug") || lower_request.contains("error") {
        return "fix".to_string();
    }
    if lower_request.contains("add") || lower_request.contains("create") || lower_request.contains("implement") {
        return "add".to_string();
    }
    if lower_request.contains("update") || lower_request.contains("change") || lower_request.contains("modify") {
        return "update".to_string();
    }
    if lower_request.contains("remove") || lower_request.contains("delete") {
        return "remove".to_string();
    }
    if lower_request.contains("refactor") || lower_request.contains("improve") || lower_request.contains("optimize") {
        return "refactor".to_string();
    }
    if lower_request.contains("test") || lower_request.contains("verify") {
        return "test".to_string();
    }

    "add".to_string()
}

fn determine_priority(request: &str) -> String {
    let lower_request = request.to_lowercase();

    if lower_request.contains("urgent") || lower_request.contains("critical") || lower_request.contains("asap") {
        return "high".to_string();
    }
    if lower_request.contains("bug") || lower_request.contains("broken") || lower_request.contains("error") {
        return "high".to_string();
    }
    if lower_request.contains("minor") || lower_request.contains("low priority") || lower_request.contains("when you have time") {
        return "low".to_string();
    }

    "medium".to_string()
}

// =============================================================================
// Keyword Extraction
// =============================================================================

fn extract_keywords(request: &str) -> Vec<String> {
    let stop_words: HashSet<&str> = [
        "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
        "be", "been", "being", "have", "has", "had", "do", "does", "did",
        "will", "would", "could", "should", "may", "might", "must", "can",
        "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
        "into", "through", "during", "before", "after", "above", "below",
        "this", "that", "these", "those", "it", "its", "i", "me", "my",
        "we", "our", "you", "your", "he", "she", "they", "them", "their",
        "want", "need", "please", "help", "make", "create", "add", "update",
    ].iter().cloned().collect();

    let word_re = Regex::new(r"[a-zA-Z][a-zA-Z0-9-]*").unwrap();

    let words: Vec<String> = word_re
        .find_iter(&request.to_lowercase())
        .map(|m| m.as_str().to_string())
        .filter(|w| w.len() > 2 && !stop_words.contains(w.as_str()))
        .collect();

    // Deduplicate and limit
    let mut seen: HashSet<String> = HashSet::new();
    words
        .into_iter()
        .filter(|w| seen.insert(w.clone()))
        .take(15)
        .collect()
}

// =============================================================================
// Task Generation
// =============================================================================

fn generate_task_title(intent: &str, request: &str) -> String {
    let first_words: String = request.split_whitespace().take(6).collect::<Vec<_>>().join(" ");
    let prefix = match intent {
        "fix" => "Fix:",
        "add" => "Add:",
        "update" => "Update:",
        "remove" => "Remove:",
        "refactor" => "Refactor:",
        "test" => "Test:",
        _ => "Task:",
    };

    if request.len() > first_words.len() {
        format!("{} {}...", prefix, first_words)
    } else {
        format!("{} {}", prefix, first_words)
    }
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn generate_task_breakdown(request: &str, intent: &str, affected_areas: &[String]) -> TaskBreakdownResult {
    let priority = determine_priority(request);

    let role_mapping: &[(&str, &str)] = &[
        ("frontend", "frontend"),
        ("backend", "backend"),
        ("database", "backend"),
        ("orchestrator", "orchestrator"),
        ("terminal", "backend"),
        ("specs", "orchestrator"),
    ];

    let mut subtasks: Vec<Subtask> = Vec::new();

    for area in affected_areas {
        let role = role_mapping
            .iter()
            .find(|(a, _)| a == area)
            .map(|(_, r)| r.to_string())
            .unwrap_or_else(|| "frontend".to_string());

        let action = if intent == "fix" { "Fix" } else { "Implement" };
        let desc_preview = if request.len() > 100 { &request[..100] } else { request };

        subtasks.push(Subtask {
            title: format!("{} {} changes", capitalize_first(intent), area),
            description: format!("{} {}-related changes for: {}", action, area, desc_preview),
            suggested_role: role,
            dependencies: Vec::new(),
        });
    }

    // Add dependencies: backend should come before frontend
    let backend_idx = subtasks.iter().position(|t| t.suggested_role == "backend");
    let frontend_idx = subtasks.iter().position(|t| t.suggested_role == "frontend");

    if let (Some(bi), Some(fi)) = (backend_idx, frontend_idx) {
        if bi < fi {
            let backend_title = subtasks[bi].title.clone();
            subtasks[fi].dependencies.push(backend_title);
        }
    }

    TaskBreakdownResult {
        parent_task: ParentTask {
            title: generate_task_title(intent, request),
            description: request.to_string(),
            priority,
        },
        subtasks,
    }
}

// =============================================================================
// Spec Context (simplified - reads spec summaries)
// =============================================================================

fn get_spec_context(project_path: &str, _keywords: &[String]) -> String {
    let specs_path = Path::new(project_path).join("openspec").join("specs");

    if !specs_path.exists() {
        return "No specs found in project.".to_string();
    }

    let mut context_parts: Vec<String> = Vec::new();
    context_parts.push("# Project Specs Context\n".to_string());

    fn collect_specs(dir: &Path, parts: &mut Vec<String>, depth: usize) {
        if depth > 3 {
            return;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let spec_file = path.join("spec.md");
                    if spec_file.exists() {
                        if let Ok(content) = fs::read_to_string(&spec_file) {
                            // Extract title
                            let title_re = Regex::new(r"^#\s+(.+)$").ok();
                            let title = title_re
                                .and_then(|re| {
                                    content.lines().find_map(|line| {
                                        re.captures(line).map(|c| c.get(1).unwrap().as_str().to_string())
                                    })
                                })
                                .unwrap_or_else(|| path.file_name().unwrap().to_string_lossy().to_string());

                            // Extract first 200 chars of content
                            let preview: String = content.chars().take(200).collect();
                            parts.push(format!("## {}\n{}\n", title, preview));
                        }
                    }
                    collect_specs(&path, parts, depth + 1);
                }
            }
        }
    }

    collect_specs(&specs_path, &mut context_parts, 0);

    if context_parts.len() == 1 {
        return "No spec files found in project.".to_string();
    }

    context_parts.join("\n")
}

// =============================================================================
// Commands
// =============================================================================

/// Analyze a user request and return preview of task breakdown
#[tauri::command]
pub async fn analyze_request(project_path: String, request: String) -> Result<RequestPreview, String> {
    let intent = determine_intent(&request);
    let keywords = extract_keywords(&request);
    let affected_areas = detect_affected_areas(&request);
    let suggested_roles = get_suggested_roles(&affected_areas);
    let spec_context = get_spec_context(&project_path, &keywords);

    let analysis = RequestAnalysisResult {
        intent: intent.clone(),
        keywords,
        affected_areas: affected_areas.clone(),
        suggested_roles,
        spec_context,
    };

    let breakdown = generate_task_breakdown(&request, &intent, &affected_areas);

    Ok(RequestPreview { analysis, breakdown })
}

/// Submit a request to create tasks via API server
#[tauri::command]
pub async fn submit_request(_project_path: String, request: String) -> Result<RequestSubmitResult, String> {
    let intent = determine_intent(&request);
    let affected_areas = detect_affected_areas(&request);
    let breakdown = generate_task_breakdown(&request, &intent, &affected_areas);

    let request_id = format!(
        "req-{}-{}",
        chrono::Utc::now().timestamp(),
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    // Create HTTP client
    let client = reqwest::Client::new();
    let api_base = std::env::var("SIDSTACK_API_URL").unwrap_or_else(|_| "http://localhost:19432".to_string());

    // Create parent task
    let parent_task_payload = serde_json::json!({
        "title": breakdown.parent_task.title,
        "description": breakdown.parent_task.description,
        "projectId": "default",
        "priority": breakdown.parent_task.priority,
        "createdBy": "orchestrator"
    });

    let parent_response = client
        .post(format!("{}/api/tasks", api_base))
        .json(&parent_task_payload)
        .send()
        .await
        .map_err(|e| format!("Failed to create parent task: {}", e))?;

    if !parent_response.status().is_success() {
        return Ok(RequestSubmitResult {
            success: false,
            request_id,
            created_task_count: 0,
            error: Some("Failed to create parent task".to_string()),
        });
    }

    let parent_result: serde_json::Value = parent_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse parent task response: {}", e))?;

    let parent_task_id = parent_result["task"]["id"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Create subtasks if any
    let mut task_count = 1;
    if !breakdown.subtasks.is_empty() && !parent_task_id.is_empty() {
        let subtasks_payload: Vec<serde_json::Value> = breakdown
            .subtasks
            .iter()
            .map(|st| {
                serde_json::json!({
                    "title": st.title,
                    "description": st.description,
                    "priority": breakdown.parent_task.priority,
                    "assignedAgent": st.suggested_role
                })
            })
            .collect();

        let breakdown_response = client
            .post(format!("{}/api/tasks/{}/breakdown", api_base, parent_task_id))
            .json(&serde_json::json!({ "subtasks": subtasks_payload }))
            .send()
            .await;

        if let Ok(resp) = breakdown_response {
            if resp.status().is_success() {
                task_count += breakdown.subtasks.len();
            }
        }
    }

    Ok(RequestSubmitResult {
        success: true,
        request_id,
        created_task_count: task_count,
        error: None,
    })
}
