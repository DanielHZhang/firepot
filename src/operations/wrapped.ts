import {TextOperation} from './text';
import {SelfMeta} from '../client/self-meta';

// Copy all properties from source to target.
function copy(source: Record<any, any>, target: Record<any, any>) {
  for (let key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }
}

function composeMeta(a: SelfMeta, b: any) {
  if (a && typeof a === 'object') {
    if (typeof a.compose === 'function') {
      return a.compose(b);
    }
    let meta = {};
    copy(a, meta);
    copy(b, meta);
    return meta;
  }
  return b;
}

function transformMeta(meta?: SelfMeta, operation?: TextOperation) {
  if (meta && typeof meta === 'object') {
    if (typeof meta.transform === 'function') {
      return meta.transform(operation!);
    }
  }
  return meta;
}

export class WrappedOperation {
  public wrapped: TextOperation;
  public meta?: SelfMeta | null;

  // A WrappedOperation contains an operation and corresponing metadata.
  constructor(operation: TextOperation, meta?: SelfMeta | null) {
    this.wrapped = operation;
    this.meta = meta;
  }

  public static transform(
    a: WrappedOperation,
    b: WrappedOperation
  ): [WrappedOperation, WrappedOperation] {
    const pair = a.wrapped.transform(b.wrapped);
    return [
      new WrappedOperation(pair[0], transformMeta(a.meta!, b.wrapped)),
      new WrappedOperation(pair[1], transformMeta(b.meta!, a.wrapped)),
    ];
  }

  // convenience method to write transform(a, b) as a.transform(b)
  public transform(other: WrappedOperation) {
    return WrappedOperation.transform(this, other);
  }

  public apply(...args: [string, Record<string, any>[]?, Record<string, any>[]?]) {
    return this.wrapped.apply(...args);
    // return this.wrapped.apply.apply(this.wrapped, arguments);
  }

  public invert(str: string) {
    const newMeta =
      this.meta && typeof this.meta === 'object' && typeof this.meta.invert === 'function'
        ? this.meta.invert()
        : this.meta;
    // this.wrapped.invert.apply(this.wrapped, arguments),
    return new WrappedOperation(this.wrapped.invert(str), newMeta);
  }

  public compose(other: WrappedOperation) {
    return new WrappedOperation(
      this.wrapped.compose(other.wrapped),
      composeMeta(this.meta!, other.meta)
    );
  }
}
