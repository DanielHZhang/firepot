import {assert} from '../utils';

/**
 * Operation are essentially lists of ops. There are three types of ops:
 * Retain ops: Advance the cursor position by a given number of characters.
   Represented by positive ints.
 * Insert ops: Insert a given string at the current cursor position.
   Represented by strings.
 * Delete ops: Delete the next n characters. Represented by negative ints.
 */
export class TextOp {
  public type: string;
  public chars?: number | null;
  public text?: string | null;
  public attributes?: Record<string, any> | null;

  constructor(type: string, textOrChars?: string | number, attributes?: Record<string, any>) {
    this.type = type;
    this.attributes = null;

    switch (type) {
      case 'insert': {
        assert(typeof textOrChars === 'string');
        this.text = textOrChars;
        this.attributes = attributes ?? {};
        break;
      }
      case 'delete': {
        assert(typeof textOrChars === 'number');
        this.chars = textOrChars;
        break;
      }
      case 'retain': {
        assert(typeof textOrChars === 'number');
        this.chars = textOrChars;
        this.attributes = attributes ?? {};
        break;
      }
      default: {
        this.chars = null;
        this.text = null;
      }
    }
  }

  public isInsert() {
    return this.type === 'insert';
  }

  public isDelete() {
    return this.type === 'delete';
  }

  public isRetain() {
    return this.type === 'retain';
  }

  public equals(other: TextOp) {
    return (
      this.type === other.type &&
      this.text === other.text &&
      this.chars === other.chars &&
      this.attributesEqual(other.attributes)
    );
  }

  public attributesEqual(otherAttributes?: Record<string, any> | null) {
    if (!otherAttributes) {
      return !this.attributes;
    }
    if (!this.attributes) {
      return !otherAttributes;
    }
    for (let attr in this.attributes) {
      if (this.attributes[attr] !== otherAttributes[attr]) {
        return false;
      }
    }
    for (let attr in otherAttributes) {
      if (this.attributes[attr] !== otherAttributes[attr]) {
        return false;
      }
    }
    return true;
  }

  public hasEmptyAttributes() {
    if (!this.attributes) {
      return true;
    }
    return Object.keys(this.attributes).length === 0;
  }
}
