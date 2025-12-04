---
name: implementation-analysis
description: Skill for systematic analysis of data structures, algorithms, and edge cases before implementing new modules or features.
category: core
priority: high
---

# Implementation Analysis Skill

Before implementing any new module, feature, or component, you MUST complete this systematic analysis to ensure optimal data structure selection, algorithm design, and edge case handling.

## When to Apply This Skill

- Implementing a new module or component
- Adding significant new functionality
- Refactoring existing data structures
- Optimizing performance-critical code
- Designing APIs or data models

## Phase 1: Problem Decomposition

Before choosing any solution, clearly define:

### Input Analysis
- **Types**: What data types are accepted?
- **Formats**: What formats/structures (JSON, arrays, maps)?
- **Constraints**: Size limits, validation rules, optional fields?
- **Source**: Where does the data come from?

### Output Analysis
- **Types**: What data types are returned?
- **Formats**: What structure for consumers?
- **Guarantees**: Ordering, uniqueness, completeness?
- **Error cases**: What errors can be returned?

### Operations Required
- [ ] Create (insert, add)
- [ ] Read (get, find, search)
- [ ] Update (modify, replace)
- [ ] Delete (remove)
- [ ] List/enumerate
- [ ] Sort/order
- [ ] Filter/query
- [ ] Aggregate (count, sum, etc.)

### Performance Requirements
- **Latency**: Response time requirements?
- **Throughput**: Operations per second?
- **Memory**: Memory constraints?
- **Concurrency**: Multi-threaded access?

## Phase 2: Data Structure Selection

Use this decision tree to select appropriate data structures:

```
START
  │
  ├─ Need key-value pairs?
  │    ├─ Yes → Need ordering by key?
  │    │         ├─ Yes → TreeMap / BTreeMap / OrderedDict
  │    │         └─ No  → HashMap / Map / Object
  │    └─ No → Continue
  │
  ├─ Need uniqueness (no duplicates)?
  │    ├─ Yes → Need ordering?
  │    │         ├─ Yes → TreeSet / BTreeSet
  │    │         └─ No  → HashSet / Set
  │    └─ No → Continue
  │
  ├─ Need queue semantics?
  │    ├─ FIFO (first-in-first-out) → Queue / Channel
  │    ├─ LIFO (last-in-first-out) → Stack (array with push/pop)
  │    ├─ Both ends → Deque / VecDeque
  │    ├─ Priority-based → PriorityQueue / Heap
  │    └─ No → Continue
  │
  ├─ Hierarchical relationships?
  │    ├─ Single parent per node → Tree
  │    ├─ Multiple parents / cycles → Graph
  │    └─ No → Continue
  │
  └─ Default → Array / Vec / List
```

### Data Structure Trade-offs Table

| Structure | Lookup | Insert | Delete | Memory | Use When |
|-----------|--------|--------|--------|--------|----------|
| Array | O(n) | O(n) | O(n) | Low | Small collections, index access |
| HashMap | O(1)* | O(1)* | O(1)* | Medium | Fast lookup by key |
| TreeMap | O(log n) | O(log n) | O(log n) | Medium | Sorted keys needed |
| HashSet | O(1)* | O(1)* | O(1)* | Medium | Unique values, membership test |
| LinkedList | O(n) | O(1) | O(1) | High | Frequent insertions/deletions |
| Heap | O(1) top | O(log n) | O(log n) | Low | Priority queue operations |

*Amortized, assuming good hash distribution

## Phase 3: Algorithm Design

### Complexity Practical Limits

Based on ~10^8 operations/second:

| n limit | Max Complexity | Common Algorithms |
|---------|----------------|-------------------|
| n ≤ 10 | O(n!) | Permutations, brute force |
| n ≤ 25 | O(2^n) | Subset enumeration, bitmask DP |
| n ≤ 100 | O(n³) | Floyd-Warshall, matrix multiplication |
| n ≤ 1,000 | O(n²) | Bubble sort, nested loops |
| n ≤ 100,000 | O(n log n) | Merge sort, quicksort, balanced BST |
| n ≤ 10,000,000 | O(n) | Linear scan, hash operations |
| n > 10,000,000 | O(log n) or O(1) | Binary search, hash lookup |

### Algorithm Selection Checklist

- [ ] Estimated input size (n): ___
- [ ] Required time complexity: O(___)
- [ ] Required space complexity: O(___)
- [ ] Chosen algorithm: ___
- [ ] Rationale: ___

### Common Patterns

| Problem Type | Patterns to Consider |
|--------------|---------------------|
| Search | Binary search, hash lookup, BFS/DFS |
| Sort | Quicksort, mergesort, counting sort |
| Optimization | DP, greedy, binary search on answer |
| Graph | BFS, DFS, Dijkstra, topological sort |
| String | KMP, trie, rolling hash |
| Range queries | Segment tree, Fenwick tree |

## Phase 4: Edge Case Enumeration

### Input Validation

- [ ] **Empty/null**: null, undefined, [], "", 0
- [ ] **Single element**: [x], "a", 1
- [ ] **Boundary values**: MIN_INT, MAX_INT, overflow potential
- [ ] **Invalid types**: wrong type passed
- [ ] **Unicode/special chars**: emojis, RTL text, zero-width chars
- [ ] **Very large inputs**: stress test size
- [ ] **Malformed data**: missing fields, extra fields

### Boundary Conditions

- [ ] **First/last element**: edge of array/list
- [ ] **Off-by-one**: < vs <=, array bounds
- [ ] **Binary search termination**: left <= right vs left < right
- [ ] **Loop invariants**: correctly maintained?
- [ ] **Recursion base case**: properly handled?

### State and Concurrency (if applicable)

- [ ] **Race conditions**: check-then-act patterns
- [ ] **Deadlocks**: lock ordering issues
- [ ] **Data races**: shared mutable state
- [ ] **Stale reads**: cache invalidation
- [ ] **Partial failures**: transaction rollback

## Phase 5: Analysis Documentation

After completing analysis, document your decisions:

```markdown
# Implementation Analysis: [Feature Name]

## 1. Problem Summary
- **Input**: [types and constraints]
- **Output**: [types and constraints]
- **Operations**: [list of required operations]
- **Performance**: [latency/throughput requirements]

## 2. Data Structures
| Structure | Purpose | Time Complexity | Space | Trade-offs |
|-----------|---------|-----------------|-------|------------|
| ... | ... | ... | ... | ... |

**Decision**: [chosen structure and rationale]

## 3. Algorithms
| Operation | Approach | Time | Space | Notes |
|-----------|----------|------|-------|-------|
| ... | ... | ... | ... | ... |

**Decision**: [chosen approach and rationale]

## 4. Edge Cases
- [x] Empty input → [handling]
- [x] Null values → [handling]
- [x] Boundary conditions → [handling]
- [ ] Concurrent access → [not applicable / handling]

## 5. Implementation Notes
[Key decisions, trade-offs, and rationale for future reference]
```

## Application Rules

1. **Complete all phases** - Don't skip phases even for "simple" features
2. **Document decisions** - Future maintainers need to understand why
3. **Validate assumptions** - Test edge cases early
4. **Iterate if needed** - Revisit earlier phases if constraints change

## Cross-Reference

- For initial research and context gathering, also apply the **research-first** skill
- For architectural decisions, also apply the **architecture-understanding** skill
