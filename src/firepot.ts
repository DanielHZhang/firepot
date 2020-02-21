import {database} from 'firebase/app';
import {editor} from 'monaco-editor';
import {MonacoAdapter} from './adapters/monaco';
import {stopEvent, makeEventEmitter} from './utils';
import {FirebaseAdapter} from './adapters/firebase';
import {EditorClient} from './client/editor-client';
import {EventEmitter, FirepotOptions} from './constants';

function rgb2hex(r: number, g: number, b: number) {
  const digits = (n: number) => {
    const m = Math.round(255 * n).toString(16);
    return m.length === 1 ? '0' + m : m;
  };
  return '#' + digits(r) + digits(g) + digits(b);
}

function hsl2hex(h: number, s: number, l: number) {
  if (s === 0) {
    return rgb2hex(l, l, l);
  }
  const let2 = l < 0.5 ? l * (1 + s) : l + s - s * l;
  const let1 = 2 * l - let2;
  const hue2rgb = (hue: number) => {
    if (hue < 0) {
      hue += 1;
    }
    if (hue > 1) {
      hue -= 1;
    }
    if (6 * hue < 1) {
      return let1 + (let2 - let1) * 6 * hue;
    }
    if (2 * hue < 1) {
      return let2;
    }
    if (3 * hue < 2) {
      return let1 + (let2 - let1) * 6 * (2 / 3 - hue);
    }
    return let1;
  };
  return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3));
}

function colorFromUserId(userId: string) {
  let a = 1;
  for (let i = 0; i < userId.length; i++) {
    a = (17 * (a + userId.charCodeAt(i))) % 360;
  }
  const hue = a / 360;
  return hsl2hex(hue, 1, 0.75);
}

export interface Firepot extends EventEmitter {}
export class Firepot {
  public editor: editor.IStandaloneCodeEditor;
  public editorElement: HTMLElement;
  public editorClient: EditorClient;
  public monacoAdapter: MonacoAdapter;
  public firebaseAdapter: FirebaseAdapter;
  public options: FirepotOptions;
  public ready?: boolean;

  constructor(
    ref: database.Reference,
    editor: editor.IStandaloneCodeEditor,
    options: FirepotOptions = {}
  ) {
    this.editor = editor;
    this.options = options;
    this.editorElement = this.editor.getDomNode()!;

    const currentValue = this.editor.getValue();
    if (currentValue) {
      throw new Error("Can't initialize with a Monaco instance that already contains text.");
    }

    // Don't allow drag/drop because it causes issues.
    // See https://github.com/firebase/firepad/issues/36
    this.editorElement.addEventListener('dragstart', stopEvent);

    const userId = this.options.userId ?? ref.push().key!;
    const userColor = this.options.userColor ?? colorFromUserId(userId);

    this.firebaseAdapter = new FirebaseAdapter(ref, userId, userColor);
    this.monacoAdapter = new MonacoAdapter(this.editor);
    this.editorClient = new EditorClient(this.firebaseAdapter, this.monacoAdapter);

    // Add listeners to adapters and client
    this.firebaseAdapter.on('cursor', () => {
      this.trigger('cursor', ref, editor, options);
      // this.trigger.apply(this, ['cursor'].concat([].slice.call(arguments)));
    });
    this.firebaseAdapter.on('ready', () => {
      this.ready = true;
      const defaultText = this.options.defaultText;
      if (defaultText && this.isHistoryEmpty()) {
        this.setText(defaultText);
      }
      this.trigger('ready');
    });
    this.editorClient.on('synced', (isSynced: boolean) => this.trigger('synced', isSynced));
  }

  /** Clean up all listeners and memory references */
  public dispose() {
    this.editorElement.removeEventListener('dragstart', stopEvent);
    this.firebaseAdapter.dispose();
    this.monacoAdapter.detach();
  }

  public setUserId(userId: string) {
    this.firebaseAdapter.setUserId(userId);
  }

  public setUserColor(color: string) {
    this.firebaseAdapter.setColor(color);
  }

  public getText() {
    this.assertReady_('getText');
    return this.editor.getModel()?.getValue();
  }

  public setText(textPieces: any) {
    this.assertReady_('setText');
    return this.editor.getModel()?.setValue(textPieces);
    // this.editorAdapter_.setCursor({position: 0, selectionEnd: 0});
  }

  public isHistoryEmpty() {
    this.assertReady_('isHistoryEmpty');
    return this.firebaseAdapter.isHistoryEmpty();
  }

  public assertReady_(funcName: string) {
    if (!this.ready) {
      throw new Error('You must wait for the "ready" event before calling ' + funcName);
    }
  }
}

makeEventEmitter(Firepot);
