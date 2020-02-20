import {editor, Selection, IDisposable, Range} from 'monaco-editor';
import {MonacoCursor, Mark} from '../constants';
import {TextOperation} from '../operations/text-operation';
import {Cursor} from '../managers/cursor';
import {WrappedOperation} from '../operations/wrapped-operation';

export class MonacoAdapter {
  public monaco: editor.IStandaloneCodeEditor;
  public monacoModel: editor.ITextModel;
  public lastDocLines: string[];
  public lastCursorRange: Selection | null;
  public callbacks: Record<any, any> = {};
  public otherCursors: MonacoCursor[] = [];
  public addedStyleRules: string[] = [];
  public ignoreChanges: boolean = false;
  public disposables: IDisposable[];

  constructor(monacoInstance: editor.IStandaloneCodeEditor) {
    this.monaco = monacoInstance;
    this.monacoModel = this.monaco.getModel()!;
    this.lastDocLines = this.monacoModel.getLinesContent();
    this.lastCursorRange = this.monaco.getSelection();
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
    let selection = this.monaco.getSelection();

    /** Fallback to last cursor change */
    if (typeof selection === 'undefined' || selection === null) {
      selection = this.lastCursorRange;
    }

    /** Obtain selection indexes */
    let startPos = selection.getStartPosition();
    let endPos = selection.getEndPosition();
    let start = this.monacoModel.getOffsetAt(startPos);
    let end = this.monacoModel.getOffsetAt(endPos);

    /** If Selection is Inversed */
    if (start > end) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }

    /** Return cursor position */
    return new Cursor(start, end);
  }

  /** Set Selection on Monaco Editor Instance */
  public setCursor(cursor: MonacoCursor) {
    let start = this.monacoModel.getPositionAt(cursor.position);
    let end = this.monacoModel.getPositionAt(cursor.selectionEnd);

    /** If selection is inversed */
    if (cursor.position > cursor.selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }

    /** Create Selection in the Editor */
    this.monaco.setSelection(new Range(start.lineNumber, start.column, end.lineNumber, end.column));
  }

  /** Set Remote Selection on Monaco Editor */
  public setOtherCursor(
    cursor: MonacoCursor,
    color: string,
    clientID: string | number
  ): Mark | undefined {
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

    /** Fetch Client Cursor Information or Initialize empty array, if client does not exist */
    let otherCursor: MonacoCursor = this.otherCursors.find((c) => c.clientID === clientID) || {
      clientID: clientID,
      decoration: [],
    };

    /** Remove Earlier Decorations, if any, or initialize empty decor */
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration!, []);
    let className = 'other-client-selection-' + color.replace('#', '');
    if (cursor.position === cursor.selectionEnd) {
      className = className.replace('selection', 'cursor');
      this.addStyleRule(className, this.getCSS(className, 'transparent', color));
    } else {
      this.addStyleRule(className, this.getCSS(className, color, color));
    }

    /** Get co-ordinate position in Editor */
    let start = this.monacoModel.getPositionAt(cursor.position);
    let end = this.monacoModel.getPositionAt(cursor.selectionEnd);

    /** Selection is inversed */
    if (cursor.position > cursor.selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }

    /** Add decoration to the Editor */
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration, [
      {
        range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {className},
      },
    ]);

    /** Clear cursor method */
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
    /** Change Informations */
    let text = change.text;
    let rangeLength = change.rangeLength;
    let rangeOffset = change.rangeOffset + offset;

    /** Additional SEEK distance */
    let restLength = content.length + offset - rangeOffset;

    /** Declare OT.js Operation letiables */
    let change_op, inverse_op, replaced_text;

    if (text.length === 0 && rangeLength > 0) {
      /** Delete Operation */
      replaced_text = content.slice(rangeOffset, rangeOffset + rangeLength);

      change_op = new TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .retain(restLength - rangeLength);

      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else if (text.length > 0 && rangeLength > 0) {
      /** Replace Operation */
      replaced_text = content.slice(rangeOffset, rangeOffset + rangeLength);

      change_op = new TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .insert(text)
        .retain(restLength - rangeLength);

      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .delete(text.length)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else {
      /** Insert Operation */
      change_op = new TextOperation()
        .retain(rangeOffset)
        .insert(text)
        .retain(restLength);

      inverse_op = new TextOperation()
        .retain(rangeOffset)
        .delete(text)
        .retain(restLength);
    }

    return [change_op, inverse_op];
  }

  /**
   * @method onChange - OnChange Event Handler
   * @param {Object} event - OnChange Event Delegate
   */
  public onChange = (event: editor.IModelContentChangedEvent) => {
    if (!this.ignoreChanges) {
      let content = this.lastDocLines.join(this.monacoModel.getEOL());
      let offset = 0;

      /** If no change information recieved */
      if (!event.changes) {
        const op = new TextOperation().retain(content.length);
        this.trigger('change', op, op);
      }

      /** Reverse iterate all changes */
      event.changes.reverse().forEach((change) => {
        const pair = this.operationFromMonacoChanges(change, content, offset);
        offset += pair[0].targetLength - pair[0].baseLength;
        this.trigger.apply(this, ['change'].concat(pair));
      });

      /** Update Editor Content */
      this.lastDocLines = this.monacoModel.getLinesContent();
    }
  };

  /** Event Handler taking in specific event and callback arguments */
  public trigger(event: string, ...args: any[]) {
    if (!this.callbacks.hasOwnProperty(event)) {
      return;
    }
    let action = this.callbacks[event];
    if (!typeof action === 'function') {
      return;
    }
    action.apply(null, args);
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

  /**
   * @method applyOperation
   * @param {Operation} operation - OT.js Operation Object
   */
  public applyOperation(operation: TextOperation) {
    if (!operation.isNoop()) {
      this.ignoreChanges = true;
    }

    /** Get Operations List */
    let opsList = operation.ops;
    let index = 0;

    opsList.forEach((op) => {
      /** Retain Operation */
      if (op.isRetain()) {
        index += op.chars;
      } else if (op.isInsert()) {
        /** Insert Operation */
        let pos = this.monacoModel.getPositionAt(index);

        this.monaco.executeEdits('my-source', [
          {
            range: new Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: op.text,
            forceMoveMarkers: true,
          },
        ]);

        index += op.text.length;
      } else if (op.isDelete()) {
        /** Delete Operation */
        let from = this.monacoModel.getPositionAt(index);
        let to = this.monacoModel.getPositionAt(index + op.chars);

        this.monaco.executeEdits('my-source', [
          {
            range: new Range(from.lineNumber, from.column, to.lineNumber, to.column),
            text: '',
            forceMoveMarkers: true,
          },
        ]);
      }
    });

    /** Update Editor Content and Reset Config */
    this.lastDocLines = this.monacoModel.getLinesContent();
    this.ignoreChanges = false;
  }

  public invertOperation(operation: TextOperation) {
    operation.invert(this.monaco.getValue());
  }
}
