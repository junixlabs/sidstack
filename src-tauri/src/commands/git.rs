use git2::{DiffOptions, Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    #[error("Repository not found at path: {0}")]
    RepoNotFound(String),
    #[error("Git command failed: {0}")]
    CommandFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub status: FileStatus,
    pub additions: u32,
    pub deletions: u32,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    pub origin: char,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStatus {
    pub branch: String,
    pub is_clean: bool,
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
}

/// Get diff between working directory and a base branch
#[tauri::command]
pub async fn get_diff(
    workspace_path: String,
    base_branch: Option<String>,
) -> Result<Vec<FileDiff>, GitError> {
    let repo = Repository::open(&workspace_path)
        .map_err(|_| GitError::RepoNotFound(workspace_path.clone()))?;

    let mut diffs = Vec::new();

    // Get diff options
    let mut diff_opts = DiffOptions::new();
    diff_opts.include_untracked(true);

    // Get the base tree (either specified branch or HEAD)
    let base_tree = if let Some(ref branch_name) = base_branch {
        let reference = repo.find_branch(branch_name, git2::BranchType::Local)?;
        let commit = reference.get().peel_to_commit()?;
        Some(commit.tree()?)
    } else {
        match repo.head() {
            Ok(head) => {
                let commit = head.peel_to_commit()?;
                Some(commit.tree()?)
            }
            Err(_) => None,
        }
    };

    // Get diff
    let diff = repo.diff_tree_to_workdir_with_index(base_tree.as_ref(), Some(&mut diff_opts))?;

    // Process each delta
    diff.foreach(
        &mut |delta, _progress| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let status = match delta.status() {
                git2::Delta::Added => FileStatus::Added,
                git2::Delta::Deleted => FileStatus::Deleted,
                git2::Delta::Modified => FileStatus::Modified,
                git2::Delta::Renamed => FileStatus::Renamed,
                git2::Delta::Untracked => FileStatus::Untracked,
                _ => FileStatus::Modified,
            };

            diffs.push(FileDiff {
                path,
                status,
                additions: 0,
                deletions: 0,
                hunks: Vec::new(),
            });

            true
        },
        None,
        None,
        None,
    )?;

    // Get line stats
    let stats = diff.stats()?;
    let _insertions = stats.insertions();
    let _deletions = stats.deletions();

    Ok(diffs)
}

/// Get detailed diff with hunks and lines
#[tauri::command]
pub async fn get_file_diff(
    workspace_path: String,
    file_path: String,
    base_branch: Option<String>,
) -> Result<FileDiff, GitError> {
    let repo = Repository::open(&workspace_path)
        .map_err(|_| GitError::RepoNotFound(workspace_path.clone()))?;

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let base_tree = if let Some(ref branch_name) = base_branch {
        let reference = repo.find_branch(branch_name, git2::BranchType::Local)?;
        let commit = reference.get().peel_to_commit()?;
        Some(commit.tree()?)
    } else {
        match repo.head() {
            Ok(head) => {
                let commit = head.peel_to_commit()?;
                Some(commit.tree()?)
            }
            Err(_) => None,
        }
    };

    let diff = repo.diff_tree_to_workdir_with_index(base_tree.as_ref(), Some(&mut diff_opts))?;

    let mut file_diff = FileDiff {
        path: file_path.clone(),
        status: FileStatus::Modified,
        additions: 0,
        deletions: 0,
        hunks: Vec::new(),
    };

    // Use print to iterate through diff content
    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        // Update status from delta
        if let Some(status) = match delta.status() {
            git2::Delta::Added => Some(FileStatus::Added),
            git2::Delta::Deleted => Some(FileStatus::Deleted),
            git2::Delta::Modified => Some(FileStatus::Modified),
            git2::Delta::Renamed => Some(FileStatus::Renamed),
            _ => None,
        } {
            file_diff.status = status;
        }

        // Handle hunk header
        if let Some(h) = hunk {
            // Check if this is a new hunk
            let hunk_header = DiffHunk {
                old_start: h.old_start(),
                old_lines: h.old_lines(),
                new_start: h.new_start(),
                new_lines: h.new_lines(),
                lines: Vec::new(),
            };

            // Add new hunk if needed
            if file_diff.hunks.is_empty()
                || file_diff.hunks.last().map(|last| last.old_start != h.old_start()).unwrap_or(true)
            {
                file_diff.hunks.push(hunk_header);
            }
        }

        // Handle line content
        let origin = line.origin();
        if origin == '+' {
            file_diff.additions += 1;
        } else if origin == '-' {
            file_diff.deletions += 1;
        }

        if let Some(current_hunk) = file_diff.hunks.last_mut() {
            if origin == '+' || origin == '-' || origin == ' ' {
                current_hunk.lines.push(DiffLine {
                    origin,
                    content: String::from_utf8_lossy(line.content()).to_string(),
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });
            }
        }

        true
    })?;

    Ok(file_diff)
}

