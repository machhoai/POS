export type CustomerDisplayMediaType = "IMAGE" | "VIDEO";

export interface CustomerDisplayPlaylistItem {
  media_id: string;
  sort_order: number;
  enabled: boolean;
  image_duration_seconds: number | null;
}

export interface CustomerDisplayAdvertisingSettings {
  id: string;
  warehouse_id: string;
  version: number;
  playlist: CustomerDisplayPlaylistItem[];
  updated_by: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerDisplayAdvertisingMedia {
  id: string;
  warehouse_id: string;
  type: CustomerDisplayMediaType;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  duration_seconds: number | null;
  is_deleted: boolean;
  download_url: string;
}

export interface CustomerDisplayAdvertisingView {
  settings: CustomerDisplayAdvertisingSettings | null;
  media: CustomerDisplayAdvertisingMedia[];
}

export interface CustomerDisplayAdvertisingWatchResult {
  changed: boolean;
  customer_display_settings: CustomerDisplayAdvertisingView | null;
  server_time: string;
}

export interface CustomerDisplayResolvedSlide {
  id: string;
  type: CustomerDisplayMediaType;
  src: string;
  fileName: string;
  durationSeconds: number;
}
