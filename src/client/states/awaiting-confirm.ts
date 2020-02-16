import {AwaitingWithBuffer} from './awaiting-buffer';

/**
 * In the 'AwaitingConfirm' state, there's one operation the client has sent
 * to the server and is still waiting for an acknowledgement.
 */
export class AwaitingConfirm {
  public outstanding: boolean;

  constructor(outstanding: boolean) {
    // Save the pending operation
    this.outstanding = outstanding;
  }

  applyClient(client: Client, operation: TextOperation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    return new AwaitingWithBuffer(this.outstanding, operation);
  }

  applyServer(client, operation) {
    // This is another client's operation. Visualization:
    //
    //                   /\
    // this.outstanding /  \ operation
    //                 /    \
    //                 \    /
    //  pair[1]         \  / pair[0] (new outstanding)
    //  (can be applied  \/
    //  to the client's
    //  current document)
    let pair = this.outstanding.transform(operation);
    client.applyOperation(pair[1]);
    return new AwaitingConfirm(pair[0]);
  }

  serverAck(client) {
    // The client's operation has been acknowledged
    // => switch to synchronized state
    return synchronized_;
  }

  serverRetry(client) {
    client.sendOperation(this.outstanding);
    return this;
  }
}
