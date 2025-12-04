---
id: api-index
type: index
title: API Documentation
created: {{date}}
---

# API Documentation

Document your API endpoints, standards, and schemas here.

## Standards

### Naming Convention
- Use kebab-case for URLs: `/api/user-profiles`
- Use camelCase for JSON fields: `{ "firstName": "John" }`

### Response Format
```json
{
  "data": { },
  "meta": { "total": 100, "page": 1 }
}
```

### Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": []
  }
}
```

### HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

## Endpoint Template

```markdown
---
id: method-path-name
type: api-endpoint
method: GET | POST | PUT | PATCH | DELETE
path: /api/resource
module: module-name
status: implemented
version: v1
---

# METHOD /api/path

## Description
What this endpoint does.

## Request
```json
{
  "field": "type (required|optional)"
}
```

## Response (200)
```json
{
  "data": { }
}
```

## Errors
| Code | Description |
|------|-------------|
| 400 | Error description |

## Code Reference
- `src/routes/file.ts:line`
```

## Endpoints

<!-- Add your API endpoint documents here -->
