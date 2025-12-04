use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Event payload for file system changes
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub action: String,  // "deleted", "renamed", "created"
    pub path: String,
    pub new_path: Option<String>,  // Only for rename
}

#[derive(Error, Debug)]
pub enum FileError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Not a file: {0}")]
    NotAFile(String),
    #[error("Binary file: {0}")]
    BinaryFile(String),
}

impl serde::Serialize for FileError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
    pub line_count: usize,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileTreeNode>>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub path: String,
    pub data: String,  // base64 encoded
    pub mime_type: String,
    pub size_bytes: u64,
}

/// Get file content with language detection
#[tauri::command]
pub async fn get_file_content(file_path: String) -> Result<FileContent, FileError> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(FileError::NotFound(file_path));
    }

    if !path.is_file() {
        return Err(FileError::NotAFile(file_path));
    }

    let metadata = fs::metadata(&path)?;
    let size_bytes = metadata.len();

    // Read content
    let content = fs::read_to_string(&path).map_err(|_| FileError::BinaryFile(file_path.clone()))?;

    let line_count = content.lines().count();
    let language = detect_language(&file_path);

    Ok(FileContent {
        path: file_path,
        content,
        language,
        line_count,
        size_bytes,
    })
}

/// Get image file as base64
#[tauri::command]
pub async fn get_image_base64(file_path: String) -> Result<ImageData, FileError> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(FileError::NotFound(file_path));
    }

    if !path.is_file() {
        return Err(FileError::NotAFile(file_path));
    }

    let metadata = fs::metadata(&path)?;
    let size_bytes = metadata.len();

    // Read binary content
    let content = fs::read(&path)?;
    let data = BASE64.encode(&content);

    // Detect MIME type from extension
    let mime_type = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    }.to_string();

    Ok(ImageData {
        path: file_path,
        data,
        mime_type,
        size_bytes,
    })
}

/// Get file tree for a directory
#[tauri::command]
pub async fn get_file_tree(
    dir_path: String,
    max_depth: Option<usize>,
) -> Result<FileTreeNode, FileError> {
    let path = Path::new(&dir_path);

    if !path.exists() {
        return Err(FileError::NotFound(dir_path));
    }

    let max_depth = max_depth.unwrap_or(3);
    build_file_tree(path, 0, max_depth)
}

fn build_file_tree(path: &Path, current_depth: usize, max_depth: usize) -> Result<FileTreeNode, FileError> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let is_dir = path.is_dir();

    let children = if is_dir && current_depth < max_depth {
        let mut nodes = Vec::new();

        let mut entries: Vec<_> = fs::read_dir(path)?
            .filter_map(|e| e.ok())
            .collect();

        // Sort: directories first, then alphabetically
        entries.sort_by(|a, b| {
            let a_is_dir = a.path().is_dir();
            let b_is_dir = b.path().is_dir();

            match (a_is_dir, b_is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.file_name().cmp(&b.file_name()),
            }
        });

        for entry in entries {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and common ignore patterns
            if entry_name.starts_with('.')
                || entry_name == "node_modules"
                || entry_name == "target"
                || entry_name == "dist"
                || entry_name == "build"
            {
                continue;
            }

            if let Ok(node) = build_file_tree(&entry_path, current_depth + 1, max_depth) {
                nodes.push(node);
            }
        }

        Some(nodes)
    } else {
        None
    };

    Ok(FileTreeNode {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        children,
        status: None,
    })
}

