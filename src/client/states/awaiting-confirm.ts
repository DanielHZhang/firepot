import {Client} from '../client';
import {AwaitingWithBuffer} from './awaiting-buffer';
import {TextOperation} from '../../operations/text-operation';

/**
 * In the 'AwaitingConfirm' state, there's one operation the client has sent
 * to the server and is still waiting for an acknowledgement.
 */
export class AwaitingConfirm {
  public outstanding: TextOperation;

  constructor(outstanding: TextOperation) {
    // Save the pending operation
    this.outstanding = outstanding;
  }

  applyClient(operation: TextOperation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    return new AwaitingWithBuffer(this.outstanding, operation);
  }

  applyServer(operation: TextOperation, client: Client) {
    // This is another client's operation. Visualization:
    //                   /\
    // this.outstanding /  \ operation
    //                 /    \
    //                 \    /
    //          pair[1] \  / pair[0] (new outstanding)
    //                   \/
    //  Can be applied to the client's current document
    const pair = this.outstanding.transform(operation);
    client.applyOperation(pair[1]);
    return new AwaitingConfirm(pair[0]);
  }

  serverAck(client: Client) {
    // The client's operation has been acknowledged => switch to synchronized state
    return client.initialState;
  }

  serverRetry(client: Client) {
    client.sendOperation(this.outstanding);
    return this;
  }
}
