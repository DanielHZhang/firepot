import {Client} from './client';
import {Cursor} from '../managers/cursor';
import {UndoManager} from '../managers/undo';
import {WrappedOperation} from '../operations/wrapped';
import {TextOperation} from '../operations/text';
import {makeEventEmitter} from '../utils';
import {Synchronized} from './states/synchronized';
import {AwaitingWithBuffer} from './states/awaiting-buffer';
import {OtherClient} from './other';
import {MonacoAdapter} from '../adapters/monaco';
import {FirebaseAdapter} from '../adapters/firebase';
import {SelfMeta} from './self-meta';

export class EditorClient extends Client {
  public serverAdapter: FirebaseAdapter;
  public editorAdapter: MonacoAdapter;
  public undoManager: UndoManager;
  public clients: Record<string, OtherClient>;
  public cursor: Cursor | null;
  public focused?: boolean;

  constructor(serverAdapter: FirebaseAdapter, editorAdapter: MonacoAdapter) {
    super();
    this.serverAdapter = serverAdapter;
    this.editorAdapter = editorAdapter;
    this.undoManager = new UndoManager();
    this.clients = {};
    this.cursor = null;

    // Register monaco callbacks
    this.editorAdapter.registerCallbacks({
      change: (operation: TextOperation, inverse: TextOperation) => {
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
    this.editorAdapter.registerUndo(() => this.undo());
    this.editorAdapter.registerRedo(() => this.redo());

    // Register firebase callbacks
    this.serverAdapter.registerCallbacks({
      ack: () => {
        this.serverAck();
        if (this.focused && this.state instanceof Synchronized) {
          this.updateCursor();
          this.sendCursor(this.cursor);
        }
        this.emitStatus();
      },
      retry: () => {
        this.serverRetry();
      },
      operation: (operation: TextOperation) => {
        this.applyServer(operation);
      },
      cursor: (clientId: string, cursor: Cursor, color: string) => {
        if (this.serverAdapter.userId_ === clientId || !(this.state instanceof Synchronized)) {
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

  getClientObject(clientId: string) {
    const client = this.clients[clientId];
    if (client) {
      return client;
    }
    return (this.clients[clientId] = new OtherClient(clientId, this.editorAdapter));
  }

  applyUnredo(operation?: WrappedOperation) {
    this.undoManager.add(this.editorAdapter.invertOperation(operation));
    this.editorAdapter.applyOperation(operation.wrapped);
    this.cursor = operation.meta.cursorAfter;
    if (this.cursor) {
      this.editorAdapter.setCursor(this.cursor);
    }
    this.applyClient(operation.wrapped);
  }

  undo() {
    if (this.undoManager.canUndo()) {
      this.undoManager.performUndo((o) => this.applyUnredo(o));
    }
  }

  redo() {
    if (this.undoManager.canRedo()) {
      this.undoManager.performRedo((o) => this.applyUnredo(o));
    }
  }

  onChange(textOperation: TextOperation, inverse: TextOperation) {
    const cursorBefore = this.cursor;
    this.updateCursor();

    const compose =
      this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(
        this.undoManager.undoStack[this.undoManager.undoStack.length - 1].wrapped
      );
    const inverseMeta = new SelfMeta(this.cursor, cursorBefore);
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose);
    this.applyClient(textOperation);
  }

  updateCursor() {
    this.cursor = this.editorAdapter.getCursor();
  }

  onCursorActivity() {
    const oldCursor = this.cursor;
    this.updateCursor();
    if (!this.focused || (oldCursor && this.cursor!.equals(oldCursor))) {
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

  sendCursor(cursor: Cursor | null) {
    if (this.state instanceof AwaitingWithBuffer) {
      return;
    }
    this.serverAdapter.sendCursor(cursor);
  }

  sendOperation(operation: TextOperation) {
    this.serverAdapter.sendOperation(operation);
    this.emitStatus();
  }

  applyOperation(operation: TextOperation) {
    this.editorAdapter.applyOperation(operation);
    this.updateCursor();
    this.undoManager.transform(new WrappedOperation(operation, null));
  }

  emitStatus() {
    setTimeout(() => {
      this.trigger('synced', this.state instanceof Synchronized);
    }, 0);
  }
}

makeEventEmitter(EditorClient, ['synced']);