/// Detect programming language from file extension
fn detect_language(file_path: &str) -> String {
    let path = Path::new(file_path);
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    // Check special filenames first
    match file_name.as_str() {
        "Dockerfile" => return "dockerfile".to_string(),
        "Makefile" => return "makefile".to_string(),
        "CMakeLists.txt" => return "cmake".to_string(),
        "Cargo.toml" | "Cargo.lock" => return "toml".to_string(),
        "package.json" | "tsconfig.json" => return "json".to_string(),
        ".gitignore" | ".dockerignore" => return "ignore".to_string(),
        _ => {}
    }

    // Check extension
    match extension.as_str() {
        // JavaScript/TypeScript
        "js" => "javascript",
        "jsx" => "jsx",
        "ts" => "typescript",
        "tsx" => "tsx",
        "mjs" | "cjs" => "javascript",

        // Web
        "html" | "htm" => "html",
        "css" => "css",
        "scss" | "sass" => "scss",
        "less" => "less",
        "vue" => "vue",
        "svelte" => "svelte",

        // Systems
        "rs" => "rust",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "zig" => "zig",

        // Scripting
        "py" => "python",
        "rb" => "ruby",
        "php" => "php",
        "pl" | "pm" => "perl",
        "lua" => "lua",
        "sh" | "bash" | "zsh" => "bash",
        "ps1" => "powershell",

        // JVM
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "scala" => "scala",
        "groovy" => "groovy",
        "clj" | "cljs" => "clojure",

        // .NET
        "cs" => "csharp",
        "fs" | "fsx" => "fsharp",
        "vb" => "vb",

        // Data/Config
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        "ini" | "cfg" => "ini",
        "env" => "dotenv",

        // Markup
        "md" | "markdown" => "markdown",
        "rst" => "rst",
        "tex" => "latex",

        // Database
        "sql" => "sql",
        "graphql" | "gql" => "graphql",
        "prisma" => "prisma",

        // Other
        "proto" => "protobuf",
        "swift" => "swift",
        "r" => "r",
        "dart" => "dart",
        "ex" | "exs" => "elixir",
        "erl" | "hrl" => "erlang",
        "hs" => "haskell",
        "ml" | "mli" => "ocaml",
        "nim" => "nim",
        "v" => "v",
        "asm" | "s" => "asm",
        "wasm" | "wat" => "wasm",
        "dockerfile" => "dockerfile",
        "diff" | "patch" => "diff",

        _ => "plaintext",
    }
    .to_string()
}

/// Search for files matching a pattern
#[tauri::command]
pub async fn search_files(
    dir_path: String,
    pattern: String,
    max_results: Option<usize>,
) -> Result<Vec<String>, FileError> {
    let path = Path::new(&dir_path);
    let max_results = max_results.unwrap_or(100);
    let pattern = pattern.to_lowercase();

    let mut results = Vec::new();
    search_files_recursive(path, &pattern, &mut results, max_results)?;

    Ok(results)
}

fn search_files_recursive(
    dir: &Path,
    pattern: &str,
    results: &mut Vec<String>,
    max_results: usize,
) -> Result<(), FileError> {
    if results.len() >= max_results {
        return Ok(());
    }

    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        if results.len() >= max_results {
            break;
        }

        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden and common ignore patterns
        if name.starts_with('.')
            || name == "node_modules"
            || name == "target"
            || name == "dist"
        {
            continue;
        }

        if path.is_dir() {
            search_files_recursive(&path, pattern, results, max_results)?;
        } else if name.to_lowercase().contains(pattern) {
            results.push(path.to_string_lossy().to_string());
        }
    }

    Ok(())
}

/// Delete a file or folder
#[tauri::command]
pub async fn delete_file(app: AppHandle, path: String) -> Result<(), FileError> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(FileError::NotFound(path.clone()));
    }

    if file_path.is_dir() {
        fs::remove_dir_all(file_path)?;
    } else {
        fs::remove_file(file_path)?;
    }

    // Emit file change event
    let _ = app.emit("file-changed", FileChangeEvent {
        action: "deleted".to_string(),
        path: path.clone(),
        new_path: None,
    });

    Ok(())
}

/// Rename a file or folder
#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), FileError> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);

    if !old.exists() {
        return Err(FileError::NotFound(old_path));
    }

    fs::rename(old, new)?;
    Ok(())
}

/// Create a new file with optional content
#[tauri::command]
pub async fn create_file(path: String, content: Option<String>) -> Result<(), FileError> {
    let path = Path::new(&path);

    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    fs::write(path, content.unwrap_or_default())?;
    Ok(())
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), FileError> {
    let path = Path::new(&path);
    fs::create_dir_all(path)?;
    Ok(())
}

/// Check if a path exists
#[tauri::command]
pub async fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Read file content as string
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, FileError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(FileError::NotFound(path.to_string_lossy().to_string()));
    }
    fs::read_to_string(path).map_err(|_| FileError::BinaryFile(path.to_string_lossy().to_string()))
}

/// List all markdown files in a directory (recursive)
#[tauri::command]
pub async fn list_markdown_files(path: String) -> Result<Vec<String>, FileError> {
    let base_path = Path::new(&path);
    if !base_path.exists() {
        return Err(FileError::NotFound(path));
    }

    let mut files = Vec::new();
    collect_markdown_files(base_path, &mut files)?;
    Ok(files)
}

fn collect_markdown_files(dir: &Path, files: &mut Vec<String>) -> Result<(), FileError> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_markdown_files(&path, files)?;
        } else if name.ends_with(".md") {
            files.push(path.to_string_lossy().to_string());
        }
    }

    Ok(())
}

