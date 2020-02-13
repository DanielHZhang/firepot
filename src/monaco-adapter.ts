import {editor, languages, Selection, IDisposable} from 'monaco-editor';
// import * as monaco from 'monaco-editor';

/**
 * @param {String} clazz - CSS Class Name
 * @param {String} bgColor - Background Color
 * @param {String} color - Font Color
 * @returns CSS Style Rules according to Parameters
 */
const getCSS = (clazz: string, bgColor: string, color: string) => {
  return (
    '.' +
    clazz +
    ' {\n  position: relative;\n' +
    'background-color: ' +
    bgColor +
    ';\n' +
    'border-left: 2px solid ' +
    color +
    ';\n}'
  );
};

/**
 * @function addStyleRule - For Internal Usage Only
 * @desc Creates style element in document head and pushed all the style rules
 * @param {String} clazz - CSS Class Name
 * @param {String} css - CSS Style Rules
 */
const addStyleRule = (clazz: string, css: string) => {
  /** House Keeping */
  if (typeof document === 'undefined' || document === null) {
    return;
  }

  /** Add style rules only once */
  if (this.addedStyleRules.indexOf(clazz) === -1) {
    let styleElement = document.createElement('style');
    let styleSheet = document.createTextNode(css);
    styleElement.appendChild(styleSheet);
    document.head.appendChild(styleElement);
    this.addedStyleRules.push(clazz);
  }
};

class MonAdapter {
  public monaco: editor.IStandaloneCodeEditor;
  public monacoModel: editor.ITextModel;
  public lastDocLines: string[];
  public lastCursorRange: Selection | null;
  public callbacks = {};
  public otherCursors = [];
  public addedStyleRules = [];
  public ignoreChanges = false;
  public changeHandler: IDisposable;
  public didBlurHandler: IDisposable;
  public didFocusHandler: IDisposable;
  public didChangeCursorPositionHandler: IDisposable;

  constructor(monacoInstance: editor.IStandaloneCodeEditor) {
    this.monaco = monacoInstance;
    this.monacoModel = this.monaco.getModel()!;
    this.lastDocLines = this.monacoModel.getLinesContent();
    this.lastCursorRange = this.monaco.getSelection();

    /** Adapter Callback Functions */
    this.onChange = this.onChange.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onCursorActivity = this.onCursorActivity.bind(this);

    /** Editor Callback Handler */
    this.changeHandler = this.monaco.onDidChangeModelContent(this.onChange);
    this.didBlurHandler = this.monaco.onDidBlurEditorWidget(this.onBlur);
    this.didFocusHandler = this.monaco.onDidFocusEditorWidget(this.onFocus);
    this.didChangeCursorPositionHandler = this.monaco.onDidChangeCursorPosition(
      this.onCursorActivity
    );
  }

  /** Clears an Instance of Editor Adapter */
  public detach() {
    this.changeHandler.dispose();
    this.didBlurHandler.dispose();
    this.didFocusHandler.dispose();
    this.didChangeCursorPositionHandler.dispose();
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
    return new firepad.Cursor(start, end);
  }

  /**
   * @method setCursor - Set Selection on Monaco Editor Instance
   * @param {Object} cursor - Cursor Position (start and end)
   * @param {Number} cursor.position - Starting Position of the Cursor
   * @param {Number} cursor.selectionEnd - Ending Position of the Cursor
   */
  public setCursor(cursor) {
    let position = cursor.position;
    let selectionEnd = cursor.selectionEnd;
    let start = this.monacoModel.getPositionAt(position);
    let end = this.monacoModel.getPositionAt(selectionEnd);

    /** If selection is inversed */
    if (position > selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }

    /** Create Selection in the Editor */
    this.monaco.setSelection(
      new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
    );
  }

