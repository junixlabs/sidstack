use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum OpenSpecError {
    #[error("OpenSpec directory not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for OpenSpecError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// =============================================================================
// Data Structures
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenSpecSummary {
    pub has_openspec: bool,
    pub change_count: usize,
    pub pending_count: usize,
    pub completed_count: usize,
    pub spec_count: usize,
    pub total_tasks: usize,
    pub completed_tasks: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenSpecTask {
    pub id: String,
    pub title: String,
    pub status: String, // "pending", "in_progress", "completed"
    pub phase: String,
}

/// Frontmatter data for change proposals
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ChangeFrontmatter {
    pub module: Option<String>,
    pub depends_on: Vec<String>,
    pub relates_to: Vec<String>,
    pub blocks: Vec<String>,
    pub tags: Vec<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub author: Option<String>,
    pub created: Option<String>,
    pub updated: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenSpecChange {
    pub id: String,
    pub title: String,
    pub status: String, // "draft", "pending", "in-progress", "completed", "archived"
    pub tasks: Vec<OpenSpecTask>,
    pub total_tasks: usize,
    pub completed_tasks: usize,
    pub progress: u8, // 0-100
    pub has_proposal: bool,
    pub has_design: bool,
    pub has_tasks: bool,
    // Frontmatter fields
    pub module: Option<String>,
    pub depends_on: Vec<String>,
    pub relates_to: Vec<String>,
    pub blocks: Vec<String>,
    pub tags: Vec<String>,
    pub priority: Option<String>,
    pub author: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Module definition from modules/ directory
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenSpecModule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub key_files: Vec<String>,
    pub change_count: usize,
    pub completed_count: usize,
    pub in_progress_count: usize,
    pub progress_percent: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpecFrontmatter {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub spec_type: Option<String>,
    pub status: Option<String>,
    pub depends_on: Vec<String>,
    pub relates_to: Vec<String>,
    pub implements: Vec<String>,
}

impl Default for SpecFrontmatter {
    fn default() -> Self {
        Self {
            id: None,
            spec_type: None,
            status: None,
            depends_on: Vec::new(),
            relates_to: Vec::new(),
            implements: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenSpecSpec {
    pub capability: String,
    pub path: String,
    pub has_spec: bool,
    pub frontmatter: SpecFrontmatter,
    pub title: Option<String>,
    pub summary: Option<String>,
}

// =============================================================================
// Commands
// =============================================================================

/// Get summary of openspec directory
#[tauri::command]
pub async fn get_openspec_summary(project_path: String) -> Result<OpenSpecSummary, OpenSpecError> {
    let openspec_path = Path::new(&project_path).join("openspec");

    if !openspec_path.exists() {
        return Ok(OpenSpecSummary {
            has_openspec: false,
            change_count: 0,
            pending_count: 0,
            completed_count: 0,
            spec_count: 0,
            total_tasks: 0,
            completed_tasks: 0,
        });
    }

    let changes_path = openspec_path.join("changes");
    let specs_path = openspec_path.join("specs");

    let mut change_count = 0;
    let mut pending_count = 0;
    let mut completed_count = 0;
    let mut total_tasks = 0;
    let mut completed_tasks = 0;

    // Count changes
    if changes_path.exists() {
        if let Ok(entries) = fs::read_dir(&changes_path) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    change_count += 1;

                    // Parse tasks.md if exists
                    let tasks_path = entry.path().join("tasks.md");
                    if tasks_path.exists() {
                        if let Ok(content) = fs::read_to_string(&tasks_path) {
                            let (total, completed) = count_tasks_in_markdown(&content);
                            total_tasks += total;
                            completed_tasks += completed;

                            if total > 0 && completed == total {
                                completed_count += 1;
                            } else if completed > 0 {
                                pending_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    // Count specs
    let mut spec_count = 0;
    if specs_path.exists() {
        if let Ok(entries) = fs::read_dir(&specs_path) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    spec_count += 1;
                }
            }
        }
    }

    Ok(OpenSpecSummary {
        has_openspec: true,
        change_count,
        pending_count,
        completed_count,
        spec_count,
        total_tasks,
        completed_tasks,
    })
}

/// Get all openspec changes with their tasks
#[tauri::command]
pub async fn get_openspec_changes(project_path: String) -> Result<Vec<OpenSpecChange>, OpenSpecError> {
    let changes_path = Path::new(&project_path).join("openspec").join("changes");

    if !changes_path.exists() {
        return Ok(vec![]);
    }

    let mut changes = Vec::new();

    if let Ok(entries) = fs::read_dir(&changes_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let change_id = entry.file_name().to_string_lossy().to_string();
                let change_path = entry.path();

                // Check which files exist
                let has_proposal = change_path.join("proposal.md").exists();
                let has_design = change_path.join("design.md").exists();
                let has_tasks = change_path.join("tasks.md").exists();

                // Parse tasks
                let mut tasks = Vec::new();
                let mut total_tasks = 0;
                let mut completed_tasks = 0;

                if has_tasks {
                    if let Ok(content) = fs::read_to_string(change_path.join("tasks.md")) {
                        tasks = parse_tasks_markdown(&content);
                        total_tasks = tasks.len();
                        completed_tasks = tasks.iter().filter(|t| t.status == "completed").count();
                    }
                }

                // Get title and frontmatter from proposal.md if exists
                let (title, frontmatter) = if has_proposal {
                    if let Ok(content) = fs::read_to_string(change_path.join("proposal.md")) {
                        let (fm, body) = parse_change_frontmatter(&content);
                        let title = extract_title_from_markdown(&body).unwrap_or_else(|| change_id.clone());
                        (title, fm)
                    } else {
                        (change_id.clone(), ChangeFrontmatter::default())
                    }
                } else {
                    (change_id.clone(), ChangeFrontmatter::default())
                };

                // Determine status - prefer frontmatter status if available
                let status = if let Some(ref fm_status) = frontmatter.status {
                    fm_status.clone()
                } else if total_tasks > 0 && completed_tasks == total_tasks {
                    "completed".to_string()
                } else if completed_tasks > 0 {
                    "in-progress".to_string()
                } else {
                    "draft".to_string()
                };

                let progress = if total_tasks > 0 {
                    ((completed_tasks as f32 / total_tasks as f32) * 100.0) as u8
                } else {
                    0
                };

                changes.push(OpenSpecChange {
                    id: change_id,
                    title,
                    status,
                    tasks,
                    total_tasks,
                    completed_tasks,
                    progress,
                    has_proposal,
                    has_design,
                    has_tasks,
                    // Frontmatter fields
                    module: frontmatter.module,
                    depends_on: frontmatter.depends_on,
                    relates_to: frontmatter.relates_to,
                    blocks: frontmatter.blocks,
                    tags: frontmatter.tags,
                    priority: frontmatter.priority,
                    author: frontmatter.author,
                    created_at: frontmatter.created,
                    updated_at: frontmatter.updated,
                });
            }
        }
    }

    // Sort by status: pending first, then draft, then completed
    changes.sort_by(|a, b| {
        let order = |s: &str| match s {
            "pending" => 0,
            "draft" => 1,
            "completed" => 2,
            _ => 3,
        };
        order(&a.status).cmp(&order(&b.status))
    });

    Ok(changes)
}

/// Get all openspec specs with frontmatter
#[tauri::command]
pub async fn get_openspec_specs(project_path: String) -> Result<Vec<OpenSpecSpec>, OpenSpecError> {
    let specs_path = Path::new(&project_path).join("openspec").join("specs");

    if !specs_path.exists() {
        return Ok(vec![]);
    }

    let mut specs = Vec::new();

    // Recursively find all spec.md files
    fn collect_specs(dir: &Path, base_path: &Path, specs: &mut Vec<OpenSpecSpec>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Check for spec.md in this directory
                    let spec_file = path.join("spec.md");
                    if spec_file.exists() {
                        // Build capability path relative to specs dir
                        let capability = path
                            .strip_prefix(base_path)
                            .unwrap_or(&path)
                            .to_string_lossy()
                            .to_string();

                        // Parse spec file for frontmatter
                        let (frontmatter, title, summary) = if let Ok(content) = fs::read_to_string(&spec_file) {
                            let (fm, body) = parse_spec_frontmatter(&content);
                            let title = extract_title_from_markdown(&body);
                            let summary = extract_summary_from_markdown(&body);
                            (fm, title, summary)
                        } else {
                            (SpecFrontmatter::default(), None, None)
                        };

                        specs.push(OpenSpecSpec {
                            capability,
                            path: spec_file.to_string_lossy().to_string(),
                            has_spec: true,
                            frontmatter,
                            title,
                            summary,
                        });
                    }

                    // Recurse into subdirectories
                    collect_specs(&path, base_path, specs);
                }
            }
        }
    }

    collect_specs(&specs_path, &specs_path, &mut specs);

    // Sort by capability name
    specs.sort_by(|a, b| a.capability.cmp(&b.capability));

    Ok(specs)
}

/// Get content of a specific file
#[tauri::command]
pub async fn get_openspec_file_content(file_path: String) -> Result<String, OpenSpecError> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(OpenSpecError::NotFound(file_path));
    }

    Ok(fs::read_to_string(path)?)
}

// =============================================================================
// Helpers
// =============================================================================

/// Count total and completed tasks in markdown content
fn count_tasks_in_markdown(content: &str) -> (usize, usize) {
    let completed_re = Regex::new(r"^\s*-\s*\[x\]").unwrap();
    let pending_re = Regex::new(r"^\s*-\s*\[\s?\]").unwrap();

    let mut total = 0;
    let mut completed = 0;

    for line in content.lines() {
        if completed_re.is_match(line) {
            total += 1;
            completed += 1;
        } else if pending_re.is_match(line) {
            total += 1;
        }
    }

    (total, completed)
}

/// Parse tasks from markdown content
fn parse_tasks_markdown(content: &str) -> Vec<OpenSpecTask> {
    let task_re = Regex::new(r"^\s*-\s*\[([ xX-])\]\s*\*\*([^*]+)\*\*(.*)$").unwrap();
    let phase_re = Regex::new(r"^###\s*Phase\s*\d+[:\s]*(.*)$").unwrap();

    let mut tasks = Vec::new();
    let mut current_phase = "General".to_string();
    let mut task_index = 0;

    for line in content.lines() {
        // Check for phase header
        if let Some(caps) = phase_re.captures(line) {
            current_phase = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            if current_phase.is_empty() {
                current_phase = "General".to_string();
            }
            continue;
        }

        // Check for task
        if let Some(caps) = task_re.captures(line) {
            let status_char = caps.get(1).map(|m| m.as_str()).unwrap_or(" ");
            let task_id = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");
            let title = caps.get(3).map(|m| m.as_str().trim()).unwrap_or("");

            let status = match status_char {
                "x" | "X" => "completed",
                "-" => "in_progress",
                _ => "pending",
            };

            // Clean up title - remove leading dash or colon
            let clean_title = title.trim_start_matches(|c| c == '-' || c == ':').trim();

            tasks.push(OpenSpecTask {
                id: task_id.to_string(),
                title: if clean_title.is_empty() {
                    task_id.to_string()
                } else {
                    clean_title.to_string()
                },
                status: status.to_string(),
                phase: current_phase.clone(),
            });

            task_index += 1;
        }
    }

    // If no structured tasks found, try simple checkbox format
    if tasks.is_empty() {
        let simple_re = Regex::new(r"^\s*-\s*\[([ xX-])\]\s*(.+)$").unwrap();

        for line in content.lines() {
            if let Some(caps) = simple_re.captures(line) {
                let status_char = caps.get(1).map(|m| m.as_str()).unwrap_or(" ");
                let title = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");

                let status = match status_char {
                    "x" | "X" => "completed",
                    "-" => "in_progress",
                    _ => "pending",
                };

                task_index += 1;
                tasks.push(OpenSpecTask {
                    id: format!("task-{}", task_index),
                    title: title.to_string(),
                    status: status.to_string(),
                    phase: current_phase.clone(),
                });
            }
        }
    }

    tasks
}

/// Extract title from markdown (first # heading)
fn extract_title_from_markdown(content: &str) -> Option<String> {
    let title_re = Regex::new(r"^#\s+(?:Proposal:\s*)?(.+)$").unwrap();

    for line in content.lines() {
        if let Some(caps) = title_re.captures(line) {
            return caps.get(1).map(|m| m.as_str().trim().to_string());
        }
    }

    None
}

/// Extract summary from markdown (first paragraph after ## Summary or first paragraph after title)
fn extract_summary_from_markdown(content: &str) -> Option<String> {
    let summary_re = Regex::new(r"##\s+Summary\n+([^\n#]+)").unwrap();

    if let Some(caps) = summary_re.captures(content) {
        return caps.get(1).map(|m| m.as_str().trim().to_string());
    }

    // Fall back to first paragraph after title
    let paragraph_re = Regex::new(r"^#[^\n]+\n+([^\n#]+)").unwrap();
    if let Some(caps) = paragraph_re.captures(content) {
        let text = caps.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        if text.len() > 200 {
            return Some(format!("{}...", &text[..200]));
        }
        return Some(text.to_string());
    }

    None
}

/// Parse YAML frontmatter from markdown content
fn parse_spec_frontmatter(content: &str) -> (SpecFrontmatter, String) {
    let frontmatter_re = Regex::new(r"^---\n([\s\S]*?)\n---\n([\s\S]*)$").unwrap();

    if let Some(caps) = frontmatter_re.captures(content) {
        let yaml_content = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let body = caps.get(2).map(|m| m.as_str()).unwrap_or(content);

        let mut frontmatter = SpecFrontmatter::default();

        for line in yaml_content.lines() {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() != 2 {
                continue;
            }

            let key = parts[0].trim();
            let value = parts[1].trim();

            match key {
                "id" => frontmatter.id = Some(value.to_string()),
                "type" => frontmatter.spec_type = Some(value.to_string()),
                "status" => frontmatter.status = Some(value.to_string()),
                "depends_on" => frontmatter.depends_on = parse_yaml_array(value),
                "relates_to" => frontmatter.relates_to = parse_yaml_array(value),
                "implements" => frontmatter.implements = parse_yaml_array(value),
                _ => {}
            }
        }

        (frontmatter, body.to_string())
    } else {
        (SpecFrontmatter::default(), content.to_string())
    }
}

/// Parse YAML array format [item1, item2] or empty
fn parse_yaml_array(value: &str) -> Vec<String> {
    if !value.starts_with('[') || !value.ends_with(']') {
        return Vec::new();
    }

    let inner = &value[1..value.len()-1];
    inner.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Parse YAML frontmatter from change proposal.md using serde_yaml
fn parse_change_frontmatter(content: &str) -> (ChangeFrontmatter, String) {
    // Check for frontmatter markers
    if !content.starts_with("---") {
        return (ChangeFrontmatter::default(), content.to_string());
    }

    // Find closing ---
    let rest = &content[3..];
    if let Some(end_pos) = rest.find("\n---") {
        let yaml_str = &rest[1..end_pos]; // Skip first newline
        let body = &rest[end_pos + 4..]; // Skip "\n---"

        // Try to parse with serde_yaml
        match serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
            Ok(yaml) => {
                let fm = ChangeFrontmatter {
                    module: yaml.get("module").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    depends_on: parse_yaml_string_array(&yaml, "depends_on"),
                    relates_to: parse_yaml_string_array(&yaml, "relates_to"),
                    blocks: parse_yaml_string_array(&yaml, "blocks"),
                    tags: parse_yaml_string_array(&yaml, "tags"),
                    priority: yaml.get("priority").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    status: yaml.get("status").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    author: yaml.get("author").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    created: yaml.get("created").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    updated: yaml.get("updated").and_then(|v| v.as_str()).map(|s| s.to_string()),
                };
                (fm, body.trim_start().to_string())
            }
            Err(e) => {
                eprintln!("Warning: Failed to parse frontmatter: {}", e);
                (ChangeFrontmatter::default(), content.to_string())
            }
        }
    } else {
        (ChangeFrontmatter::default(), content.to_string())
    }
}

/// Helper to parse YAML array from serde_yaml::Value
fn parse_yaml_string_array(yaml: &serde_yaml::Value, key: &str) -> Vec<String> {
    yaml.get(key)
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

// =============================================================================
// Module Commands
// =============================================================================

/// Get all modules with stats
#[tauri::command]
pub async fn get_openspec_modules(project_path: String) -> Result<Vec<OpenSpecModule>, OpenSpecError> {
    let modules_path = Path::new(&project_path).join("openspec").join("modules");

    if !modules_path.exists() {
        return Ok(vec![]);
    }

    // First, get all changes to compute stats per module
    let changes = get_openspec_changes(project_path.clone()).await?;

    let mut modules = Vec::new();

    if let Ok(entries) = fs::read_dir(&modules_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let module_id = entry.file_name().to_string_lossy().to_string();

                // Skip hidden directories
                if module_id.starts_with('.') || module_id.starts_with('_') {
                    continue;
                }

                let readme_path = entry.path().join("README.md");

                // Parse README.md for module info
                let (name, description, key_files) = if readme_path.exists() {
                    if let Ok(content) = fs::read_to_string(&readme_path) {
                        parse_module_readme(&content, &module_id)
                    } else {
                        (format_module_name(&module_id), String::new(), vec![])
                    }
                } else {
                    (format_module_name(&module_id), String::new(), vec![])
                };

                // Parse optional _config.yaml
                let config_path = entry.path().join("_config.yaml");
                let (icon, color) = if config_path.exists() {
                    if let Ok(content) = fs::read_to_string(&config_path) {
                        parse_module_config(&content)
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                };

                // Compute stats from changes
                let module_changes: Vec<_> = changes.iter()
                    .filter(|c| c.module.as_ref() == Some(&module_id))
                    .collect();

                let change_count = module_changes.len();
                let completed_count = module_changes.iter()
                    .filter(|c| c.status == "completed")
                    .count();
                let in_progress_count = module_changes.iter()
                    .filter(|c| c.status == "in-progress")
                    .count();

                let progress_percent = if change_count > 0 {
                    (completed_count as f32 / change_count as f32) * 100.0
                } else {
                    0.0
                };

                modules.push(OpenSpecModule {
                    id: module_id,
                    name,
                    description,
                    icon,
                    color,
                    key_files,
                    change_count,
                    completed_count,
                    in_progress_count,
                    progress_percent,
                });
            }
        }
    }

    // Sort by name
    modules.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(modules)
}

/// Get changes grouped by module
#[tauri::command]
pub async fn get_openspec_changes_by_module(
    project_path: String,
) -> Result<std::collections::HashMap<String, Vec<OpenSpecChange>>, OpenSpecError> {
    let changes = get_openspec_changes(project_path).await?;

    let mut grouped: std::collections::HashMap<String, Vec<OpenSpecChange>> = std::collections::HashMap::new();

    for change in changes {
        let module_key = change.module.clone().unwrap_or_else(|| "uncategorized".to_string());
        grouped.entry(module_key).or_default().push(change);
    }

    Ok(grouped)
}

// =============================================================================
// Module Helpers
// =============================================================================

/// Parse module README.md for name, description, and key files
fn parse_module_readme(content: &str, module_id: &str) -> (String, String, Vec<String>) {
    let name = extract_title_from_markdown(content)
        .unwrap_or_else(|| format_module_name(module_id));

    // Extract description from ## Overview section
    let overview_re = Regex::new(r"##\s+Overview\n+([^\n#]+(?:\n[^\n#]+)*)").unwrap();
    let description = if let Some(caps) = overview_re.captures(content) {
        caps.get(1)
            .map(|m| m.as_str().trim().to_string())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // Extract key files from ## Key Files section
    let key_files_re = Regex::new(r"-\s+`([^`]+)`").unwrap();
    let key_files: Vec<String> = key_files_re.captures_iter(content)
        .filter_map(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .take(5) // Limit to 5 key files
        .collect();

    (name, description, key_files)
}

/// Parse module _config.yaml for icon and color
fn parse_module_config(content: &str) -> (Option<String>, Option<String>) {
    match serde_yaml::from_str::<serde_yaml::Value>(content) {
        Ok(yaml) => {
            let icon = yaml.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string());
            let color = yaml.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
            (icon, color)
        }
        Err(_) => (None, None)
    }
}

/// Format module ID to display name (e.g., "terminal" -> "Terminal")
fn format_module_name(id: &str) -> String {
    let mut chars = id.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}