// =============================================================================
// Knowledge Validation Types
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeValidationResult {
    pub total_files: usize,
    pub valid_files: usize,
    pub invalid_files: usize,
    pub issues: Vec<KnowledgeFileIssue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeFileIssue {
    pub path: String,
    pub severity: String,  // "error", "warning", "info"
    pub message: String,
    pub line: Option<usize>,
}

/// Validate all knowledge files in a project
#[tauri::command]
pub async fn validate_knowledge_files(project_path: String) -> Result<KnowledgeValidationResult, FileError> {
    let knowledge_path = Path::new(&project_path).join(".sidstack").join("knowledge");

    if !knowledge_path.exists() {
        return Ok(KnowledgeValidationResult {
            total_files: 0,
            valid_files: 0,
            invalid_files: 0,
            issues: vec![KnowledgeFileIssue {
                path: knowledge_path.to_string_lossy().to_string(),
                severity: "error".to_string(),
                message: "Knowledge folder does not exist. Run init first.".to_string(),
                line: None,
            }],
        });
    }

    let mut files = Vec::new();
    collect_markdown_files(&knowledge_path, &mut files)?;

    let mut issues = Vec::new();
    let mut valid_count = 0;

    for file_path in &files {
        let path = Path::new(file_path);
        let relative_path = path.strip_prefix(&knowledge_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.clone());

        match validate_single_knowledge_file(file_path) {
            Ok(file_issues) => {
                if file_issues.is_empty() {
                    valid_count += 1;
                } else {
                    for mut issue in file_issues {
                        issue.path = relative_path.clone();
                        issues.push(issue);
                    }
                }
            }
            Err(e) => {
                issues.push(KnowledgeFileIssue {
                    path: relative_path,
                    severity: "error".to_string(),
                    message: format!("Failed to read file: {}", e),
                    line: None,
                });
            }
        }
    }

    let invalid_count = files.len() - valid_count;

    Ok(KnowledgeValidationResult {
        total_files: files.len(),
        valid_files: valid_count,
        invalid_files: invalid_count,
        issues,
    })
}

/// Validate a single knowledge file
fn validate_single_knowledge_file(file_path: &str) -> Result<Vec<KnowledgeFileIssue>, FileError> {
    let content = fs::read_to_string(file_path)?;
    let mut issues = Vec::new();

    // Check for frontmatter
    if !content.starts_with("---") {
        issues.push(KnowledgeFileIssue {
            path: String::new(),
            severity: "error".to_string(),
            message: "Missing YAML frontmatter (file must start with ---)".to_string(),
            line: Some(1),
        });
        return Ok(issues);
    }

    // Find frontmatter end
    let frontmatter_end = content[3..].find("\n---");
    if frontmatter_end.is_none() {
        issues.push(KnowledgeFileIssue {
            path: String::new(),
            severity: "error".to_string(),
            message: "Frontmatter not properly closed (missing closing ---)".to_string(),
            line: Some(1),
        });
        return Ok(issues);
    }

    let frontmatter_end = frontmatter_end.unwrap() + 3;
    let frontmatter_content = &content[4..frontmatter_end];

    // Parse frontmatter as YAML
    let yaml_result: Result<serde_yaml::Value, _> = serde_yaml::from_str(frontmatter_content);

    match yaml_result {
        Err(e) => {
            issues.push(KnowledgeFileIssue {
                path: String::new(),
                severity: "error".to_string(),
                message: format!("Invalid YAML frontmatter: {}", e),
                line: Some(2),
            });
        }
        Ok(yaml) => {
            // Check required fields
            if let serde_yaml::Value::Mapping(ref map) = yaml {
                // Check 'id' field
                if !map.contains_key(&serde_yaml::Value::String("id".to_string())) {
                    issues.push(KnowledgeFileIssue {
                        path: String::new(),
                        severity: "error".to_string(),
                        message: "Missing required field: id".to_string(),
                        line: Some(2),
                    });
                }

                // Check 'type' field
                if !map.contains_key(&serde_yaml::Value::String("type".to_string())) {
                    issues.push(KnowledgeFileIssue {
                        path: String::new(),
                        severity: "error".to_string(),
                        message: "Missing required field: type".to_string(),
                        line: Some(2),
                    });
                } else if let Some(type_value) = map.get(&serde_yaml::Value::String("type".to_string())) {
                    if let serde_yaml::Value::String(type_str) = type_value {
                        let valid_types = ["index", "business-logic", "api-endpoint", "design-pattern", "database-table", "module"];
                        if !valid_types.contains(&type_str.as_str()) {
                            issues.push(KnowledgeFileIssue {
                                path: String::new(),
                                severity: "warning".to_string(),
                                message: format!("Unknown type '{}'. Valid types: {:?}", type_str, valid_types),
                                line: Some(2),
                            });
                        }
                    }
                }

                // Check 'status' field if present
                if let Some(status_value) = map.get(&serde_yaml::Value::String("status".to_string())) {
                    if let serde_yaml::Value::String(status_str) = status_value {
                        let valid_statuses = ["draft", "implemented", "deprecated", "planned"];
                        if !valid_statuses.contains(&status_str.as_str()) {
                            issues.push(KnowledgeFileIssue {
                                path: String::new(),
                                severity: "warning".to_string(),
                                message: format!("Unknown status '{}'. Valid statuses: {:?}", status_str, valid_statuses),
                                line: Some(2),
                            });
                        }
                    }
                }
            }
        }
    }

    // Check content structure
    let body = &content[frontmatter_end + 4..];

    // Check for at least one heading
    if !body.contains("\n# ") && !body.starts_with("# ") {
        issues.push(KnowledgeFileIssue {
            path: String::new(),
            severity: "warning".to_string(),
            message: "Missing main heading (# Title)".to_string(),
            line: None,
        });
    }

    // Check for empty content
    if body.trim().is_empty() {
        issues.push(KnowledgeFileIssue {
            path: String::new(),
            severity: "warning".to_string(),
            message: "File has no content after frontmatter".to_string(),
            line: None,
        });
    }

    Ok(issues)
}

/// Fix common issues in knowledge files
#[tauri::command]
pub async fn fix_knowledge_file(file_path: String) -> Result<String, FileError> {
    let content = fs::read_to_string(&file_path)?;
    let mut fixed_content = content.clone();
    let mut fixes_applied = Vec::new();

    // Fix: Add frontmatter if missing
    if !content.starts_with("---") {
        let file_name = Path::new(&file_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let frontmatter = format!(
            "---\nid: {}\ntype: index\nstatus: draft\ncreated: {}\n---\n\n",
            file_name,
            chrono::Local::now().format("%Y-%m-%d")
        );
        fixed_content = format!("{}{}", frontmatter, content);
        fixes_applied.push("Added missing frontmatter");
    }

    // Fix: Ensure file ends with newline
    if !fixed_content.ends_with('\n') {
        fixed_content.push('\n');
        fixes_applied.push("Added trailing newline");
    }

    // Write fixed content
    if !fixes_applied.is_empty() {
        fs::write(&file_path, &fixed_content)?;
    }

    Ok(format!("Fixes applied: {:?}", fixes_applied))
}

/// List files with a specific extension in a directory
#[tauri::command]
pub async fn list_files_with_extension(path: String, extension: String) -> Result<Vec<String>, FileError> {
    let base_path = Path::new(&path);
    if !base_path.exists() {
        return Err(FileError::NotFound(path));
    }

    let mut files = Vec::new();
    collect_files_with_extension(base_path, &extension, &mut files)?;
    Ok(files)
}

fn collect_files_with_extension(dir: &Path, extension: &str, files: &mut Vec<String>) -> Result<(), FileError> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_files_with_extension(&path, extension, files)?;
        } else if name.ends_with(&format!(".{}", extension)) {
            files.push(path.to_string_lossy().to_string());
        }
    }

    Ok(())
}

