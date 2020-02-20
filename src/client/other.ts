import {MonacoAdapter} from '../adapters/monaco';
import {Cursor} from '../managers/cursor';
import {Mark} from '../constants';

export class OtherClient {
  public id: string;
  public editorAdapter: MonacoAdapter;
  public color: string;
  public cursor: Cursor | null;
  public mark?: Mark;

  constructor(id: string, adapter: MonacoAdapter) {
    this.id = id;
    this.editorAdapter = adapter;
    this.color = '';
    this.cursor = null;
  }

  setColor(color: string) {
    this.color = color;
  }

  updateCursor(cursor: Cursor) {
    this.removeCursor();
    this.cursor = cursor;
    this.mark = this.editorAdapter.setOtherCursor(cursor, this.color, this.id);
  }

  removeCursor() {
    if (this.mark) {
      this.mark.clear();
    }
  }
}
