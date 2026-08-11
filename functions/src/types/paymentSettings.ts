export interface FixedTransferSettings {
  warehouseId: string;
  enabled: boolean;
  fixedTransferOnly: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  version: number;
  updatedAt: string;
  updatedByUid: string;
}

export interface FixedTransferSettingsInput {
  warehouseId: string;
  enabled: boolean;
  fixedTransferOnly: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}
