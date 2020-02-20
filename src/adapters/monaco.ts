import {editor, Selection, IDisposable, Range} from 'monaco-editor';
import {MonacoCursor} from '../constants';
import {TextOperation} from '../operations/text';
import {Cursor} from '../managers/cursor';
import {assert} from '../utils';

export class MonacoAdapter {
  public monaco: editor.IStandaloneCodeEditor;
  public monacoModel: editor.ITextModel;
  public lastDocLines: string[];
  public lastCursorRange: Selection;
  public callbacks: Record<string, Function> = {};
  public otherCursors: MonacoCursor[] = [];
  public addedStyleRules: string[] = [];
  public ignoreChanges: boolean = false;
  public disposables: IDisposable[];

  constructor(monacoInstance: editor.IStandaloneCodeEditor) {
    this.monaco = monacoInstance;
    this.monacoModel = this.monaco.getModel()!;
    this.lastDocLines = this.monacoModel.getLinesContent();
    this.lastCursorRange = this.monaco.getSelection()!;
    this.disposables = [
      this.monaco.onDidChangeModelContent(this.onChange),
      this.monaco.onDidBlurEditorWidget(this.onBlur),
      this.monaco.onDidFocusEditorWidget(this.onFocus),
      this.monaco.onDidChangeCursorPosition(this.onCursorActivity),
    ];
  }

  /** Creates style element in document head and pushed all the style rules */
  private addStyleRule(clazz: string, css: string) {
    if (typeof document === 'undefined' || document === null) {
      return;
    }
    /** Add style rules only once */
    if (this.addedStyleRules.indexOf(clazz) === -1) {
      const styleElement = document.createElement('style');
      const styleSheet = document.createTextNode(css);
      styleElement.appendChild(styleSheet);
      document.head.appendChild(styleElement);
      this.addedStyleRules.push(clazz);
    }
  }

  /** Gets CSS class name for a cursor */
  private getCSS = (className: string, bgColor: string, color: string) => {
    return `
     .${className} {
       position: relative;
       background-color: ${bgColor};
       border-left: 2px solid ${color};
     }
   `;
  };

  /** Clears an Instance of Editor Adapter */
  public detach() {
    this.disposables.forEach((dis) => dis.dispose());
  }

