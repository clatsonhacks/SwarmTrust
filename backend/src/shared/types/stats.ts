export interface SessionStats {
  tasksCompleted: number;
  totalUsdcTransferred: string;   // stored as string (micro-USDC or wei)
  onChainTransactionCount: number;
  reputationUpdatesWritten: number;
}