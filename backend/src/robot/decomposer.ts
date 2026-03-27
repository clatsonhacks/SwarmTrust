import Groq from 'groq-sdk';
import crypto from 'crypto';

export type Capability = 'NAVIGATE' | 'SCAN' | 'LIFT' | 'CARRY';

export interface SubTask {
  subTaskId: string;
  description: string;
  requiredCapability: Capability;
  estimatedDurationSecs: number;
  irreversible: boolean;
}

export interface DecomposeResult {
  subtasks: SubTask[];
  fromCache: boolean;
  fromFallback: boolean;
  groqCallsRemaining: number;
}

// ── Token bucket rate limiter ─────────────────────────────────────────────────
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly max: number) {
    this.tokens = max;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    if (Date.now() - this.lastRefill >= 3_600_000) {
      this.tokens = this.max;
      this.lastRefill = Date.now();
    }
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  remaining(): number {
    return this.tokens;
  }
}

// ── In-memory cache ───────────────────────────────────────────────────────────
const cache = new Map<string, SubTask[]>();

function cacheKey(description: string): string {
  return crypto.createHash('md5').update(description.toLowerCase().trim()).digest('hex');
}

// ── Fallback rule-based decomposition ─────────────────────────────────────────
function fallbackDecompose(taskId: string, description: string): SubTask[] {
  const d = description.toLowerCase();

  if (d.includes('move') || d.includes('transport')) {
    return [
      { subTaskId: `${taskId}-1`, description: 'Navigate to source zone',       requiredCapability: 'NAVIGATE', estimatedDurationSecs: 5,  irreversible: false },
      { subTaskId: `${taskId}-2`, description: 'Lift item at source',            requiredCapability: 'LIFT',     estimatedDurationSecs: 8,  irreversible: false },
      { subTaskId: `${taskId}-3`, description: 'Carry item to destination',      requiredCapability: 'CARRY',    estimatedDurationSecs: 10, irreversible: false },
      { subTaskId: `${taskId}-4`, description: 'Place item at destination',      requiredCapability: 'LIFT',     estimatedDurationSecs: 5,  irreversible: true  },
    ];
  }
  if (d.includes('scan') || d.includes('inspect') || d.includes('report')) {
    return [
      { subTaskId: `${taskId}-1`, description: 'Navigate to target zone',        requiredCapability: 'NAVIGATE', estimatedDurationSecs: 5,  irreversible: false },
      { subTaskId: `${taskId}-2`, description: 'Scan and report inventory',      requiredCapability: 'SCAN',     estimatedDurationSecs: 15, irreversible: false },
    ];
  }
  if (d.includes('sort') || d.includes('organiz')) {
    return [
      { subTaskId: `${taskId}-1`, description: 'Navigate to zone',               requiredCapability: 'NAVIGATE', estimatedDurationSecs: 5,  irreversible: false },
      { subTaskId: `${taskId}-2`, description: 'Sort and organise items',        requiredCapability: 'LIFT',     estimatedDurationSecs: 20, irreversible: true  },
    ];
  }
  // Generic fallback
  return [
    { subTaskId: `${taskId}-1`, description: 'Navigate to zone',                 requiredCapability: 'NAVIGATE', estimatedDurationSecs: 5,  irreversible: false },
    { subTaskId: `${taskId}-2`, description: 'Execute task action',              requiredCapability: 'SCAN',     estimatedDurationSecs: 10, irreversible: false },
  ];
}

// ── Response parser ───────────────────────────────────────────────────────────
function parseResponse(raw: string): SubTask[] | null {
  let text = raw.trim();
  // Strip markdown code fences
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  // Find first [ ... last ]
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as SubTask[];
  } catch {
    return null;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a warehouse task planner. Decompose the given task into an ordered array of sub-tasks.

Respond with ONLY a valid JSON array — no explanation, no markdown, no preamble.

Each element must have exactly these fields:
{
  "subTaskId": string,
  "description": string,
  "requiredCapability": "NAVIGATE" | "SCAN" | "LIFT" | "CARRY",
  "estimatedDurationSecs": number,
  "irreversible": boolean
}

Mark irreversible=true only when an action cannot be undone (e.g. placing an item, overwriting storage).`;

// ── TaskDecomposer ────────────────────────────────────────────────────────────
export class TaskDecomposer {
  private readonly groq: Groq;
  private readonly bucket: TokenBucket;
  private callCount = 0;

  constructor(apiKey: string, maxCallsPerHour: number) {
    this.groq = new Groq({ apiKey });
    this.bucket = new TokenBucket(maxCallsPerHour);
  }

  async decompose(
    taskId: string,
    description: string,
    capabilities: string[]
  ): Promise<DecomposeResult> {
    const key = cacheKey(description);

    // Cache hit
    if (cache.has(key)) {
      return { subtasks: cache.get(key)!, fromCache: true, fromFallback: false, groqCallsRemaining: this.bucket.remaining() };
    }

    // Rate limit check
    if (!this.bucket.consume()) {
      return { subtasks: fallbackDecompose(taskId, description), fromCache: false, fromFallback: true, groqCallsRemaining: 0 };
    }

    // Call Groq
    this.callCount++;
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Task: ${description}\nMy capabilities: ${capabilities.join(', ')}` },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      const parsed = parseResponse(raw);

      if (parsed) {
        cache.set(key, parsed);
        return { subtasks: parsed, fromCache: false, fromFallback: false, groqCallsRemaining: this.bucket.remaining() };
      }

      // Parse failed — fallback
      return { subtasks: fallbackDecompose(taskId, description), fromCache: false, fromFallback: true, groqCallsRemaining: this.bucket.remaining() };
    } catch {
      return { subtasks: fallbackDecompose(taskId, description), fromCache: false, fromFallback: true, groqCallsRemaining: this.bucket.remaining() };
    }
  }

  getCallCount(): number {
    return this.callCount;
  }
}