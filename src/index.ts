// import {editor} from 'monaco-editor';
import {database} from 'firebase';
import {editor} from 'monaco-editor';
import {MonacoAdapter} from './monaco-adapter';
import {elt, on, stopEvent} from './utils';
import {EntityManager} from './entity-manager';

export class Firepad {
  public zombie_: boolean;
  public monaco_: editor.IStandaloneCodeEditor;
  public editor_: editor.IStandaloneCodeEditor;
  public firepadWrapper_: HTMLElement;

  constructor(ref: database.Reference, place: editor.IStandaloneCodeEditor, options) {
    this.zombie_ = false;
    this.monaco_ = place;
    this.editor_ = place;

    const currentValue = this.monaco_.getValue();
    if (!currentValue) {
      throw new Error(
        "Can't initialize Firepad with a Monaco instance that already contains text."
      );
    }

    const editorWrapper = this.monaco_.getDomNode()!;
    this.firepadWrapper_ = elt('div', null, {class: 'firepad'});
    editorWrapper?.parentNode?.replaceChild(this.firepadWrapper_, editorWrapper);
    this.firepadWrapper_.appendChild(editorWrapper);

    // Don't allow drag/drop because it causes issues.  See https://github.com/firebase/firepad/issues/36
    on(editorWrapper, 'dragstart', stopEvent);

    this.options_ = options || {};
    this.imageInsertionUI = this.getOption('imageInsertionUI', true);

    let userId = this.getOption('userId', ref.push().key);
    let userColor = this.getOption('userColor', colorFromUserId(userId));
    this.entityManager_ = new EntityManager();

    this.firebaseAdapter_ = new FirebaseAdapter(ref, userId, userColor);
    this.editorAdapter_ = new MonacoAdapter(this.monaco_);
    this.client_ = new EditorClient(this.firebaseAdapter_, this.editorAdapter_);

    this.firebaseAdapter_.on('cursor', () => {
      this.trigger.apply(this, ['cursor'].concat([].slice.call(arguments)));
    });
    this.firebaseAdapter_.on('ready', function() {
      this.ready_ = true;
      if (this.monaco_) {
        this.editorAdapter_.grabDocumentState();
      }
      let defaultText = this.getOption('defaultText', null);
      if (defaultText && this.isHistoryEmpty()) {
        this.setText(defaultText);
      }
      this.trigger('ready');
    });

    // this.client_.on('synced', function(isSynced) {
    //   self.trigger('synced', isSynced);
    // });

    // // Hack for IE8 to make font icons work more reliably.
    // // http://stackoverflow.com/questions/9809351/ie8-css-font-face-fonts-only-working-for-before-content-on-over-and-sometimes
    // if (
    //   navigator.appName == 'Microsoft Internet Explorer' &&
    //   navigator.userAgent.match(/MSIE 8\./)
    // ) {
    //   window.onload = function() {
    //     let head = document.getElementsByTagName('head')[0],
    //       style = document.createElement('style');
    //     style.type = 'text/css';
    //     style.styleSheet.cssText = ':before,:after{content:none !important;}';
    //     head.appendChild(style);
    //     setTimeout(function() {
    //       head.removeChild(style);
    //     }, 0);
    //   };
    // }
  }
}

// (function(global) {

//   utils.makeEventEmitter(Firepad);

//   // For readability, these are the primary "constructors", even though right now they're just aliases for Firepad.
//   Firepad.fromCodeMirror = Firepad;
//   Firepad.fromACE = Firepad;
//   Firepad.fromMonaco = Firepad;

//   Firepad.prototype.dispose = function() {
//     this.zombie_ = true; // We've been disposed.  No longer valid to do anything.

//     // Unwrap the editor.
//     // let editorWrapper = this.codeMirror_ ? this.codeMirror_.getWrapperElement() : this.ace_.container;
//     if (this.codeMirror_) {
//       editorWrapper = this.codeMirror_.getWrapperElement();
//     } else if (this.ace_) {
//       editorWrapper = this.ace_.container;
//     } else {
//       editorWrapper = this.monaco_.getDomNode();
//     }

//     this.firepadWrapper_.removeChild(editorWrapper);
//     this.firepadWrapper_.parentNode.replaceChild(editorWrapper, this.firepadWrapper_);

//     this.editor_.firepad = null;

//     if (this.codeMirror_ && this.codeMirror_.getOption('keyMap') === 'richtext') {
//       this.codeMirror_.setOption('keyMap', 'default');
//     }

//     this.firebaseAdapter_.dispose();
//     this.editorAdapter_.detach();
//     if (this.richTextCodeMirror_) {
//       this.richTextCodeMirror_.detach();
//     }
//   };

//   Firepad.prototype.setUserId = function(userId) {
//     this.firebaseAdapter_.setUserId(userId);
//   };

