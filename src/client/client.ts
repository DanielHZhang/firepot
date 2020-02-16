import {TextOperation} from '../operations/text-operation';

// Client.AwaitingWithBuffer = AwaitingWithBuffer;

export abstract class Client {
  // Client constructor
  constructor() {
    this.state = synchronized_; // start state
    this.synchronized = new Synchronized();
  }

  setState(state) {
    this.state = state;
  }

  // Call this method when the user changes the document.
  applyClient(operation) {
    this.setState(this.state.applyClient(this, operation));
  }

  // Call this method with a new operation from the server
  applyServer(operation) {
    this.setState(this.state.applyServer(this, operation));
  }

  serverAck() {
    this.setState(this.state.serverAck(this));
  }

  serverRetry() {
    this.setState(this.state.serverRetry(this));
  }

  // Override this method.
  sendOperation(operation) {
    throw new Error('sendOperation must be defined in child class');
  }

  // Override this method.
  applyOperation(operation) {
    throw new Error('applyOperation must be defined in child class');
  }
}
