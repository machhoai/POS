export interface FixedTransferSettings {
  deviceId: string;
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
  deviceId: string;
  warehouseId: string;
  enabled: boolean;
  fixedTransferOnly: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}