//   Firepad.prototype.setUserColor = function(color) {
//     this.firebaseAdapter_.setColor(color);
//   };

//   Firepad.prototype.getText = function() {
//     this.assertReady_('getText');
//     if (this.codeMirror_) {
//       return this.richTextCodeMirror_.getText();
//     } else if (this.ace_) {
//       return this.ace_
//         .getSession()
//         .getDocument()
//         .getValue();
//     } else {
//       return this.monaco_.getModel().getValue();
//     }
//   };

//   Firepad.prototype.setText = function(textPieces) {
//     this.assertReady_('setText');
//     if (this.monaco_) {
//       return this.monaco_.getModel().setValue(textPieces);
//     } else if (this.ace_) {
//       return this.ace_
//         .getSession()
//         .getDocument()
//         .setValue(textPieces);
//     } else {
//       // HACK: Hide CodeMirror during setText to prevent lots of extra renders.
//       this.codeMirror_.getWrapperElement().setAttribute('style', 'display: none');
//       this.codeMirror_.setValue('');
//       this.insertText(0, textPieces);
//       this.codeMirror_.getWrapperElement().setAttribute('style', '');
//       this.codeMirror_.refresh();
//     }
//     this.editorAdapter_.setCursor({position: 0, selectionEnd: 0});
//   };

//   Firepad.prototype.insertTextAtCursor = function(textPieces) {
//     this.insertText(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), textPieces);
//   };

//   Firepad.prototype.insertText = function(index, textPieces) {
//     utils.assert(!this.ace_, 'Not supported for ace yet.');
//     utils.assert(!this.monaco_, 'Not supported for monaco yet.');
//     this.assertReady_('insertText');

//     // Wrap it in an array if it's not already.
//     if (Object.prototype.toString.call(textPieces) !== '[object Array]') {
//       textPieces = [textPieces];
//     }

//     let self = this;
//     self.codeMirror_.operation(function() {
//       // HACK: We should check if we're actually at the beginning of a line; but checking for index == 0 is sufficient
//       // for the setText() case.
//       let atNewLine = index === 0;
//       let inserts = firepad.textPiecesToInserts(atNewLine, textPieces);

//       for (let i = 0; i < inserts.length; i++) {
//         let string = inserts[i].string;
//         let attributes = inserts[i].attributes;
//         self.richTextCodeMirror_.insertText(index, string, attributes);
//         index += string.length;
//       }
//     });
//   };

//   Firepad.prototype.getOperationForSpan = function(start, end) {
//     let text = this.richTextCodeMirror_.getRange(start, end);
//     let spans = this.richTextCodeMirror_.getAttributeSpans(start, end);
//     let pos = 0;
//     let op = new firepad.TextOperation();
//     for (let i = 0; i < spans.length; i++) {
//       op.insert(text.substr(pos, spans[i].length), spans[i].attributes);
//       pos += spans[i].length;
//     }
//     return op;
//   };

//   Firepad.prototype.getHtml = function() {
//     return this.getHtmlFromRange(null, null);
//   };

//   Firepad.prototype.getHtmlFromSelection = function() {
//     let startPos = this.codeMirror_.getCursor('start'),
//       endPos = this.codeMirror_.getCursor('end');
//     let startIndex = this.codeMirror_.indexFromPos(startPos),
//       endIndex = this.codeMirror_.indexFromPos(endPos);
//     return this.getHtmlFromRange(startIndex, endIndex);
//   };

//   Firepad.prototype.getHtmlFromRange = function(start, end) {
//     this.assertReady_('getHtmlFromRange');
//     let doc =
//       start != null && end != null
//         ? this.getOperationForSpan(start, end)
//         : this.getOperationForSpan(0, this.codeMirror_.getValue().length);
//     return firepad.SerializeHtml(doc, this.entityManager_);
//   };

//   Firepad.prototype.insertHtml = function(index, html) {
//     let lines = firepad.ParseHtml(html, this.entityManager_);
//     this.insertText(index, lines);
//   };

//   Firepad.prototype.insertHtmlAtCursor = function(html) {
//     this.insertHtml(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), html);
//   };

//   Firepad.prototype.setHtml = function(html) {
//     let lines = firepad.ParseHtml(html, this.entityManager_);
//     this.setText(lines);
//   };

//   Firepad.prototype.isHistoryEmpty = function() {
//     this.assertReady_('isHistoryEmpty');
//     return this.firebaseAdapter_.isHistoryEmpty();
//   };

