import {Client} from './client';
import {Cursor} from '../cursor';
import {UndoManager} from '../undo-manager';
import {WrappedOperation} from '../operations/wrapped-operation';
import {TextOperation} from '../operations/text-operation';

class SelfMeta {
  public cursorBefore: Cursor;
  public cursorAfter: Cursor;

  constructor(cursorBefore: Cursor, cursorAfter: Cursor) {
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

class OtherClient {
  public id: string;
  public editorAdapter: any;
  public color: string;
  public cursor: Cursor;
  public mark: any;

  constructor(id: string, editorAdapter: any) {
    this.id = id;
    this.editorAdapter = editorAdapter;
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

export class EditorClient extends Client {
  public serverAdapter: any;
  public editorAdapter: any;
  public undoManager: UndoManager;
  public clients: {};
  public focused: boolean;

  constructor(serverAdapter: any, editorAdapter: any) {
    super();
    this.serverAdapter = serverAdapter;
    this.editorAdapter = editorAdapter;
    this.undoManager = new UndoManager();
    this.clients = {};

    this.editorAdapter.registerCallbacks({
      change: (operation, inverse) => {
        this.onChange(operation, inverse);
      },
      cursorActivity: () => {
        this.onCursorActivity();
      },
      blur: () => {
        this.onBlur();
      },
      focus: () => {
        this.onFocus();
      },
    });
    this.editorAdapter.registerUndo(() => {
      this.undo();
    });
    this.editorAdapter.registerRedo(() => {
      this.redo();
    });

    this.serverAdapter.registerCallbacks({
      ack: () => {
        this.serverAck();
        if (this.focused && this.state instanceof Client.Synchronized) {
          this.updateCursor();
          this.sendCursor(this.cursor);
        }
        this.emitStatus();
      },
      retry: () => {
        this.serverRetry();
      },
      operation: (operation) => {
        this.applyServer(operation);
      },
      cursor: (clientId, cursor, color) => {
        if (
          this.serverAdapter.userId_ === clientId ||
          !(this.state instanceof Client.Synchronized)
        ) {
          return;
        }
        let client = this.getClientObject(clientId);
        if (cursor) {
          if (color) {
            client.setColor(color);
          }
          client.updateCursor(Cursor.fromJSON(cursor));
        } else {
          client.removeCursor();
        }
      },
    });
  }

  getClientObject(clientId) {
    let client = this.clients[clientId];
    if (client) {
      return client;
    }
    return (this.clients[clientId] = new OtherClient(clientId, this.editorAdapter));
  }

  applyUnredo(operation) {
    this.undoManager.add(this.editorAdapter.invertOperation(operation));
    this.editorAdapter.applyOperation(operation.wrapped);
    this.cursor = operation.meta.cursorAfter;
    if (this.cursor) {
      this.editorAdapter.setCursor(this.cursor);
    }
    this.applyClient(operation.wrapped);
  }

  undo() {
    let self = this;
    if (!this.undoManager.canUndo()) {
      return;
    }
    this.undoManager.performUndo(function(o) {
      self.applyUnredo(o);
    });
  }

  redo() {
    let self = this;
    if (!this.undoManager.canRedo()) {
      return;
    }
    this.undoManager.performRedo(function(o) {
      self.applyUnredo(o);
    });
  }

  onChange(textOperation, inverse) {
    let cursorBefore = this.cursor;
    this.updateCursor();

    let compose =
      this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(
        this.undoManager.undoStack[this.undoManager.undoStack.length - 1].wrapped
      );
    let inverseMeta = new SelfMeta(this.cursor, cursorBefore);
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose);
    this.applyClient(textOperation);
  }

  updateCursor() {
    this.cursor = this.editorAdapter.getCursor();
  }

  onCursorActivity() {
    let oldCursor = this.cursor;
    this.updateCursor();
    if (!this.focused || (oldCursor && this.cursor.equals(oldCursor))) {
      return;
    }
    this.sendCursor(this.cursor);
  }

  onBlur() {
    this.cursor = null;
    this.sendCursor(null);
    this.focused = false;
  }

  onFocus() {
    this.focused = true;
    this.onCursorActivity();
  }

  sendCursor(cursor) {
    if (this.state instanceof Client.AwaitingWithBuffer) {
      return;
    }
    this.serverAdapter.sendCursor(cursor);
  }

  sendOperation(operation) {
    this.serverAdapter.sendOperation(operation);
    this.emitStatus();
  }

  applyOperation(operation) {
    this.editorAdapter.applyOperation(operation);
    this.updateCursor();
    this.undoManager.transform(new WrappedOperation(operation, null));
  }

  emitStatus() {
    setTimeout(() => {
      this.trigger('synced', self.state instanceof Client.Synchronized);
    }, 0);
  }
}

firepad.utils.makeEventEmitter(firepad.EditorClient, ['synced']);
