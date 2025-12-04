import * as fs from 'fs';
import * as path from 'path';

export interface ProjectInfo {
  isNew: boolean;
  type: 'empty' | 'minimal' | 'existing';
  detectedFiles: string[];
  techStack?: {
    language?: string;
    framework?: string;
    packageManager?: string;
    database?: string;
  };
  hasReadme: boolean;
  hasPrd: boolean;
  prdPath?: string;
}

// Files that indicate an existing codebase
const SIGNIFICANT_FILES = [
  'package.json',
  'tsconfig.json',
  'go.mod',
  'Cargo.toml',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'Gemfile',
  'mix.exs',
];

// Common source directories
const SOURCE_DIRS = [
  'src', 'lib', 'app', 'pages', 'components', 'api', 'cmd', 'pkg',
  // Monorepo patterns
  'packages', 'apps', 'services', 'modules', 'libs',
  // Backend/Frontend separation
  'backend', 'frontend', 'server', 'client', 'web', 'mobile',
  // Domain-driven design
  'domain', 'infrastructure', 'application', 'presentation',
  // Other common patterns
  'internal', 'core', 'shared', 'common', 'utils',
];

// Files that are typically in empty/new projects
const IGNORE_FILES = ['.git', '.gitignore', 'LICENSE', 'README.md', '.DS_Store', 'node_modules'];

/**
 * Detect if a project is new (empty/minimal) or existing codebase
 */
export function detectProject(projectPath: string): ProjectInfo {
  const detectedFiles: string[] = [];
  let hasSignificantFiles = false;
  let hasSourceDirs = false;
  let hasReadme = false;
  let hasPrd = false;
  let prdPath: string | undefined;

  // Check for README
  if (fs.existsSync(path.join(projectPath, 'README.md'))) {
    hasReadme = true;
    detectedFiles.push('README.md');
  }

  // Check for PRD files
  const prdLocations = [
    'PRD.md',
    'docs/PRD.md',
    'prd.md',
    'docs/prd.md',
    'PRODUCT_REQUIREMENTS.md',
    'docs/PRODUCT_REQUIREMENTS.md',
  ];
  for (const loc of prdLocations) {
    const fullPath = path.join(projectPath, loc);
    if (fs.existsSync(fullPath)) {
      hasPrd = true;
      prdPath = fullPath;
      detectedFiles.push(loc);
      break;
    }
  }

  // Check for significant files
  for (const file of SIGNIFICANT_FILES) {
    if (fs.existsSync(path.join(projectPath, file))) {
      hasSignificantFiles = true;
      detectedFiles.push(file);
    }
  }

  // Check for source directories
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      hasSourceDirs = true;
      detectedFiles.push(`${dir}/`);
    }
  }

  // Count actual files (excluding ignored)
  let fileCount = 0;
  try {
    const entries = fs.readdirSync(projectPath);
    for (const entry of entries) {
      if (!IGNORE_FILES.includes(entry) && !entry.startsWith('.sidstack')) {
        fileCount++;
      }
    }
  } catch {
    // Ignore errors
  }

  // Determine project type
  let type: 'empty' | 'minimal' | 'existing';
  let isNew: boolean;

  if (fileCount === 0 || (fileCount <= 2 && !hasSignificantFiles)) {
    type = 'empty';
    isNew = true;
  } else if (!hasSignificantFiles && !hasSourceDirs) {
    type = 'minimal';
    isNew = true;
  } else {
    type = 'existing';
    isNew = false;
  }

  // Detect tech stack if existing
  let techStack: ProjectInfo['techStack'];
  if (!isNew) {
    techStack = detectTechStack(projectPath, detectedFiles);
  }

  return {
    isNew,
    type,
    detectedFiles,
    techStack,
    hasReadme,
    hasPrd,
    prdPath,
  };
}

/**
 * Detect tech stack from project files
 */
function detectTechStack(
  projectPath: string,
  detectedFiles: string[]
): ProjectInfo['techStack'] {
  const stack: ProjectInfo['techStack'] = {};

  // Detect language and package manager
  if (detectedFiles.includes('package.json')) {
    stack.language = 'TypeScript/JavaScript';
    stack.packageManager = detectNodePackageManager(projectPath);

    // Detect framework from package.json
    const pkgPath = path.join(projectPath, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) stack.framework = 'Next.js';
      else if (deps['nuxt']) stack.framework = 'Nuxt.js';
      else if (deps['react']) stack.framework = 'React';
      else if (deps['vue']) stack.framework = 'Vue';
      else if (deps['@angular/core']) stack.framework = 'Angular';
      else if (deps['express']) stack.framework = 'Express';
      else if (deps['nestjs'] || deps['@nestjs/core']) stack.framework = 'NestJS';
      else if (deps['fastify']) stack.framework = 'Fastify';
      else if (deps['hono']) stack.framework = 'Hono';
    } catch {
      // Ignore parse errors
    }
  } else if (detectedFiles.includes('go.mod')) {
    stack.language = 'Go';
  } else if (detectedFiles.includes('Cargo.toml')) {
    stack.language = 'Rust';
  } else if (
    detectedFiles.includes('requirements.txt') ||
    detectedFiles.includes('pyproject.toml')
  ) {
    stack.language = 'Python';
    stack.packageManager = 'pip';

    // Detect Python framework
    try {
      const reqPath = path.join(projectPath, 'requirements.txt');
      if (fs.existsSync(reqPath)) {
        const content = fs.readFileSync(reqPath, 'utf-8');
        if (content.includes('django')) stack.framework = 'Django';
        else if (content.includes('fastapi')) stack.framework = 'FastAPI';
        else if (content.includes('flask')) stack.framework = 'Flask';
      }
    } catch {
      // Ignore
    }
  }

  return stack;
}

/**
 * Detect Node.js package manager
 */
function detectNodePackageManager(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun';
  return 'npm';
}
