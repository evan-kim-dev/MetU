export type ChecklistItemType =
  | "FLIGHT"
  | "HOTEL"
  | "DOCUMENT"
  | "EXTRA";

export type ChecklistItemStatus =
  | "NOT_STARTED"
  | "SEARCHED"
  | "SELECTED"
  | "COMPLETED";

export type ChecklistItemInput = {
  itemType: ChecklistItemType;
  itemStatus: ChecklistItemStatus;
  itemName: string;
  itemSummary?: string;
  externalProvider?: string;
  externalItemId?: string;
  externalUrl?: string;
  selected?: boolean;
  notes?: string;
  dueDate?: string;
  estPriceKrw?: number;
  expenseId?: string;
};
