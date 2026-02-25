/**
 * Client for SidStack API knowledge search endpoint.
 * Calls GET /api/knowledge/search on the api-server.
 */

const SIDSTACK_API_URL = process.env.SIDSTACK_API_URL || 'http://localhost:19432';

interface KnowledgeResult {
  id: string;
  title: string;
  type: string;
  summary?: string;
}

interface SearchResponse {
  query: string;
  results: KnowledgeResult[];
  total: number;
}

export async function searchKnowledge(
  projectPath: string,
  query: string,
  limit = 10,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    projectPath,
    q: query,
    limit: String(limit),
  });

  const res = await fetch(`${SIDSTACK_API_URL}/api/knowledge/search?${params}`);
  if (!res.ok) {
    throw new Error(`Knowledge search failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<SearchResponse>;
}
