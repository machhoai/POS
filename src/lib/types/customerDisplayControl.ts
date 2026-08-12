export type CustomerDisplayLanguage = "vi" | "en" | "zh";

export interface CustomerDisplayControlState {
  language: CustomerDisplayLanguage;
  pinnedSlideId: string | null;
}

export const DEFAULT_CUSTOMER_DISPLAY_CONTROL: CustomerDisplayControlState = {
  language: "vi",
  pinnedSlideId: null,
};
