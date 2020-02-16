import {Formatting} from './formatting';

/** Object to represent Formatted text. */
export class Text {
  public text: string;
  public formatting: any;

  constructor(text: string, formatting: any) {
    this.text = text;
    this.formatting = formatting || new Formatting();
  }
}

/**
 * Helper to turn pieces of text into insertable operations
 */
export function textPiecesToInserts(atNewLine: boolean, textPieces: (string | Text)[]) {
  const inserts: {string: string | Text; attributes?: Record<string, any>}[] = [];

  for (let i = 0; i < textPieces.length; i++) {
    let str = textPieces[i];
    let attributes;
    if (str instanceof Text) {
      attributes = str.formatting.attributes;
      str = str.text;
    }
    inserts.push({string: str, attributes: attributes});
    atNewLine = str[str.length - 1] === '\n';
  }

  return inserts;
}
