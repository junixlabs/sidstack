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
    // Detect Go framework
    try {
      const goMod = fs.readFileSync(path.join(projectPath, 'go.mod'), 'utf-8');
      if (goMod.includes('github.com/gin-gonic/gin')) stack.framework = 'Gin';
      else if (goMod.includes('github.com/labstack/echo')) stack.framework = 'Echo';
      else if (goMod.includes('github.com/gofiber/fiber')) stack.framework = 'Fiber';
    } catch {
      // Ignore
    }
  } else if (detectedFiles.includes('Cargo.toml')) {
    stack.language = 'Rust';
    // Detect Rust framework
    try {
      const cargo = fs.readFileSync(path.join(projectPath, 'Cargo.toml'), 'utf-8');
      if (cargo.includes('actix-web')) stack.framework = 'Actix';
      else if (cargo.includes('axum')) stack.framework = 'Axum';
      else if (cargo.includes('rocket')) stack.framework = 'Rocket';
      else if (cargo.includes('tauri')) stack.framework = 'Tauri';
    } catch {
      // Ignore
    }
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
  } else if (detectedFiles.includes('composer.json')) {
    // PHP detection
    stack.language = 'PHP';
    stack.packageManager = 'composer';

    try {
      const composer = JSON.parse(fs.readFileSync(path.join(projectPath, 'composer.json'), 'utf-8'));
      const deps = { ...composer.require, ...composer['require-dev'] };

      if (deps['laravel/framework']) stack.framework = 'Laravel';
      else if (deps['symfony/symfony'] || deps['symfony/framework-bundle']) stack.framework = 'Symfony';
      else if (deps['slim/slim']) stack.framework = 'Slim';
      else if (deps['yiisoft/yii2']) stack.framework = 'Yii2';
      else if (deps['cakephp/cakephp']) stack.framework = 'CakePHP';
    } catch {
      // Ignore
    }
  } else if (detectedFiles.includes('Gemfile')) {
    // Ruby detection
    stack.language = 'Ruby';
    stack.packageManager = 'bundler';

    try {
      const gemfile = fs.readFileSync(path.join(projectPath, 'Gemfile'), 'utf-8');
      if (gemfile.includes("'rails'") || gemfile.includes('"rails"')) stack.framework = 'Rails';
      else if (gemfile.includes("'sinatra'")) stack.framework = 'Sinatra';
      else if (gemfile.includes("'hanami'")) stack.framework = 'Hanami';
    } catch {
      // Ignore
    }
  } else if (detectedFiles.includes('pom.xml')) {
    // Java Maven detection
    stack.language = 'Java';
    stack.packageManager = 'maven';

    try {
      const pom = fs.readFileSync(path.join(projectPath, 'pom.xml'), 'utf-8');
      if (pom.includes('spring-boot')) stack.framework = 'Spring Boot';
      else if (pom.includes('quarkus')) stack.framework = 'Quarkus';
      else if (pom.includes('micronaut')) stack.framework = 'Micronaut';
    } catch {
      // Ignore
    }
  } else if (detectedFiles.includes('build.gradle')) {
    // Java/Kotlin Gradle detection
    stack.language = 'Java/Kotlin';
    stack.packageManager = 'gradle';

    try {
      const gradle = fs.readFileSync(path.join(projectPath, 'build.gradle'), 'utf-8');
      if (gradle.includes('spring-boot')) stack.framework = 'Spring Boot';
      else if (gradle.includes('android')) stack.framework = 'Android';
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