/// List all branches in repository
#[tauri::command]
pub async fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, GitError> {
    let repo =
        Repository::open(&repo_path).map_err(|_| GitError::RepoNotFound(repo_path.clone()))?;

    let mut branches = Vec::new();
    let head = repo.head().ok();
    let head_name = head
        .as_ref()
        .and_then(|h| h.shorthand())
        .map(String::from);

    for branch_result in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_head = head_name.as_ref().map(|h| h == &name).unwrap_or(false);

        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(String::from));

        let (ahead, behind) = if let (Some(local), Ok(up)) = (
            branch.get().target(),
            branch.upstream().and_then(|u| Ok(u.get().target())),
        ) {
            if let Some(remote) = up {
                repo.graph_ahead_behind(local, remote).unwrap_or((0, 0))
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        branches.push(BranchInfo {
            name,
            is_head,
            upstream,
            ahead,
            behind,
        });
    }

    Ok(branches)
}

/// Get commit log for a branch
#[tauri::command]
pub async fn get_commit_log(
    repo_path: String,
    branch: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CommitInfo>, GitError> {
    let repo =
        Repository::open(&repo_path).map_err(|_| GitError::RepoNotFound(repo_path.clone()))?;

    let limit = limit.unwrap_or(50);

    let reference = if let Some(ref branch_name) = branch {
        repo.find_branch(branch_name, git2::BranchType::Local)?
            .into_reference()
    } else {
        repo.head()?
    };

    let mut revwalk = repo.revwalk()?;
    revwalk.push(reference.target().unwrap())?;

    let commits: Vec<CommitInfo> = revwalk
        .take(limit)
        .filter_map(|oid| {
            oid.ok().and_then(|id| {
                repo.find_commit(id).ok().map(|commit| CommitInfo {
                    id: id.to_string(),
                    message: commit.message().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("").to_string(),
                    time: commit.time().seconds(),
                })
            })
        })
        .collect();

    Ok(commits)
}

/// Get repository status
#[tauri::command]
pub async fn get_repo_status(repo_path: String) -> Result<RepoStatus, GitError> {
    let repo =
        Repository::open(&repo_path).map_err(|_| GitError::RepoNotFound(repo_path.clone()))?;

    let head = repo.head()?;
    let branch = head.shorthand().unwrap_or("HEAD").to_string();

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut staged = Vec::new();
    let mut modified = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
            staged.push(path.clone());
        }

        if status.is_wt_modified() || status.is_wt_deleted() {
            modified.push(path.clone());
        }

        if status.is_wt_new() {
            untracked.push(path);
        }
    }

    let is_clean = staged.is_empty() && modified.is_empty() && untracked.is_empty();

    // Compute ahead/behind relative to upstream
    let (ahead, behind) = {
        let head_ref = repo.head().ok();
        if let Some(ref h) = head_ref {
            if let Some(local_oid) = h.target() {
                // Try to find upstream branch
                let branch_name = h.shorthand().unwrap_or("HEAD");
                if let Ok(local_branch) = repo.find_branch(branch_name, git2::BranchType::Local) {
                    if let Ok(upstream) = local_branch.upstream() {
                        if let Some(remote_oid) = upstream.get().target() {
                            repo.graph_ahead_behind(local_oid, remote_oid).unwrap_or((0, 0))
                        } else {
                            (0, 0)
                        }
                    } else {
                        (0, 0)
                    }
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        }
    };

    Ok(RepoStatus {
        branch,
        is_clean,
        staged,
        modified,
        untracked,
        ahead,
        behind,
    })
}

/// Run a git command in a specific directory.
/// Used for operations not supported by git2 (e.g., worktree commands).
#[tauri::command]
pub async fn run_git_command(cwd: String, args: Vec<String>) -> Result<String, GitError> {
    let output = Command::new("git")
        .current_dir(&cwd)
        .args(&args)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(GitError::CommandFailed(stderr.to_string()))
    }
}

