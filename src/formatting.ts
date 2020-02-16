import {Attributes} from './constants';

/**
 * Object to represent text formatting. Formatting can be modified by chaining method calls.
 */
export class Formatting {
  public attributes: Record<any, any>;

  constructor(attributes?: Record<any, any>) {
    this.attributes = attributes ?? {};
  }

  cloneWithNewAttribute_(attribute: string, value: boolean | string | number) {
    const attributes: Record<string, boolean | string | number> = {};
    // Copy existing.
    for (let attr in this.attributes) {
      attributes[attr] = this.attributes[attr];
    }
    // Add new one.
    if (value === false) {
      delete attributes[attribute];
    } else {
      attributes[attribute] = value;
    }
    return new Formatting(attributes);
  }

  bold(val: boolean) {
    return this.cloneWithNewAttribute_(Attributes.BOLD, val);
  }

  italic(val: boolean) {
    return this.cloneWithNewAttribute_(Attributes.ITALIC, val);
  }

  underline(val: boolean) {
    return this.cloneWithNewAttribute_(Attributes.UNDERLINE, val);
  }

  strike(val: boolean) {
    return this.cloneWithNewAttribute_(Attributes.STRIKE, val);
  }

  font(font: boolean) {
    return this.cloneWithNewAttribute_(Attributes.FONT, font);
  }

  fontSize(size: number) {
    return this.cloneWithNewAttribute_(Attributes.FONT_SIZE, size);
  }

  color(color: string) {
    return this.cloneWithNewAttribute_(Attributes.COLOR, color);
  }

  backgroundColor(color: string) {
    return this.cloneWithNewAttribute_(Attributes.BACKGROUND_COLOR, color);
  }
}
