import {Client} from '../client';
import {TextOperation} from '../../operations/text';
import {AwaitingConfirm} from './awaiting-confirm';

/**
 * In the 'AwaitingWithBuffer' state, the client is waiting for an operation
 * to be acknowledged by the server while buffering the edits the user makes
 */
export class AwaitingWithBuffer {
  public outstanding: TextOperation;
  public buffer: any;

  constructor(outstanding: TextOperation, buffer: any) {
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding;
    this.buffer = buffer;
  }

  applyClient(operation: TextOperation) {
    // Compose the user's changes onto the buffer
    const newBuffer = this.buffer.compose(operation);
    return new AwaitingWithBuffer(this.outstanding, newBuffer);
  }

  applyServer(operation: TextOperation, client: Client) {
    // Operation comes from another client
    //                       /\
    //     this.outstanding /  \ operation
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    //                    \/
    // The transformed operation -- can be applied to the client's current
    // document * pair1[1]
    const pair1 = this.outstanding.transform(operation);
    const pair2 = this.buffer.transform(pair1[1]);
    client.applyOperation(pair2[1]);
    return new AwaitingWithBuffer(pair1[0], pair2[0]);
  }

  serverAck(client: Client) {
    // The pending operation has been acknowledged => send buffer
    client.sendOperation(this.buffer);
    return new AwaitingConfirm(this.buffer);
  }

  serverRetry(client: Client) {
    // Merge with our buffer and resend
    const outstanding = this.outstanding.compose(this.buffer);
    client.sendOperation(outstanding);
    return new AwaitingConfirm(outstanding);
  }
}
