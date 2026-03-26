import fs from 'fs';
import path from 'path';

export type LogAction =
  | 'ROBOT_ONLINE'
  | 'TASK_RECEIVED'
  | 'TASK_DECOMPOSED'
  | 'CAPABILITY_CHECK'
  | 'SUBTASK_EXECUTING'
  | 'PEER_QUERY'
  | 'REPUTATION_CHECK'
  | 'PEER_SELECTED'
  | 'SUBTASK_ABORTED'
  | 'PEER_DELEGATION'
  | 'TASK_COMPLETE'
  | 'STATE_CHANGED'
  | 'ERROR';

interface LogEntry {
  timestamp: string;
  action: LogAction;
  data: Record<string, unknown>;
}

interface AgentLogFile {
  agentId: string;
  sessionStart: string;
  entries: LogEntry[];
}

export class AgentLogger {
  private filePath: string;
  private log: AgentLogFile;

  constructor(agentId: string) {
    const logsDir = path.resolve('logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    this.filePath = path.join(logsDir, `${agentId}-session.json`);
    this.log = {
      agentId,
      sessionStart: new Date().toISOString(),
      entries: [],
    };

    // Write initial file
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

  private flush(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.log, null, 2));
  }
}