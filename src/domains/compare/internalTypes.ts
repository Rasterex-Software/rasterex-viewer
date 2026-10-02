export type ComparePendingCommand = "compare" | "align" | "compareSave";

export interface PendingCompareCommand {
  type: ComparePendingCommand;
  waitsForInteractiveAlignResult: boolean;
  completed: boolean;
  progressEnded?: boolean;
  result?: import("./types.js").ComparisonResult;
  resolve?: (result: import("./types.js").ComparisonResult) => void;
  reject?: (error: Error) => void;
  timeoutId?: ReturnType<typeof globalThis.setTimeout>;
}
