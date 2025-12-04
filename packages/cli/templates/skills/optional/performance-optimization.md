---
name: performance-optimization
description: Optional skill for implementing performance-conscious code and identifying optimization opportunities.
category: optional
priority: medium
---

# Performance Optimization Skill

Write performant code and identify optimization opportunities.

## Performance Principles

1. **Measure first** - Don't optimize without data
2. **Optimize bottlenecks** - Focus on hot paths
3. **Consider trade-offs** - Performance vs. readability/maintainability
4. **Test impact** - Verify improvements

## Common Optimizations

### 1. Database Queries

**Problem: N+1 Queries**
```typescript
// Bad - N+1 queries
const users = await userRepo.findAll();
for (const user of users) {
  user.orders = await orderRepo.findByUserId(user.id); // N queries
}

// Good - Single query with join
const users = await userRepo.findAllWithOrders();

// Or use DataLoader for GraphQL
const orderLoader = new DataLoader(async (userIds) => {
  const orders = await orderRepo.findByUserIds(userIds);
  return userIds.map(id => orders.filter(o => o.userId === id));
});
```

**Problem: Missing Indexes**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Composite index for common query patterns
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

**Problem: Fetching Too Much Data**
```typescript
// Bad - fetching all columns
const users = await db.query('SELECT * FROM users');

// Good - fetch only needed columns
const users = await db.query('SELECT id, name, email FROM users');

// Good - paginate large result sets
const users = await db.query(
  'SELECT id, name FROM users LIMIT $1 OFFSET $2',
  [pageSize, offset]
);
```

### 2. Caching

**In-Memory Caching**
```typescript
import { LRUCache } from 'lru-cache';

const userCache = new LRUCache<string, User>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

async function getUser(id: string): Promise<User> {
  const cached = userCache.get(id);
  if (cached) return cached;

  const user = await userRepo.findById(id);
  userCache.set(id, user);
  return user;
}
```

**Redis Caching**
```typescript
async function getUser(id: string): Promise<User> {
  // Try cache first
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  // Fetch from DB
  const user = await userRepo.findById(id);

  // Cache with TTL
  await redis.setex(`user:${id}`, 300, JSON.stringify(user));

  return user;
}

// Cache invalidation
async function updateUser(id: string, data: UpdateUserInput) {
  await userRepo.update(id, data);
  await redis.del(`user:${id}`); // Invalidate cache
}
```

### 3. Async Operations

**Parallel Execution**
```typescript
// Bad - sequential
const user = await getUser(userId);
const orders = await getOrders(userId);
const notifications = await getNotifications(userId);

// Good - parallel
const [user, orders, notifications] = await Promise.all([
  getUser(userId),
  getOrders(userId),
  getNotifications(userId),
]);
```

**Batch Operations**
```typescript
// Bad - individual inserts
for (const item of items) {
  await db.insert('items', item);
}

// Good - batch insert
await db.batchInsert('items', items);
```

### 4. Memory Management

**Streaming Large Data**
```typescript
// Bad - load all into memory
const allOrders = await orderRepo.findAll();
const csv = convertToCsv(allOrders);

// Good - stream processing
const stream = orderRepo.findAllStream();
const csvStream = stream.pipe(csvTransform);
csvStream.pipe(res);
```

**Avoid Memory Leaks**
```typescript
// Clean up event listeners
const handler = () => { /* ... */ };
emitter.on('event', handler);
// Later...
emitter.off('event', handler);

// Clean up timers
const timer = setInterval(() => { /* ... */ }, 1000);
// Later...
clearInterval(timer);
```

### 5. Algorithm Complexity

**Choose Right Data Structures**
```typescript
// Bad - O(n) lookup
const items = ['a', 'b', 'c', ...];
const hasItem = items.includes(searchItem); // O(n)

// Good - O(1) lookup
const itemSet = new Set(['a', 'b', 'c', ...]);
const hasItem = itemSet.has(searchItem); // O(1)

// Good - Map for key-value access
const userMap = new Map(users.map(u => [u.id, u]));
const user = userMap.get(userId); // O(1)
```

### 6. Network Optimization

**Compression**
```typescript
import compression from 'compression';
app.use(compression());
```

**Response Optimization**
```typescript
// Use appropriate response format
// JSON for APIs, gzip for large responses

// Pagination
app.get('/users', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const users = await userRepo.findPaginated(page, limit);
  res.json({
    data: users,
    pagination: { page, limit, total: users.total },
  });
});
```

## Performance Checklist

Before completing performance-sensitive code:

### Database
- [ ] Queries use indexes
- [ ] No N+1 queries
- [ ] Appropriate pagination
- [ ] Only needed columns fetched

### Caching
- [ ] Hot data cached appropriately
- [ ] Cache invalidation handled
- [ ] TTL set appropriately

### Memory
- [ ] Large data streamed
- [ ] No memory leaks
- [ ] Resources cleaned up

### Algorithms
- [ ] Appropriate data structures
- [ ] Reasonable complexity
- [ ] Batch operations where applicable

## When to Optimize

**Optimize when**:
- Performance requirements not met
- Profiling shows bottleneck
- Scaling issues identified

**Don't optimize when**:
- No performance requirement
- Code is clear and maintainable
- "Premature optimization"

## Profiling Tools

```bash
# Node.js profiling
node --prof app.js
node --prof-process isolate-*.log

# Memory profiling
node --inspect app.js
# Use Chrome DevTools Memory tab

# Database query analysis
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```
