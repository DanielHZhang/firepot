export type Cursor = {
  /** Starting Position of the Cursor */
  position?: number;
  /** Ending Position of the Cursor */
  selectionEnd?: number;
  clientID?: string | number;
  decoration?: string[];
};
