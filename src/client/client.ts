import {TextOperation} from '../operations/text-operation';
import {Synchronized} from './states/synchronized';
import {AwaitingWithBuffer} from './states/awaiting-buffer';
import {AwaitingConfirm} from './states/awaiting-confirm';

export abstract class Client {
  public state: Synchronized | AwaitingConfirm | AwaitingWithBuffer;
  public initialState: Synchronized;
  // static Synchronized: Synchronized;
  // static AwaitingWithBuffer: any;

  constructor() {
    this.initialState = new Synchronized();
    this.state = this.initialState; // start state
  }

  setState(state: Synchronized | AwaitingConfirm | AwaitingWithBuffer) {
    this.state = state;
  }

  // Call this method when the user changes the document.
  applyClient(operation: TextOperation) {
    this.setState(this.state.applyClient(this, operation));
  }

  // Call this method with a new operation from the server
  applyServer(operation: TextOperation) {
    this.setState(this.state.applyServer(this, operation));
  }

  serverAck() {
    this.setState(this.state.serverAck(this));
  }

  serverRetry() {
    this.setState(this.state.serverRetry(this));
  }

  // Override this method.
  sendOperation(operation: TextOperation) {
    throw new Error('sendOperation must be defined in child class');
  }

  // Override this method.
  applyOperation(operation: TextOperation) {
    throw new Error('applyOperation must be defined in child class');
  }
}
