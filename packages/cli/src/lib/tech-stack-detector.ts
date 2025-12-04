import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'yaml';

/**
 * Enhanced Tech Stack Detection
 * Detects languages, frameworks, databases, infrastructure, and more
 */

export interface EnhancedTechStack {
  languages: {
    primary: string;
    secondary: string[];
  };

  frontend?: {
    frameworks: string[];
    buildTools: string[];
    uiLibraries: string[];
    testing: string[];
  };

  backend?: {
    frameworks: string[];
    apiStyles: string[];
    testing: string[];
  };

  databases: {
    sql: string[];
    nosql: string[];
    graph: string[];
    vector: string[];
    cache: string[];
  };

  infrastructure: {
    containerization: string[];
    orchestration: string[];
    cicd: string[];
    monorepo?: string;
  };

  testing: string[];
  packageManager: string;

  projectStructure: {
    type: 'monorepo' | 'microservices' | 'standard';
    packages?: PackageInfo[];
  };

  // Flat list of all technologies for easy iteration
  all: TechnologyInfo[];
}

export interface PackageInfo {
  name: string;
  path: string;
  type: 'app' | 'library' | 'service';
  language: string;
}

export interface TechnologyInfo {
  name: string;
  type: 'language' | 'framework' | 'database' | 'tool' | 'library';
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'general';
  version?: string;
  role: 'primary' | 'secondary' | 'dev-only';
}

// Frontend frameworks and their indicators
const FRONTEND_FRAMEWORKS: Record<string, string[]> = {
  'React': ['react', 'react-dom'],
  'Next.js': ['next'],
  'Vue': ['vue'],
  'Nuxt': ['nuxt'],
  'Angular': ['@angular/core'],
  'Svelte': ['svelte'],
  'SvelteKit': ['@sveltejs/kit'],
  'Solid': ['solid-js'],
  'Astro': ['astro'],
  'Remix': ['@remix-run/react'],
  'Qwik': ['@builder.io/qwik'],
};

// Backend frameworks
const BACKEND_FRAMEWORKS: Record<string, string[]> = {
  'Express': ['express'],
  'NestJS': ['@nestjs/core'],
  'Fastify': ['fastify'],
  'Hono': ['hono'],
  'Koa': ['koa'],
  'Strapi': ['strapi'],
  'AdonisJS': ['@adonisjs/core'],
};

// Go frameworks (from go.mod)
const GO_FRAMEWORKS: Record<string, string[]> = {
  'Gin': ['github.com/gin-gonic/gin'],
  'Echo': ['github.com/labstack/echo'],
  'Chi': ['github.com/go-chi/chi'],
  'Fiber': ['github.com/gofiber/fiber'],
  'Gorilla Mux': ['github.com/gorilla/mux'],
};

// Python frameworks (from requirements.txt)
const PYTHON_FRAMEWORKS: Record<string, string[]> = {
  'Django': ['django'],
  'FastAPI': ['fastapi'],
  'Flask': ['flask'],
  'Starlette': ['starlette'],
  'Pyramid': ['pyramid'],
};

// Build tools
const BUILD_TOOLS: Record<string, string[]> = {
  'Vite': ['vite'],
  'Webpack': ['webpack'],
  'esbuild': ['esbuild'],
  'Turbopack': ['turbo'],
  'Rollup': ['rollup'],
  'Parcel': ['parcel'],
  'Snowpack': ['snowpack'],
};

// UI Libraries
const UI_LIBRARIES: Record<string, string[]> = {
  'Tailwind CSS': ['tailwindcss'],
  'Material-UI': ['@mui/material'],
  'Chakra UI': ['@chakra-ui/react'],
  'Ant Design': ['antd'],
  'shadcn/ui': ['@radix-ui/react-dialog'], // shadcn uses radix
  'Mantine': ['@mantine/core'],
  'Bootstrap': ['bootstrap', 'react-bootstrap'],
};

