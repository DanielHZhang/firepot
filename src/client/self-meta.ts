import {Cursor} from '../managers/cursor';
import {TextOperation} from '../operations/text-operation';

export class SelfMeta {
  public cursorBefore: Cursor | null;
  public cursorAfter: Cursor | null;

  constructor(cursorBefore: Cursor | null, cursorAfter: Cursor | null) {
    this.cursorBefore = cursorBefore;
    this.cursorAfter = cursorAfter;
  }

  invert() {
    return new SelfMeta(this.cursorAfter, this.cursorBefore);
  }

  compose(other: SelfMeta) {
    return new SelfMeta(this.cursorBefore, other.cursorAfter);
  }

  transform(operation: TextOperation) {
    return new SelfMeta(
      this.cursorBefore ? this.cursorBefore.transform(operation) : null,
      this.cursorAfter ? this.cursorAfter.transform(operation) : null
    );
  }
}