  /** Get current cursor position */
  public getCursor() {
    const selection = this.monaco.getSelection() || this.lastCursorRange;
    // Obtain selection indexes
    const startPos = selection.getStartPosition();
    const endPos = selection.getEndPosition();
    let start = this.monacoModel.getOffsetAt(startPos);
    let end = this.monacoModel.getOffsetAt(endPos);
    // If selection is inversed
    if (start > end) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }
    // Return cursor position
    return new Cursor(start, end);
  }

  /** Set Selection on Monaco Editor Instance */
  public setCursor(cursor: MonacoCursor) {
    assert(typeof cursor.position === 'number' && typeof cursor.selectionEnd === 'number');
    let start = this.monacoModel.getPositionAt(cursor.position);
    let end = this.monacoModel.getPositionAt(cursor.selectionEnd);
    // If selection is inversed
    if (cursor.position > cursor.selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }
    // Create Selection in the Editor
    this.monaco.setSelection(new Range(start.lineNumber, start.column, end.lineNumber, end.column));
  }

  /** Set Remote Selection on Monaco Editor */
  public setOtherCursor(cursor: MonacoCursor, color: string, clientId: string | number) {
    if (
      typeof cursor !== 'object' ||
      typeof cursor.position !== 'number' ||
      typeof cursor.selectionEnd !== 'number' ||
      typeof color !== 'string' ||
      !color.match(/^#[a-fA-F0-9]{3,6}$/) ||
      cursor.position < 0 ||
      cursor.selectionEnd < 0
    ) {
      return;
    }
    // Fetch Client Cursor Information or Initialize empty array, if client does not exist
    const otherCursor: MonacoCursor = this.otherCursors.find((c) => c.clientID === clientId) || {
      clientID: clientId,
      decoration: [],
    };
    // Remove Earlier Decorations, if any, or initialize empty decor
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration!, []);
    let className = 'other-client-selection-' + color.replace('#', '');
    if (cursor.position === cursor.selectionEnd) {
      className = className.replace('selection', 'cursor');
      this.addStyleRule(className, this.getCSS(className, 'transparent', color));
    } else {
      this.addStyleRule(className, this.getCSS(className, color, color));
    }
    // Get co-ordinate position in Editor
    let start = this.monacoModel.getPositionAt(cursor.position);
    let end = this.monacoModel.getPositionAt(cursor.selectionEnd);
    // Selection is inversed
    if (cursor.position > cursor.selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }
    // Add decoration to the Editor
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration, [
      {
        range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {className},
      },
    ]);
    // Clear cursor method
    return {
      clear: () => {
        otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration!, []);
      },
    };
  }

  /** Assign callback functions to internal property */
  public registerCallbacks(callbacks: Record<string, Function>) {
    this.callbacks = Object.assign({}, this.callbacks, callbacks);
  }

  /** Callback Handler for Undo Event */
  public registerUndo(callback: Function) {
    this.callbacks.undo = callback;
  }

  /** Callback Handler for Redo Event */
  public registerRedo(callback: Function) {
    this.callbacks.redo = callback;
  }

  /**
   * @method operationFromMonacoChanges -
   * @param {Object} change - Change in Editor
   * @param {string} content - Last Editor Content
   * @param {Number} offset - Offset between changes of same event
   * @returns Pair of Operation and Inverse
   *
   */
  /**
   * Convert Monaco Changes to OT.js Ops
   * Note: OT.js Operation expects the cursor to be at the end of content
   */
  public operationFromMonacoChanges(
    change: editor.IModelContentChange,
    content: string,
    offset: number
  ) {
    const rangeLength = change.rangeLength;
    const rangeOffset = change.rangeOffset + offset;
    const restLength = content.length + offset - rangeOffset; // Additional seek distance
    let change_op, inverse_op, replaced_text;
    if (change.text.length === 0 && rangeLength > 0) {
      // Delete Operation
      replaced_text = content.slice(rangeOffset, rangeOffset + rangeLength);
      change_op = new TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .retain(restLength - rangeLength);
      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else if (change.text.length > 0 && rangeLength > 0) {
      // Replace Operation
      replaced_text = content.slice(rangeOffset, rangeOffset + rangeLength);
      change_op = new TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .insert(change.text)
        .retain(restLength - rangeLength);
      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .delete(change.text.length)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else {
      // Insert Operation
      change_op = new TextOperation()
        .retain(rangeOffset)
        .insert(change.text)
        .retain(restLength);
      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .delete(change.text)
        .retain(restLength);
    }
    return [change_op, inverse_op];
  }

  public onChange = (event: editor.IModelContentChangedEvent) => {
    if (!this.ignoreChanges) {
      const content = this.lastDocLines.join(this.monacoModel.getEOL());
      let offset = 0;
      // If no change information recieved
      if (!event.changes) {
        const op = new TextOperation().retain(content.length);
        this.trigger('change', op, op);
      }
      // Reverse iterate all changes
      event.changes.reverse().forEach((change) => {
        const pair = this.operationFromMonacoChanges(change, content, offset);
        offset += pair[0].targetLength - pair[0].baseLength;
        this.trigger('change', ...pair);
        // this.trigger.apply(this, ['change'].concat(pair));
      });
      // Update Editor Content
      this.lastDocLines = this.monacoModel.getLinesContent();
    }
  };

  /** Event Handler taking in specific event and callback arguments */
  public trigger(event: string, ...args: any[]) {
    if (!this.callbacks.hasOwnProperty(event)) {
      return;
    }
    this.callbacks[event](...args);
    // let action = this.callbacks[event];
    // if (typeof action !== 'function') {
    //   return;
    // }
    // action.apply(null, args);
  }

  /** Blur event handler */
  public onBlur = () => {
    if (this.monaco.getSelection()?.isEmpty()) {
      this.trigger('blur');
    }
  };

  /** Focus event handler */
  public onFocus = () => {
    this.trigger('focus');
  };

  /** CursorActivity event handler */
  public onCursorActivity = () => {
    setTimeout(() => this.trigger('cursorActivity'), 1);
  };

  public applyOperation(operation: TextOperation) {
    if (!operation.isNoop()) {
      this.ignoreChanges = true;
    }
    // Get Operations List
    let opsList = operation.ops;
    let index = 0;

    opsList.forEach((op) => {
      if (op.isRetain()) {
        // Retain Operation
        index += op.chars!;
      } else if (op.isInsert()) {
        // Insert Operation
        const pos = this.monacoModel.getPositionAt(index);
        this.monaco.executeEdits('my-source', [
          {
            range: new Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: op.text ?? null,
            forceMoveMarkers: true,
          },
        ]);
        assert(typeof op.text === 'string');
        index += op.text.length;
      } else if (op.isDelete()) {
        // Delete Operation
        assert(typeof op.chars === 'number');
        const from = this.monacoModel.getPositionAt(index);
        const to = this.monacoModel.getPositionAt(index + op.chars);
        this.monaco.executeEdits('my-source', [
          {
            range: new Range(from.lineNumber, from.column, to.lineNumber, to.column),
            text: '',
            forceMoveMarkers: true,
          },
        ]);
      }
    });
    // Update editor content and reset config
    this.lastDocLines = this.monacoModel.getLinesContent();
    this.ignoreChanges = false;
  }

  public invertOperation(operation: TextOperation) {
    operation.invert(this.monaco.getValue());
  }
}