/// Initialize knowledge folder with templates
#[tauri::command]
pub async fn init_knowledge_folder(project_path: String) -> Result<(), FileError> {
    let knowledge_path = Path::new(&project_path).join(".sidstack").join("knowledge");

    // Create main directories
    let dirs = ["business-logic", "api", "patterns", "database", "modules"];
    for dir in &dirs {
        fs::create_dir_all(knowledge_path.join(dir))?;
    }

    // Create index files with templates
    let templates = [
        ("_index.md", include_str!("../../../packages/shared/templates/knowledge/_index.md")),
        ("business-logic/_index.md", include_str!("../../../packages/shared/templates/knowledge/business-logic/_index.md")),
        ("api/_index.md", include_str!("../../../packages/shared/templates/knowledge/api/_index.md")),
        ("patterns/_index.md", include_str!("../../../packages/shared/templates/knowledge/patterns/_index.md")),
        ("database/_index.md", include_str!("../../../packages/shared/templates/knowledge/database/_index.md")),
        ("modules/_index.md", include_str!("../../../packages/shared/templates/knowledge/modules/_index.md")),
    ];

    for (rel_path, content) in &templates {
        let file_path = knowledge_path.join(rel_path);
        // Replace {{date}} placeholder with current date
        let content = content.replace("{{date}}", &chrono::Local::now().format("%Y-%m-%d").to_string());
        fs::write(file_path, content)?;
    }

    Ok(())
}