  /**
   * @method setOtherCursor - Set Remote Selection on Monaco Editor
   * @param {Number} cursor.position - Starting Position of the Selection
   * @param {Number} cursor.selectionEnd - Ending Position of the Selection
   * @param {String} color - Hex Color codes for Styling
   * @param {any} clientID - ID number of the Remote Client
   */
  public setOtherCursor(cursor, color, clientID) {
    /** House Keeping */
    if (
      typeof cursor !== 'object' ||
      typeof cursor.position !== 'number' ||
      typeof cursor.selectionEnd !== 'number'
    ) {
      return false;
    }

    if (typeof color !== 'string' || !color.match(/^#[a-fA-F0-9]{3,6}$/)) {
      return false;
    }

    /** Extract Positions */
    let position = cursor.position;
    let selectionEnd = cursor.selectionEnd;

    if (position < 0 || selectionEnd < 0) {
      return false;
    }

    /** Fetch Client Cursor Information */
    let otherCursor = this.otherCursors.find(function(cursor) {
      return cursor.clientID === clientID;
    });

    /** Initialize empty array, if client does not exist */
    if (!otherCursor) {
      otherCursor = {
        clientID: clientID,
        decoration: [],
      };
      this.otherCursors.push(otherCursor);
    }

    /** Remove Earlier Decorations, if any, or initialize empty decor */
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration, []);
    let clazz = 'other-client-selection-' + color.replace('#', '');
    let css, ret;

    if (position === selectionEnd) {
      /** Show only cursor */
      clazz = clazz.replace('selection', 'cursor');

      /** Generate Style rules and add them to document */
      css = getCSS(clazz, 'transparent', color);
      ret = addStyleRule.call(this, clazz, css);
    } else {
      /** Generate Style rules and add them to document */
      css = getCSS(clazz, color, color);
      ret = addStyleRule.call(this, clazz, css);
    }

    /** Return if failed to add css */
    if (ret == false) {
      console.log(
        'Monaco Adapter: Failed to add some css style.\n' +
          "Please make sure you're running on supported environment."
      );
    }

    /** Get co-ordinate position in Editor */
    let start = this.monacoModel.getPositionAt(position);
    let end = this.monacoModel.getPositionAt(selectionEnd);

    /** Selection is inversed */
    if (position > selectionEnd) {
      let _ref = [end, start];
      start = _ref[0];
      end = _ref[1];
    }

    /** Add decoration to the Editor */
    otherCursor.decoration = this.monaco.deltaDecorations(otherCursor.decoration, [
      {
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          className: clazz,
        },
      },
    ]);

