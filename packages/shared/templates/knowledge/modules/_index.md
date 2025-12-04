---
id: modules-index
type: index
title: Module Documentation
created: {{date}}
---

# Module Documentation

Document the modules/packages in your project.

## Module Template

```markdown
---
id: module-name
type: module
status: active | deprecated
---

# Module: module-name

## Purpose
What this module does.

## Structure
```
module-name/
├── src/
│   ├── index.ts      # Entry point
│   ├── types.ts      # Type definitions
│   └── services/     # Business logic
├── tests/
└── package.json
```

## Dependencies
- Internal: [other-module]
- External: express, lodash

## Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, exports |
| `src/types.ts` | Type definitions |

## API
```typescript
// Main exports
export function doSomething(): Result
export class Service { }
```

## Usage
```typescript
import { doSomething } from 'module-name';
const result = doSomething();
```
```

## Modules

<!-- Add your module documents here -->
