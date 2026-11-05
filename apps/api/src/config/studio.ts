/**
 * Studio scheduling rules. Keep in sync with docs/BUSINESS_RULES.md §3; most values are still TBC.
 * `slotMinutes` must stay 15: the slot-reservation CHECK in the schema enforces 15-minute alignment.
 */
export const STUDIO = {
  timezone: "Africa/Nairobi",
  currency: "KES",
  slotMinutes: 15,
  turnaroundBufferMinutes: 15,
  houseCallTravelBufferMinutes: 60,
  minLeadTimeMinutes: 2 * 60,
  maxAdvanceDays: 60,
  /** Unset until Chao confirms the house-call fee (flat or by zone). */
  houseCallFeeMinor: null as number | null,
} as const;