    /** Clear cursor method */
    let _this = this;
    return {
      clear: function clear() {
        otherCursor.decoration = _this.monaco.deltaDecorations(otherCursor.decoration, []);
      },
    };
  }

  /**
   * @method registerCallbacks - Assign callback functions to internal property
   * @param {function[]} callbacks - Set of callback functions
   */
  public registerCallbacks(callbacks) {
    this.callbacks = Object.assign({}, this.callbacks, callbacks);
  }

  /**
   * @method registerUndo
   * @param {function} callback - Callback Handler for Undo Event
   */
  public registerUndo(callback) {
    if (typeof callback === 'function') {
      this.callbacks.undo = callback;
    } else {
      throw new Error(
        'MonacoAdapter: registerUndo method expects a ' + 'callback function in parameter'
      );
    }
  }

  /**
   * @method registerRedo
   * @param {function} callback - Callback Handler for Redo Event
   */
  public registerRedo(callback) {
    if (typeof callback === 'function') {
      this.callbacks.redo = callback;
    } else {
      throw new Error(
        'MonacoAdapter: registerRedo method expects a ' + 'callback function in parameter'
      );
    }
  }

  /**
   * @method operationFromMonacoChanges - Convert Monaco Changes to OT.js Ops
   * @param {Object} change - Change in Editor
   * @param {string} content - Last Editor Content
   * @param {Number} offset - Offset between changes of same event
   * @returns Pair of Operation and Inverse
   * Note: OT.js Operation expects the cursor to be at the end of content
   */
  public operationFromMonacoChanges(change, content, offset) {
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

      change_op = new firepad.TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .retain(restLength - rangeLength);

      inverse_op = new firepad.TextOperation()
        .retain(rangeOffset)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else if (text.length > 0 && rangeLength > 0) {
      /** Replace Operation */
      replaced_text = content.slice(rangeOffset, rangeOffset + rangeLength);

      change_op = new firepad.TextOperation()
        .retain(rangeOffset)
        .delete(rangeLength)
        .insert(text)
        .retain(restLength - rangeLength);

      inverse_op = new firepad.TextOperation()
        .retain(rangeOffset)
        .delete(text.length)
        .insert(replaced_text)
        .retain(restLength - rangeLength);
    } else {
      /** Insert Operation */
      change_op = new firepad.TextOperation()
        .retain(rangeOffset)
        .insert(text)
        .retain(restLength);

      inverse_op = new firepad.TextOperation()
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
  public onChange(event) {
    let _this = this;

    if (!this.ignoreChanges) {
      let content = this.lastDocLines.join(this.monacoModel.getEOL());
      let offset = 0;

      /** If no change information recieved */
      if (!event.changes) {
        let op = new firepad.TextOperation().retain(content.length);
        this.trigger('change', op, op);
      }

      /** Reverse iterate all changes */
      event.changes.reverse().forEach(function(change) {
        let pair = _this.operationFromMonacoChanges(change, content, offset);
        offset += pair[0].targetLength - pair[0].baseLength;

        _this.trigger.apply(_this, ['change'].concat(pair));
      });

      /** Update Editor Content */
      this.lastDocLines = this.monacoModel.getLinesContent();
    }
  }

  /**
   * @method trigger - Event Handler
   * @param {string} event - Event name
   * @param  {...any} args - Callback arguments
   */
  public trigger(event) {
    if (!this.callbacks.hasOwnProperty(event)) {
      return;
    }

    let action = this.callbacks[event];

    if (!typeof action === 'function') {
      return;
    }

    let args = [];

    if (arguments.length > 1) {
      for (let i = 1; i < arguments.length; i++) {
        args.push(arguments[i]);
      }
    }

    action.apply(null, args);
  }

  /**
   * @method onBlur - Blur event handler
   */
  public onBlur() {
    if (this.monaco.getSelection()?.isEmpty()) {
      this.trigger('blur');
    }
  }

  /**
   * @method onFocus - Focus event handler
   */
  public onFocus() {
    this.trigger('focus');
  }

  /**
   * @method onCursorActivity - CursorActivity event handler
   */
  public onCursorActivity() {
    setTimeout(() => this.trigger('cursorActivity'), 1);
  }

  /**
   * @method applyOperation
   * @param {Operation} operation - OT.js Operation Object
   */
  public applyOperation(operation) {
    if (!operation.isNoop()) {
      this.ignoreChanges = true;
    }

    /** Get Operations List */
    let opsList = operation.ops;
    let index = 0;

    let _this = this;
    opsList.forEach(function(op) {
      /** Retain Operation */
      if (op.isRetain()) {
        index += op.chars;
      } else if (op.isInsert()) {
        /** Insert Operation */
        let pos = _this.monacoModel.getPositionAt(index);

        _this.monaco.executeEdits('my-source', [
          {
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: op.text,
            forceMoveMarkers: true,
          },
        ]);

        index += op.text.length;
      } else if (op.isDelete()) {
        /** Delete Operation */
        let from = _this.monacoModel.getPositionAt(index);
        let to = _this.monacoModel.getPositionAt(index + op.chars);

        _this.monaco.executeEdits('my-source', [
          {
            range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
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

  /**
   * @method invertOperation
   * @param {Operation} operation - OT.js Operation Object
   */
  public invertOperation(operation) {
    operation.invert(this.getValue());
  }
}
