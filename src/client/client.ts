import {TextOperation} from '../operations/text-operation';
import {Synchronized} from './states/synchronized';

export abstract class Client {
  public state: Synchronized;
  static Synchronized: Synchronized;
  static AwaitingWithBuffer: any;

  constructor() {
    this.state = new Synchronized(); // start state
  }

  setState(state: Synchronized) {
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
