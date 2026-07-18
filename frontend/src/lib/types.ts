export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export type ChartAccount = {
  code: string;
  name: string;
  type: AccountType;
  balance: number;
};

export type JournalLine = {
  account: string;
  amount: number;
};

export type JournalEntryInput = {
  date: string;
  description: string;
  debit: JournalLine[];
  credit: JournalLine[];
};

export type JournalEntry = JournalEntryInput & {
  id: string;
};

export type ValidationResult = {
  approved: boolean;
  reason: string;
  correction: {
    debit: JournalLine[];
    credit: JournalLine[];
  } | null;
  entry?: JournalEntry;
};

export type LedgerPosting = {
  date: string;
  description: string;
  debit: number;
  credit: number;
};

export type GeneralLedgerAccount = {
  code: string;
  name: string;
  type: AccountType;
  balance: number;
  postings: LedgerPosting[];
};

export type BalanceSheet = {
  assets: ChartAccount[];
  liabilities: ChartAccount[];
  equity: ChartAccount[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

export type ProfitLoss = {
  revenue: ChartAccount[];
  expenses: ChartAccount[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export type AccountSetting = {
  code: string;
  name: string;
  type: AccountType;
  enabled: boolean;
};

export type ChatTurn = {
  role: "user" | "agent";
  content: string;
};

export type ProposedEntry = {
  date: string;
  description: string;
  debit: JournalLine[];
  credit: JournalLine[];
};

export type InterpreterResponse = {
  status: "question" | "proposal";
  message: string;
  proposedEntry: ProposedEntry | null;
};

export type BusinessProfile = {
  businessName: string;
  businessType: string;
  businessId: string;
  address: string;
  fyStart: string;
  fyEnd: string;
};

export type OnboardingInput = BusinessProfile & {
  enabledCodes: string[];
};
