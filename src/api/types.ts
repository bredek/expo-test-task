// Shapes from https://task-api.cashmine.io/docs. Amounts are decimal strings.

export type Balance = {
  asset: string;
  decimals: number;
  available: string;
  pending: string;
  claiming: string;
  usdPrice: string;
};

export type BalancesResponse = {
  asOf: string;
  items: Balance[];
};

export type Destination = { id: string; label: string };

export type ClaimOptions = {
  asset: string;
  minAmount: string;
  fee: string;
  destinations: Destination[];
};

export type ClaimRequest = {
  asset: string;
  amount: string;
  destinationId: string;
};

export type ClaimStatus = 'pending' | 'completed' | 'failed';

export type Claim = {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  type: 'accrual' | 'reversal' | 'claim';
  asset: string;
  amount: string;
  status: string;
  exchange: string | null;
  createdAt: string;
  relatedId: string | null;
};

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
};