// Database indicators
const DATABASES: Record<string, { packages: string[]; category: 'sql' | 'nosql' | 'graph' | 'vector' | 'cache' }> = {
  'PostgreSQL': { packages: ['pg', 'postgres', 'postgresql', '@prisma/client'], category: 'sql' },
  'MySQL': { packages: ['mysql', 'mysql2'], category: 'sql' },
  'SQLite': { packages: ['sqlite3', 'better-sqlite3', 'sql.js'], category: 'sql' },
  'MongoDB': { packages: ['mongodb', 'mongoose'], category: 'nosql' },
  'Redis': { packages: ['redis', 'ioredis', 'redis-om'], category: 'cache' },
  'Neo4j': { packages: ['neo4j-driver', 'neo4j'], category: 'graph' },
  'ArangoDB': { packages: ['arangojs'], category: 'graph' },
  'Qdrant': { packages: ['@qdrant/js-client-rest', 'qdrant-client'], category: 'vector' },
  'Pinecone': { packages: ['@pinecone-database/pinecone'], category: 'vector' },
  'Weaviate': { packages: ['weaviate-ts-client'], category: 'vector' },
  'Memcached': { packages: ['memcached', 'memjs'], category: 'cache' },
};

// Testing frameworks
const TESTING_FRAMEWORKS: Record<string, string[]> = {
  'Jest': ['jest'],
  'Vitest': ['vitest'],
  'Mocha': ['mocha'],
  'Cypress': ['cypress'],
  'Playwright': ['@playwright/test', 'playwright'],
  'Testing Library': ['@testing-library/react', '@testing-library/vue'],
  'Supertest': ['supertest'],
};

// API styles
const API_STYLES: Record<string, string[]> = {
  'GraphQL': ['graphql', '@apollo/server', 'graphql-yoga', 'type-graphql'],
  'gRPC': ['@grpc/grpc-js', 'grpc'],
  'tRPC': ['@trpc/server'],
  'REST': [], // Default, detected by framework
};

// CI/CD platforms
const CICD_PLATFORMS: Record<string, string> = {
  '.github/workflows': 'GitHub Actions',
  '.gitlab-ci.yml': 'GitLab CI',
  '.circleci/config.yml': 'CircleCI',
  'Jenkinsfile': 'Jenkins',
  '.travis.yml': 'Travis CI',
  'azure-pipelines.yml': 'Azure Pipelines',
  'cloudbuild.yaml': 'Google Cloud Build',
  'bitbucket-pipelines.yml': 'Bitbucket Pipelines',
};

// Monorepo tools
const MONOREPO_TOOLS: Record<string, string> = {
  'turbo.json': 'Turborepo',
  'nx.json': 'Nx',
  'lerna.json': 'Lerna',
  'pnpm-workspace.yaml': 'pnpm Workspaces',
  'rush.json': 'Rush',
};

/**
 * Detect enhanced tech stack from project
 */
export async function detectEnhancedTechStack(projectPath: string): Promise<EnhancedTechStack> {
  const stack: EnhancedTechStack = {
    languages: { primary: 'Unknown', secondary: [] },
    databases: { sql: [], nosql: [], graph: [], vector: [], cache: [] },
    infrastructure: { containerization: [], orchestration: [], cicd: [] },
    testing: [],
    packageManager: 'npm',
    projectStructure: { type: 'standard' },
    all: [],
  };

  // Detect languages
  detectLanguages(projectPath, stack);

  // Detect package manager
  stack.packageManager = detectPackageManager(projectPath);

  // Parse package files for dependencies
  const deps = await collectDependencies(projectPath);

  // Detect frameworks and libraries
  detectFrontend(deps, stack);
  detectBackend(deps, projectPath, stack);
  detectDatabases(deps, projectPath, stack);
  detectTesting(deps, stack);
  detectAPIStyles(deps, stack);

  // Detect infrastructure
  detectInfrastructure(projectPath, stack);

  // Detect project structure (monorepo, microservices, etc.)
  detectProjectStructure(projectPath, stack);

  // Build flat list of all technologies
  buildAllTechnologies(stack);

  return stack;
}

/**
 * Detect primary and secondary languages
 */
function detectLanguages(projectPath: string, stack: EnhancedTechStack): void {
  const languages: string[] = [];

  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    // Check for TypeScript
    if (fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      languages.push('TypeScript');
    } else {
      languages.push('JavaScript');
    }
  }

  if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    languages.push('Go');
  }

  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    languages.push('Rust');
  }

  if (
    fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
    fs.existsSync(path.join(projectPath, 'pyproject.toml'))
  ) {
    languages.push('Python');
  }

  if (fs.existsSync(path.join(projectPath, 'pom.xml')) || fs.existsSync(path.join(projectPath, 'build.gradle'))) {
    languages.push('Java');
  }

  if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
    languages.push('PHP');
  }

  if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
    languages.push('Ruby');
  }

  if (fs.existsSync(path.join(projectPath, 'mix.exs'))) {
    languages.push('Elixir');
  }

  // Set primary and secondary
  if (languages.length > 0) {
    stack.languages.primary = languages[0];
    stack.languages.secondary = languages.slice(1);
  }
}

