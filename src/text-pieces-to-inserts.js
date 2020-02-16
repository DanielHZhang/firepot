import {Text} from './text';

/**
 * Helper to turn pieces of text into insertable operations
 */
function textPiecesToInserts(atNewLine, textPieces) {
  const inserts = [];

  function insert(str, attributes) {
    if (str instanceof Text) {
      attributes = str.formatting.attributes;
      str = str.text;
    }
    inserts.push({string: str, attributes: attributes});
    atNewLine = str[str.length - 1] === '\n';
  }

  function insertLine(line, withNewline) {
    // HACK: We should probably force a newline if there isn't one already.  But due to
    // the way this is used for inserting HTML, we end up inserting a "line" in the middle
    // of text, in which case we don't want to actually insert a newline.
    if (atNewLine) {
      insert(firepad.sentinelConstants.LINE_SENTINEL_CHARACTER, line.formatting.attributes);
    }

    for (let i = 0; i < line.textPieces.length; i++) {
      insert(line.textPieces[i]);
    }

    if (withNewline) {
      insert('\n');
    }
  }

  for (let i = 0; i < textPieces.length; i++) {
    if (textPieces[i] instanceof firepad.Line) {
      insertLine(textPieces[i], i < textPieces.length - 1);
    } else {
      insert(textPieces[i]);
    }
  }

  return inserts;
}
