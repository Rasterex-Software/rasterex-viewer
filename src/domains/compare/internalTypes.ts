export type ComparePendingCommand = "compare" | "align" | "compareSave";

export interface PendingCompareCommand {
  type: ComparePendingCommand;
  waitsForInteractiveAlignResult: boolean;
  completed: boolean;
}
