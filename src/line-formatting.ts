// import {Attributes} from './constants';

// const LIST_TYPE = {
//   NONE: false,
//   ORDERED: 'o',
//   UNORDERED: 'u',
//   TODO: 't',
//   TODOCHECKED: 'tc',
// };

// /** Object to represent line formatting.  Formatting can be modified by chaining method calls. */
// export class LineFormatting {
//   public attributes: Record<string, any>;

//   constructor(attributes?: Record<string, any>) {
//     this.attributes = attributes || {};
//     this.attributes[Attributes.LINE_SENTINEL] = true;
//   }

//   cloneWithNewAttribute_(attribute, value) {
//     let attributes = {};

//     // Copy existing.
//     for (let attr in this.attributes) {
//       attributes[attr] = this.attributes[attr];
//     }

//     // Add new one.
//     if (value === false) {
//       delete attributes[attribute];
//     } else {
//       attributes[attribute] = value;
//     }

//     return new LineFormatting(attributes);
//   }

//   indent(indent) {
//     return this.cloneWithNewAttribute_(ATTR.LINE_INDENT, indent);
//   }

//   align(align) {
//     return this.cloneWithNewAttribute_(ATTR.LINE_ALIGN, align);
//   }

//   listItem(val) {
//     firepad.utils.assert(
//       val === false || val === 'u' || val === 'o' || val === 't' || val === 'tc'
//     );
//     return this.cloneWithNewAttribute_(ATTR.LIST_TYPE, val);
//   }

//   getIndent() {
//     return this.attributes[ATTR.LINE_INDENT] || 0;
//   }

//   getAlign() {
//     return this.attributes[ATTR.LINE_ALIGN] || 0;
//   }

//   getListItem() {
//     return this.attributes[ATTR.LIST_TYPE] || false;
//   }
// }
