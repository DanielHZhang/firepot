export type MonacoCursor = {
  /** Starting Position of the Cursor */
  position?: number;
  /** Ending Position of the Cursor */
  selectionEnd?: number;
  clientID?: string | number;
  decoration?: string[];
};

export interface EventEmitter {
  allowedEvents_: string[];
  on: (eventType: string, callback: Function, context?: any) => void;
  off: (eventType: string, callback: Function) => void;
  trigger: (eventType: string, ...args: any[]) => void;
  validateEventType_: (eventType: string) => void;
}

export type FirepotOptions = {
  [key: string]: string | undefined;
  userId?: string;
  userColor?: string;
  defaultText?: string;
};
