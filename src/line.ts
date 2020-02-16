// /** Object to represent a Formatted line. */
// export class Line {
//   public textPieces: string[];
//   public formatting: LineFormatting;

//   constructor(textPieces: string[], formatting?: LineFormatting) {
//     if (Object.toString.call(textPieces) !== '[object Array]') {
//       if (typeof textPieces === 'undefined') {
//         textPieces = [];
//       } else {
//         textPieces = [textPieces];
//       }
//     }

//     this.textPieces = textPieces;
//     this.formatting = formatting || new LineFormatting();
//   }
// }
