---
name: security-awareness
description: Optional skill for implementing security best practices and avoiding common vulnerabilities.
category: optional
priority: high
---

# Security Awareness Skill

Implement features with security in mind. Avoid common vulnerabilities.

## OWASP Top 10 Awareness

### 1. Injection (SQL, NoSQL, Command)

**Vulnerable**:
```typescript
// SQL Injection - NEVER do this
const query = `SELECT * FROM users WHERE email = '${email}'`;

// Command Injection - NEVER do this
exec(`convert ${userInput} output.png`);
```

**Secure**:
```typescript
// Parameterized queries
const user = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Use libraries that handle escaping
await sharp(validatedPath).toFile('output.png');
```

### 2. Broken Authentication

**Checklist**:
- [ ] Strong password requirements
- [ ] Rate limiting on login attempts
- [ ] Secure session management
- [ ] MFA where appropriate
- [ ] Secure password reset flow

```typescript
// Password hashing
import { hash, verify } from 'argon2';

async function createUser(password: string) {
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  // Store passwordHash, never the plain password
}

// Rate limiting
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts',
});
```

### 3. Sensitive Data Exposure

**Rules**:
- Never log sensitive data (passwords, tokens, PII)
- Encrypt data at rest and in transit
- Use secure protocols (HTTPS, TLS)
- Minimize data retention

```typescript
// Bad - logging sensitive data
logger.info(`User logged in: ${email}, password: ${password}`);

// Good - redact sensitive fields
logger.info(`User logged in: ${email}`);

// Use environment variables for secrets
const apiKey = process.env.API_KEY; // Never hardcode
```

### 4. XML External Entities (XXE)

**Disable external entity processing**:
```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  // Disable dangerous features
  allowBooleanAttributes: false,
  parseTagValue: false,
});
```

### 5. Broken Access Control

**Always verify authorization**:
```typescript
async function getOrder(userId: string, orderId: string) {
  const order = await orderRepo.findById(orderId);

  // Always check ownership
  if (order.userId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  return order;
}

// Role-based access
function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### 6. Security Misconfiguration

**Checklist**:
- [ ] Remove default credentials
- [ ] Disable debug mode in production
- [ ] Set security headers
- [ ] Keep dependencies updated
- [ ] Minimize attack surface

```typescript
// Security headers
import helmet from 'helmet';
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));

// Hide server info
app.disable('x-powered-by');
```

### 7. Cross-Site Scripting (XSS)

**Sanitize output**:
```typescript
// Use templating engines that auto-escape
// React, Vue, Angular auto-escape by default

// If manual, use DOMPurify
import DOMPurify from 'dompurify';
const safeHtml = DOMPurify.sanitize(userInput);

// Set CSP headers
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
}));
```

### 8. Insecure Deserialization

**Validate before deserializing**:
```typescript
// Use schema validation
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
});

function parseUser(data: unknown): User {
  return userSchema.parse(data);
}
```

### 9. Using Components with Known Vulnerabilities

**Keep dependencies secure**:
```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Use tools like Snyk or Dependabot
```

### 10. Insufficient Logging & Monitoring

**Log security events**:
```typescript
// Log authentication events
logger.info('login_success', { userId, ip: req.ip });
logger.warn('login_failed', { email, ip: req.ip, reason });

// Log authorization failures
logger.warn('access_denied', { userId, resource, action });

// Log suspicious activity
logger.error('rate_limit_exceeded', { ip: req.ip, endpoint });
```

## Security Checklist

Before completing any task:

### Input Handling
- [ ] All inputs validated
- [ ] SQL/NoSQL queries parameterized
- [ ] File paths validated
- [ ] URLs validated

### Authentication
- [ ] Passwords properly hashed
- [ ] Sessions managed securely
- [ ] Tokens have appropriate expiry

### Authorization
- [ ] Access control checked
- [ ] Resource ownership verified
- [ ] Roles/permissions enforced

### Data Protection
- [ ] Sensitive data encrypted
- [ ] No secrets in code/logs
- [ ] HTTPS enforced

### Headers & Config
- [ ] Security headers set
- [ ] CORS properly configured
- [ ] Debug mode disabled

## When to Escalate

Report to orchestrator/security team:
- Suspected vulnerability in existing code
- Unclear security requirements
- Need for security review
- Handling highly sensitive data