/**
 * Detect package manager
 */
function detectPackageManager(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(projectPath, 'Pipfile'))) return 'pipenv';
  if (fs.existsSync(path.join(projectPath, 'poetry.lock'))) return 'poetry';
  return 'npm';
}

/**
 * Collect all dependencies from various package files
 */
async function collectDependencies(projectPath: string): Promise<Map<string, string>> {
  const deps = new Map<string, string>();

  // Parse package.json
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(allDeps)) {
        deps.set(name, String(version));
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Also check monorepo packages
  const packagesDir = path.join(projectPath, 'packages');
  if (fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory()) {
    try {
      const packages = fs.readdirSync(packagesDir);
      for (const pkg of packages) {
        const subPkgPath = path.join(packagesDir, pkg, 'package.json');
        if (fs.existsSync(subPkgPath)) {
          const subPkg = JSON.parse(fs.readFileSync(subPkgPath, 'utf-8'));
          const subDeps = { ...subPkg.dependencies, ...subPkg.devDependencies };
          for (const [name, version] of Object.entries(subDeps)) {
            if (!deps.has(name)) {
              deps.set(name, String(version));
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return deps;
}

/**
 * Detect frontend frameworks, build tools, and UI libraries
 */
function detectFrontend(deps: Map<string, string>, stack: EnhancedTechStack): void {
  const frameworks: string[] = [];
  const buildTools: string[] = [];
  const uiLibraries: string[] = [];
  const testing: string[] = [];

  // Detect frameworks
  for (const [name, indicators] of Object.entries(FRONTEND_FRAMEWORKS)) {
    if (indicators.some((pkg) => deps.has(pkg))) {
      frameworks.push(name);
    }
  }

  // Detect build tools
  for (const [name, indicators] of Object.entries(BUILD_TOOLS)) {
    if (indicators.some((pkg) => deps.has(pkg))) {
      buildTools.push(name);
    }
  }

  // Detect UI libraries
  for (const [name, indicators] of Object.entries(UI_LIBRARIES)) {
    if (indicators.some((pkg) => deps.has(pkg))) {
      uiLibraries.push(name);
    }
  }

  // Detect frontend testing
  if (deps.has('cypress')) testing.push('Cypress');
  if (deps.has('@playwright/test')) testing.push('Playwright');
  if (deps.has('@testing-library/react')) testing.push('Testing Library');

  if (frameworks.length > 0 || buildTools.length > 0 || uiLibraries.length > 0) {
    stack.frontend = { frameworks, buildTools, uiLibraries, testing };
  }
}

/**
 * Detect backend frameworks and API styles
 */
function detectBackend(deps: Map<string, string>, projectPath: string, stack: EnhancedTechStack): void {
  const frameworks: string[] = [];
  const apiStyles: string[] = [];
  const testing: string[] = [];

  // Node.js frameworks
  for (const [name, indicators] of Object.entries(BACKEND_FRAMEWORKS)) {
    if (indicators.some((pkg) => deps.has(pkg))) {
      frameworks.push(name);
    }
  }

  // Go frameworks
  const goModPath = path.join(projectPath, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, 'utf-8');
      for (const [name, indicators] of Object.entries(GO_FRAMEWORKS)) {
        if (indicators.some((pkg) => content.includes(pkg))) {
          frameworks.push(name);
        }
      }
    } catch {
      // Ignore
    }
  }

  // Python frameworks
  const reqPath = path.join(projectPath, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
      for (const [name, indicators] of Object.entries(PYTHON_FRAMEWORKS)) {
        if (indicators.some((pkg) => content.includes(pkg))) {
          frameworks.push(name);
        }
      }
    } catch {
      // Ignore
    }
  }

  // Backend testing
  if (deps.has('supertest')) testing.push('Supertest');
  if (deps.has('jest')) testing.push('Jest');
  if (deps.has('vitest')) testing.push('Vitest');

  if (frameworks.length > 0) {
    // Default to REST if no specific API style detected
    if (apiStyles.length === 0) apiStyles.push('REST');
    stack.backend = { frameworks, apiStyles, testing };
  }
}

/**
 * Detect databases from dependencies and docker-compose
 */
function detectDatabases(deps: Map<string, string>, projectPath: string, stack: EnhancedTechStack): void {
  // From npm dependencies
  for (const [name, config] of Object.entries(DATABASES)) {
    if (config.packages.some((pkg) => deps.has(pkg))) {
      stack.databases[config.category].push(name);
    }
  }

  // From docker-compose.yml
  const dockerComposePaths = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

  for (const composePath of dockerComposePaths) {
    const fullPath = path.join(projectPath, composePath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const compose = yaml.parse(content);

        if (compose?.services) {
          for (const [serviceName, service] of Object.entries(compose.services as Record<string, { image?: string }>)) {
            const image = service?.image || serviceName;
            const imageLower = image.toLowerCase();

            if (imageLower.includes('postgres') && !stack.databases.sql.includes('PostgreSQL')) {
              stack.databases.sql.push('PostgreSQL');
            }
            if (imageLower.includes('mysql') && !stack.databases.sql.includes('MySQL')) {
              stack.databases.sql.push('MySQL');
            }
            if (imageLower.includes('mongo') && !stack.databases.nosql.includes('MongoDB')) {
              stack.databases.nosql.push('MongoDB');
            }
            if (imageLower.includes('redis') && !stack.databases.cache.includes('Redis')) {
              stack.databases.cache.push('Redis');
            }
            if (imageLower.includes('neo4j') && !stack.databases.graph.includes('Neo4j')) {
              stack.databases.graph.push('Neo4j');
            }
            if (imageLower.includes('qdrant') && !stack.databases.vector.includes('Qdrant')) {
              stack.databases.vector.push('Qdrant');
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
      break;
    }
  }
}

/**
 * Detect testing frameworks
 */
function detectTesting(deps: Map<string, string>, stack: EnhancedTechStack): void {
  for (const [name, indicators] of Object.entries(TESTING_FRAMEWORKS)) {
    if (indicators.some((pkg) => deps.has(pkg))) {
      if (!stack.testing.includes(name)) {
        stack.testing.push(name);
      }
    }
  }
}

/**
 * Detect API styles
 */
function detectAPIStyles(deps: Map<string, string>, stack: EnhancedTechStack): void {
  if (!stack.backend) return;

  for (const [name, indicators] of Object.entries(API_STYLES)) {
    if (indicators.length > 0 && indicators.some((pkg) => deps.has(pkg))) {
      if (!stack.backend.apiStyles.includes(name)) {
        stack.backend.apiStyles.push(name);
      }
    }
  }
}

/**
 * Detect infrastructure (Docker, CI/CD, etc.)
 */
function detectInfrastructure(projectPath: string, stack: EnhancedTechStack): void {
  // Docker
  if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
    stack.infrastructure.containerization.push('Docker');
  }
  if (
    fs.existsSync(path.join(projectPath, 'docker-compose.yml')) ||
    fs.existsSync(path.join(projectPath, 'docker-compose.yaml'))
  ) {
    stack.infrastructure.containerization.push('Docker Compose');
  }

  // Kubernetes
  if (fs.existsSync(path.join(projectPath, 'kubernetes')) || fs.existsSync(path.join(projectPath, 'k8s'))) {
    stack.infrastructure.orchestration.push('Kubernetes');
  }

  // Helm
  if (fs.existsSync(path.join(projectPath, 'helm')) || fs.existsSync(path.join(projectPath, 'charts'))) {
    stack.infrastructure.orchestration.push('Helm');
  }

  // CI/CD
  for (const [filePath, platform] of Object.entries(CICD_PLATFORMS)) {
    if (fs.existsSync(path.join(projectPath, filePath))) {
      stack.infrastructure.cicd.push(platform);
    }
  }

  // Monorepo tools
  for (const [file, tool] of Object.entries(MONOREPO_TOOLS)) {
    if (fs.existsSync(path.join(projectPath, file))) {
      stack.infrastructure.monorepo = tool;
      break;
    }
  }
}

/**
 * Detect project structure type
 */
function detectProjectStructure(projectPath: string, stack: EnhancedTechStack): void {
  const packages: PackageInfo[] = [];

  // Check for monorepo
  if (stack.infrastructure.monorepo) {
    stack.projectStructure.type = 'monorepo';

    // Scan packages directory
    const packagesDirs = ['packages', 'apps', 'libs'];
    for (const dir of packagesDirs) {
      const dirPath = path.join(projectPath, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        try {
          const items = fs.readdirSync(dirPath);
          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
              const pkgJsonPath = path.join(itemPath, 'package.json');
              const goModPath = path.join(itemPath, 'go.mod');

              let language = 'Unknown';
              let name = item;

              if (fs.existsSync(pkgJsonPath)) {
                language = fs.existsSync(path.join(itemPath, 'tsconfig.json')) ? 'TypeScript' : 'JavaScript';
                try {
                  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                  name = pkg.name || item;
                } catch {
                  // Use dir name
                }
              } else if (fs.existsSync(goModPath)) {
                language = 'Go';
              }

              packages.push({
                name,
                path: path.join(dir, item),
                type: dir === 'apps' ? 'app' : dir === 'libs' ? 'library' : 'app',
                language,
              });
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Check services directory for microservices
    const servicesDir = path.join(projectPath, 'services');
    if (fs.existsSync(servicesDir) && fs.statSync(servicesDir).isDirectory()) {
      try {
        const services = fs.readdirSync(servicesDir);
        for (const service of services) {
          const servicePath = path.join(servicesDir, service);
          if (fs.statSync(servicePath).isDirectory()) {
            let language = 'Unknown';
            if (fs.existsSync(path.join(servicePath, 'go.mod'))) {
              language = 'Go';
            } else if (fs.existsSync(path.join(servicePath, 'package.json'))) {
              language = fs.existsSync(path.join(servicePath, 'tsconfig.json')) ? 'TypeScript' : 'JavaScript';
            }

            packages.push({
              name: service,
              path: `services/${service}`,
              type: 'service',
              language,
            });
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  // Check for microservices pattern (services/ directory with multiple independent services)
  const servicesDir = path.join(projectPath, 'services');
  if (
    fs.existsSync(servicesDir) &&
    fs.statSync(servicesDir).isDirectory() &&
    stack.projectStructure.type !== 'monorepo'
  ) {
    try {
      const services = fs.readdirSync(servicesDir);
      const independentServices = services.filter((s) => {
        const servicePath = path.join(servicesDir, s);
        return (
          fs.statSync(servicePath).isDirectory() &&
          (fs.existsSync(path.join(servicePath, 'package.json')) ||
            fs.existsSync(path.join(servicePath, 'go.mod')) ||
            fs.existsSync(path.join(servicePath, 'Dockerfile')))
        );
      });

      if (independentServices.length >= 2) {
        stack.projectStructure.type = 'microservices';
      }
    } catch {
      // Ignore
    }
  }

  stack.projectStructure.packages = packages;
}

/**
 * Build flat list of all technologies for easy graph population
 */
function buildAllTechnologies(stack: EnhancedTechStack): void {
  const all: TechnologyInfo[] = [];

  // Languages
  all.push({
    name: stack.languages.primary,
    type: 'language',
    category: 'general',
    role: 'primary',
  });

  for (const lang of stack.languages.secondary) {
    all.push({
      name: lang,
      type: 'language',
      category: 'general',
      role: 'secondary',
    });
  }

  // Frontend
  if (stack.frontend) {
    for (const fw of stack.frontend.frameworks) {
      all.push({ name: fw, type: 'framework', category: 'frontend', role: 'primary' });
    }
    for (const tool of stack.frontend.buildTools) {
      all.push({ name: tool, type: 'tool', category: 'frontend', role: 'dev-only' });
    }
    for (const lib of stack.frontend.uiLibraries) {
      all.push({ name: lib, type: 'library', category: 'frontend', role: 'primary' });
    }
  }

  // Backend
  if (stack.backend) {
    for (const fw of stack.backend.frameworks) {
      all.push({ name: fw, type: 'framework', category: 'backend', role: 'primary' });
    }
  }

  // Databases
  for (const db of [...stack.databases.sql, ...stack.databases.nosql, ...stack.databases.graph, ...stack.databases.vector, ...stack.databases.cache]) {
    all.push({ name: db, type: 'database', category: 'database', role: 'primary' });
  }

  // Testing
  for (const test of stack.testing) {
    all.push({ name: test, type: 'tool', category: 'testing', role: 'dev-only' });
  }

  // Infrastructure
  for (const tool of [...stack.infrastructure.containerization, ...stack.infrastructure.cicd]) {
    all.push({ name: tool, type: 'tool', category: 'devops', role: 'dev-only' });
  }

  if (stack.infrastructure.monorepo) {
    all.push({ name: stack.infrastructure.monorepo, type: 'tool', category: 'devops', role: 'dev-only' });
  }

  stack.all = all;
}
