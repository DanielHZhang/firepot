import {TextOperation} from '../operations/text-operation';
import {Synchronized} from './states/synchronized';
import {AwaitingWithBuffer} from './states/awaiting-buffer';
import {AwaitingConfirm} from './states/awaiting-confirm';

export abstract class Client {
  public state: Synchronized | AwaitingConfirm | AwaitingWithBuffer;
  public initialState: Synchronized;

  constructor() {
    this.initialState = new Synchronized();
    this.state = this.initialState;
  }

  abstract sendOperation(operation: TextOperation): void;
  abstract applyOperation(operation: TextOperation): void;

  /** Call this method when the user changes the document */
  applyClient(operation: TextOperation) {
    this.state = this.state.applyClient(operation, this);
  }

  /** Call this method with a new operation from the server */
  applyServer(operation: TextOperation) {
    this.state = this.state.applyServer(operation, this);
  }

  serverAck() {
    if (this.state instanceof AwaitingConfirm || this.state instanceof AwaitingWithBuffer) {
      this.state = this.state.serverAck(this);
    }
  }

  serverRetry() {
    if (this.state instanceof AwaitingConfirm || this.state instanceof AwaitingWithBuffer) {
      this.state = this.state.serverRetry(this);
    }
  }
}
