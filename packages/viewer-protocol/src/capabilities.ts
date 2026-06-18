export const CAPABILITIES = {
  iframe: "iframe",
  documentOpen: "document.open"
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
