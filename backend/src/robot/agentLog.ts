import fs from 'fs';
import path from 'path';

export type LogAction =
  | 'ROBOT_ONLINE'
  | 'TASK_RECEIVED'
  | 'TASK_DECOMPOSED'
  | 'CAPABILITY_CHECK'
  | 'SUBTASK_EXECUTING'
  | 'SUBTASK_COMPLETE'
  | 'SUBTASK_ABORTED'
  | 'PEER_QUERY'
  | 'REPUTATION_CHECK'
  | 'PEER_SELECTED'
  | 'PEER_DELEGATION'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_RECEIVED'
  | 'SAFETY_CHECK'
  | 'REPUTATION_UPDATED'
  | 'TASK_COMPLETE'
  | 'LOG_UPLOADED'
  | 'STATE_CHANGED'
  | 'ERROR';

interface LogEntry {
  timestamp: string;   // ISO 8601 with milliseconds
  action: LogAction;
  data: Record<string, unknown>;
}

interface ComputeBudget {
  groqCalls: number;
  x402PaymentsSent: number;
  x402PaymentsReceived: number;
  redisOps: number;
}

interface AgentLogFile {
  agentId: string;
  erc8004TokenId: string;
  operatorWallet: string;
  sessionStart: string;   // ISO 8601
  computeBudget: ComputeBudget;
  entries: LogEntry[];
}

export class AgentLogger {
  private filePath: string;
  private log: AgentLogFile;

  constructor(agentId: string, erc8004TokenId = 'unknown', operatorWallet = 'unknown') {
    const logsDir = path.resolve('logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    this.filePath = path.join(logsDir, `${agentId}-session.json`);
    this.log = {
      agentId,
      erc8004TokenId,
      operatorWallet,
      sessionStart: new Date().toISOString(),
      computeBudget: { groqCalls: 0, x402PaymentsSent: 0, x402PaymentsReceived: 0, redisOps: 0 },
      entries: [],
    };

    this.flush();
  }

  append(action: LogAction, data: Record<string, unknown>): void {
    this.log.entries.push({
      timestamp: new Date().toISOString(),
      action,
      data,
    });
    this.flush();
  }

  updateBudget(patch: Partial<ComputeBudget>): void {
    this.log.computeBudget = { ...this.log.computeBudget, ...patch };
    // Flush is deferred to the next append to avoid thrashing on every op
  }

  getBudget(): ComputeBudget {
    return { ...this.log.computeBudget };
  }

  getFilePath(): string {
    return this.filePath;
  }

  private flush(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.log, null, 2));
  }
}