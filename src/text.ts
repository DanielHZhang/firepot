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
