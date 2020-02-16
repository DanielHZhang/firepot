import {Client} from '../client';
import {TextOperation} from '../../operations/text-operation';
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

  applyClient(client: Client, operation: TextOperation) {
    // Compose the user's changes onto the buffer
    const newBuffer = this.buffer.compose(operation);
    return new AwaitingWithBuffer(this.outstanding, newBuffer);
  }

  applyServer(client: Client, operation: TextOperation) {
    // Operation comes from another client
    //
    //                       /\
    //     this.outstanding /  \ operation
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    // the transformed    \/
    // operation -- can
    // be applied to the
    // client's current
    // document
    //
    // * pair1[1]
    let pair1 = this.outstanding.transform(operation);
    let pair2 = this.buffer.transform(pair1[1]);
    client.applyOperation(pair2[1]);
    return new AwaitingWithBuffer(pair1[0], pair2[0]);
  }

  serverRetry(client: Client) {
    // Merge with our buffer and resend.
    let outstanding = this.outstanding.compose(this.buffer);
    client.sendOperation(outstanding);
    return new AwaitingConfirm(outstanding);
  }

  serverAck(client: Client) {
    // The pending operation has been acknowledged
    // => send buffer
    client.sendOperation(this.buffer);
    return new AwaitingConfirm(this.buffer);
  }
}
