import {TextOperation} from './operations/text';

export enum Attributes {
  BOLD = 'b',
  ITALIC = 'i',
  UNDERLINE = 'u',
  STRIKE = 's',
  FONT = 'f',
  FONT_SIZE = 'fs',
  COLOR = 'c',
  BACKGROUND_COLOR = 'bc',
  ENTITY_SENTINEL = 'ent',
  LINE_SENTINEL = 'l',
  LINE_INDENT = 'li',
  LINE_ALIGN = 'la',
  LIST_TYPE = 'lt',
}

export enum Sentinels {
  // A special character we insert at the beginning of lines so we can attach attributes to it to represent "line attributes."  E000 is from the unicode "private use" range.
  LINE_CHARACTER = '\uE000',
  // A special character used to represent any "entity" inserted into the document (e.g. an image).
  ENTITY_CHARACTER = '\uE001',
}

export type MonacoCursor = {
  /** Starting Position of the Cursor */
  position?: number;
  /** Ending Position of the Cursor */
  selectionEnd?: number;
  clientID?: string | number;
  decoration?: string[];
};

export interface EventEmitter {
  allowedEvents_: string;
  on: (eventType: string, callback: Function, context: any) => void;
  off: (eventType: string, callback: Function) => void;
  trigger: (eventType: string) => void;
  validateEventType_: (eventType: string) => void;
}
