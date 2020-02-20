import {database} from 'firebase';
import {editor} from 'monaco-editor';
import {MonacoAdapter} from './adapters/monaco';
import {elt, on, stopEvent, makeEventEmitter} from './utils';
import {FirebaseAdapter} from './adapters/firebase';
import {EditorClient} from './client/editor-client';

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

export class Firepot {
  public zombie_: boolean;
  public monaco_: editor.IStandaloneCodeEditor;
  public editor_: editor.IStandaloneCodeEditor;
  public firepadWrapper_: HTMLElement;
  public firebaseAdapter_: FirebaseAdapter;
  public client_: EditorClient;
  public options_: Record<string, any>;
  public editorAdapter_: MonacoAdapter;
  public editorWrapper: HTMLElement;
  public ready_?: boolean;

  constructor(
    ref: database.Reference,
    place: editor.IStandaloneCodeEditor,
    options: Record<string, any> = {}
  ) {
    this.zombie_ = false;
    this.monaco_ = place;
    this.editor_ = place;
    this.options_ = options;

    const currentValue = this.monaco_.getValue();
    if (currentValue) {
      throw new Error(
        "Can't initialize Firepot with a Monaco instance that already contains text."
      );
    }

    this.editorWrapper = this.monaco_.getDomNode()!;
    this.firepadWrapper_ = elt('div', null, {class: 'firepad'});
    this.editorWrapper.parentNode?.replaceChild(this.firepadWrapper_, this.editorWrapper);
    this.firepadWrapper_.appendChild(this.editorWrapper);

    // Don't allow drag/drop because it causes issues.
    // See https://github.com/firebase/firepad/issues/36
    this.editorWrapper.addEventListener('dragstart', stopEvent);

    const userId = this.getOption('userId', ref.push().key);
    const userColor = this.getOption('userColor', colorFromUserId(userId));

    this.firebaseAdapter_ = new FirebaseAdapter(ref, userId, userColor);
    this.editorAdapter_ = new MonacoAdapter(this.monaco_);
    this.client_ = new EditorClient(this.firebaseAdapter_, this.editorAdapter_);

    this.firebaseAdapter_.on('cursor', () => {
      this.trigger.apply(this, ['cursor'].concat([].slice.call(arguments)));
    });
    this.firebaseAdapter_.on('ready', () => {
      this.ready_ = true;
      // if (this.monaco_) {
      //   this.editorAdapter_.grabDocumentState();
      // }
      let defaultText = this.getOption('defaultText', null);
      if (defaultText && this.isHistoryEmpty()) {
        this.setText(defaultText);
      }
      this.trigger('ready');
    });

    this.client_.on('synced', (isSynced) => {
      this.trigger('synced', isSynced);
    });
  }

  dispose() {
    this.zombie_ = true; // We've been disposed.  No longer valid to do anything.
    this.editorWrapper.removeEventListener('dragstart', stopEvent);
    this.firepadWrapper_.removeChild(this.editorWrapper);
    this.firepadWrapper_.parentNode?.replaceChild(this.editorWrapper, this.firepadWrapper_);
    this.firebaseAdapter_.dispose();
    this.editorAdapter_.detach();
  }

  setUserId(userId: string | number) {
    this.firebaseAdapter_.setUserId(userId);
  }

  setUserColor(color: string) {
    this.firebaseAdapter_.setColor(color);
  }

  // public getText() {
  //   this.assertReady_('getText');
  //   return this.monaco_.getModel()?.getValue();
  // }

  public setText(textPieces: any) {
    this.assertReady_('setText');
    return this.monaco_.getModel()?.setValue(textPieces);
    // this.editorAdapter_.setCursor({position: 0, selectionEnd: 0});
  }

  public isHistoryEmpty() {
    this.assertReady_('isHistoryEmpty');
    return this.firebaseAdapter_.isHistoryEmpty();
  }

  public getOption(option: string, def: any) {
    return option in this.options_ ? this.options_[option] : def;
  }

  public assertReady_(funcName: string) {
    if (!this.ready_) {
      throw new Error('You must wait for the "ready" event before calling ' + funcName);
    }
    if (this.zombie_) {
      throw new Error(
        "You can't use a Firepot after calling dispose()!  [called " + funcName + ']'
      );
    }
  }
}

makeEventEmitter(Firepot);