/// Run a shell command (non-git).
/// Used for opening external applications (VS Code, Terminal, Finder, etc.)
#[tauri::command]
pub async fn run_shell_command(command: String, args: Vec<String>) -> Result<String, GitError> {
    let output = Command::new(&command)
        .args(&args)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(GitError::CommandFailed(stderr.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Helper to create a test git repository
    fn create_test_repo() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize git repo
        let repo = Repository::init(&repo_path).expect("Failed to init repo");

        // Create initial commit
        let sig = git2::Signature::now("Test", "test@test.com").expect("Failed to create signature");

        // Create a file
        fs::write(repo_path.join("README.md"), "# Test Project").expect("Failed to write file");

        // Stage and commit
        let mut index = repo.index().expect("Failed to get index");
        index.add_path(std::path::Path::new("README.md")).expect("Failed to add file");
        index.write().expect("Failed to write index");

        let tree_id = index.write_tree().expect("Failed to write tree");
        let tree = repo.find_tree(tree_id).expect("Failed to find tree");

        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .expect("Failed to commit");

        (temp_dir, repo_path)
    }

    #[tokio::test]
    async fn test_list_branches() {
        let (_temp_dir, repo_path) = create_test_repo();

        let branches = list_branches(repo_path.to_string_lossy().to_string())
            .await
            .expect("Failed to list branches");

        assert!(!branches.is_empty());
        // Should have at least main or master branch
        let has_default = branches.iter().any(|b| b.name == "main" || b.name == "master");
        assert!(has_default, "Should have a default branch");
    }

    #[tokio::test]
    async fn test_get_repo_status_clean() {
        let (_temp_dir, repo_path) = create_test_repo();

        let status = get_repo_status(repo_path.to_string_lossy().to_string())
            .await
            .expect("Failed to get status");

        assert!(status.is_clean);
        assert!(status.staged.is_empty());
        assert!(status.modified.is_empty());
        assert!(status.untracked.is_empty());
    }

    #[tokio::test]
    async fn test_get_repo_status_with_changes() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Modify the file
        fs::write(repo_path.join("README.md"), "# Modified").expect("Failed to write file");

        // Add a new untracked file
        fs::write(repo_path.join("new_file.txt"), "New content").expect("Failed to write file");

        let status = get_repo_status(repo_path.to_string_lossy().to_string())
            .await
            .expect("Failed to get status");

        assert!(!status.is_clean);
        assert!(status.modified.contains(&"README.md".to_string()));
        assert!(status.untracked.contains(&"new_file.txt".to_string()));
    }

    #[tokio::test]
    async fn test_get_diff() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Modify the file
        fs::write(repo_path.join("README.md"), "# Modified Content").expect("Failed to write file");

        let diffs = get_diff(repo_path.to_string_lossy().to_string(), None)
            .await
            .expect("Failed to get diff");

        assert!(!diffs.is_empty());
        let readme_diff = diffs.iter().find(|d| d.path == "README.md");
        assert!(readme_diff.is_some(), "Should have diff for README.md");
    }

    #[tokio::test]
    async fn test_get_file_diff() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Modify the file
        fs::write(
            repo_path.join("README.md"),
            "# Modified\n\nNew line added",
        )
        .expect("Failed to write file");

        let diff = get_file_diff(
            repo_path.to_string_lossy().to_string(),
            "README.md".to_string(),
            None,
        )
        .await
        .expect("Failed to get file diff");

        assert_eq!(diff.path, "README.md");
        assert!(diff.additions > 0 || diff.deletions > 0);
    }

    #[tokio::test]
    async fn test_get_commit_log() {
        let (_temp_dir, repo_path) = create_test_repo();

        let commits = get_commit_log(repo_path.to_string_lossy().to_string(), None, Some(10))
            .await
            .expect("Failed to get commit log");

        assert!(!commits.is_empty());
        assert!(commits[0].message.contains("Initial commit"));
        assert_eq!(commits[0].author, "Test");
    }

    #[tokio::test]
    async fn test_repo_not_found() {
        let result = list_branches("/nonexistent/path".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_file_status_variants() {
        let (_temp_dir, repo_path) = create_test_repo();
        let repo = Repository::open(&repo_path).expect("Failed to open repo");
        let sig = git2::Signature::now("Test", "test@test.com").expect("Failed to create signature");

        // Add a new file and stage it
        fs::write(repo_path.join("added.txt"), "Added content").expect("Failed to write file");
        let mut index = repo.index().expect("Failed to get index");
        index.add_path(std::path::Path::new("added.txt")).expect("Failed to add file");
        index.write().expect("Failed to write index");

        // Get diff - should show added file
        let diffs = get_diff(repo_path.to_string_lossy().to_string(), None)
            .await
            .expect("Failed to get diff");

        let added_file = diffs.iter().find(|d| d.path == "added.txt");
        assert!(added_file.is_some());
    }
}