//   Firepad.prototype.bold = function() {
//     this.richTextCodeMirror_.toggleAttribute(ATTR.BOLD);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.italic = function() {
//     this.richTextCodeMirror_.toggleAttribute(ATTR.ITALIC);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.underline = function() {
//     this.richTextCodeMirror_.toggleAttribute(ATTR.UNDERLINE);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.strike = function() {
//     this.richTextCodeMirror_.toggleAttribute(ATTR.STRIKE);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.fontSize = function(size) {
//     this.richTextCodeMirror_.setAttribute(ATTR.FONT_SIZE, size);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.font = function(font) {
//     this.richTextCodeMirror_.setAttribute(ATTR.FONT, font);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.color = function(color) {
//     this.richTextCodeMirror_.setAttribute(ATTR.COLOR, color);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.highlight = function() {
//     this.richTextCodeMirror_.toggleAttribute(ATTR.BACKGROUND_COLOR, 'rgba(255,255,0,.65)');
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.align = function(alignment) {
//     if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') {
//       throw new Error('align() must be passed "left", "center", or "right".');
//     }
//     this.richTextCodeMirror_.setLineAttribute(ATTR.LINE_ALIGN, alignment);
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.orderedList = function() {
//     this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'o');
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.unorderedList = function() {
//     this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'u');
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.todo = function() {
//     this.richTextCodeMirror_.toggleTodo();
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.newline = function() {
//     this.richTextCodeMirror_.newline();
//   };

//   Firepad.prototype.deleteLeft = function() {
//     this.richTextCodeMirror_.deleteLeft();
//   };

//   Firepad.prototype.deleteRight = function() {
//     this.richTextCodeMirror_.deleteRight();
//   };

//   Firepad.prototype.indent = function() {
//     this.richTextCodeMirror_.indent();
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.unindent = function() {
//     this.richTextCodeMirror_.unindent();
//     this.codeMirror_.focus();
//   };

//   Firepad.prototype.undo = function() {
//     this.codeMirror_.undo();
//   };

//   Firepad.prototype.redo = function() {
//     this.codeMirror_.redo();
//   };

//   Firepad.prototype.insertEntity = function(type, info, origin) {
//     this.richTextCodeMirror_.insertEntityAtCursor(type, info, origin);
//   };

//   Firepad.prototype.insertEntityAt = function(index, type, info, origin) {
//     this.richTextCodeMirror_.insertEntityAt(index, type, info, origin);
//   };

//   Firepad.prototype.registerEntity = function(type, options) {
//     this.entityManager_.register(type, options);
//   };

//   Firepad.prototype.getOption = function(option, def) {
//     return option in this.options_ ? this.options_[option] : def;
//   };

//   Firepad.prototype.assertReady_ = function(funcName) {
//     if (!this.ready_) {
//       throw new Error('You must wait for the "ready" event before calling ' + funcName + '.');
//     }
//     if (this.zombie_) {
//       throw new Error(
//         "You can't use a Firepad after calling dispose()!  [called " + funcName + ']'
//       );
//     }
//   };

//   Firepad.prototype.makeImageDialog_ = function() {
//     this.makeDialog_('img', 'Insert image url');
//   };

//   Firepad.prototype.makeDialog_ = function(id, placeholder) {
//     let self = this;

//     let hideDialog = function() {
//       let dialog = document.getElementById('overlay');
//       dialog.style.visibility = 'hidden';
//       self.firepadWrapper_.removeChild(dialog);
//     };

//     let cb = function() {
//       let dialog = document.getElementById('overlay');
//       dialog.style.visibility = 'hidden';
//       let src = document.getElementById(id).value;
//       if (src !== null) {
//         self.insertEntity(id, {src: src});
//       }
//       self.firepadWrapper_.removeChild(dialog);
//     };

//     let input = utils.elt('input', null, {
//       class: 'firepad-dialog-input',
//       id: id,
//       type: 'text',
//       placeholder: placeholder,
//       autofocus: 'autofocus',
//     });

//     let submit = utils.elt('a', 'Submit', {class: 'firepad-btn', id: 'submitbtn'});
//     utils.on(submit, 'click', utils.stopEventAnd(cb));

//     let cancel = utils.elt('a', 'Cancel', {class: 'firepad-btn'});
//     utils.on(cancel, 'click', utils.stopEventAnd(hideDialog));

//     let buttonsdiv = utils.elt('div', [submit, cancel], {class: 'firepad-btn-group'});

//     let div = utils.elt('div', [input, buttonsdiv], {class: 'firepad-dialog-div'});
//     let dialog = utils.elt('div', [div], {class: 'firepad-dialog', id: 'overlay'});

//     this.firepadWrapper_.appendChild(dialog);
//   };

//   Firepad.prototype.addToolbar_ = function() {
//     this.toolbar = new RichTextToolbar(this.imageInsertionUI);

//     this.toolbar.on('undo', this.undo, this);
//     this.toolbar.on('redo', this.redo, this);
//     this.toolbar.on('bold', this.bold, this);
//     this.toolbar.on('italic', this.italic, this);
//     this.toolbar.on('underline', this.underline, this);
//     this.toolbar.on('strike', this.strike, this);
//     this.toolbar.on('font-size', this.fontSize, this);
//     this.toolbar.on('font', this.font, this);
//     this.toolbar.on('color', this.color, this);
//     this.toolbar.on(
//       'left',
//       function() {
//         this.align('left');
//       },
//       this
//     );
//     this.toolbar.on(
//       'center',
//       function() {
//         this.align('center');
//       },
//       this
//     );
//     this.toolbar.on(
//       'right',
//       function() {
//         this.align('right');
//       },
//       this
//     );
//     this.toolbar.on('ordered-list', this.orderedList, this);
//     this.toolbar.on('unordered-list', this.unorderedList, this);
//     this.toolbar.on('todo-list', this.todo, this);
//     this.toolbar.on('indent-increase', this.indent, this);
//     this.toolbar.on('indent-decrease', this.unindent, this);
//     this.toolbar.on('insert-image', this.makeImageDialog_, this);

//     this.firepadWrapper_.insertBefore(this.toolbar.element(), this.firepadWrapper_.firstChild);
//   };

//   Firepad.prototype.addPoweredByLogo_ = function() {
//     let poweredBy = utils.elt('a', null, {class: 'powered-by-firepad'});
//     poweredBy.setAttribute('href', 'http://www.firepad.io/');
//     poweredBy.setAttribute('target', '_blank');
//     this.firepadWrapper_.appendChild(poweredBy);
//   };

//   Firepad.prototype.initializeKeyMap_ = function() {
//     function binder(fn) {
//       return function(cm) {
//         // HACK: CodeMirror will often call our key handlers within a cm.operation(), and that
//         // can mess us up (we rely on events being triggered synchronously when we make CodeMirror
//         // edits).  So to escape any cm.operation(), we do a setTimeout.
//         setTimeout(function() {
//           fn.call(cm.firepad);
//         }, 0);
//       };
//     }

//     CodeMirror.keyMap.richtext = {
//       'Ctrl-B': binder(this.bold),
//       'Cmd-B': binder(this.bold),
//       'Ctrl-I': binder(this.italic),
//       'Cmd-I': binder(this.italic),
//       'Ctrl-U': binder(this.underline),
//       'Cmd-U': binder(this.underline),
//       'Ctrl-H': binder(this.highlight),
//       'Cmd-H': binder(this.highlight),
//       Enter: binder(this.newline),
//       Delete: binder(this.deleteRight),
//       Backspace: binder(this.deleteLeft),
//       Tab: binder(this.indent),
//       'Shift-Tab': binder(this.unindent),
//       fallthrough: ['default'],
//     };
//   };

//   function colorFromUserId(userId) {
//     let a = 1;
//     for (let i = 0; i < userId.length; i++) {
//       a = (17 * (a + userId.charCodeAt(i))) % 360;
//     }
//     let hue = a / 360;

//     return hsl2hex(hue, 1, 0.75);
//   }

//   function rgb2hex(r, g, b) {
//     function digits(n) {
//       let m = Math.round(255 * n).toString(16);
//       return m.length === 1 ? '0' + m : m;
//     }
//     return '#' + digits(r) + digits(g) + digits(b);
//   }

//   function hsl2hex(h, s, l) {
//     if (s === 0) {
//       return rgb2hex(l, l, l);
//     }
//     let let2 = l < 0.5 ? l * (1 + s) : l + s - s * l;
//     let let1 = 2 * l - let2;
//     let hue2rgb = function(hue) {
//       if (hue < 0) {
//         hue += 1;
//       }
//       if (hue > 1) {
//         hue -= 1;
//       }
//       if (6 * hue < 1) {
//         return let1 + (let2 - let1) * 6 * hue;
//       }
//       if (2 * hue < 1) {
//         return let2;
//       }
//       if (3 * hue < 2) {
//         return let1 + (let2 - let1) * 6 * (2 / 3 - hue);
//       }
//       return let1;
//     };
//     return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3));
//   }

//   return Firepad;
// })(this);

// // Export Text classes
// firepad.Firepad.Formatting = firepad.Formatting;
// firepad.Firepad.Text = firepad.Text;
// firepad.Firepad.Entity = firepad.Entity;
// firepad.Firepad.LineFormatting = firepad.LineFormatting;
// firepad.Firepad.Line = firepad.Line;
// firepad.Firepad.TextOperation = firepad.TextOperation;
// firepad.Firepad.Headless = firepad.Headless;

// // Export adapters
// firepad.Firepad.RichTextCodeMirrorAdapter = firepad.RichTextCodeMirrorAdapter;
// firepad.Firepad.ACEAdapter = firepad.ACEAdapter;
// firepad.Firepad.MonacoAdapter = firepad.MonacoAdapter;
