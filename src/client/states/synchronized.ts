import {Client} from '../client';
import {TextOperation} from '../../operations/text';
import {AwaitingConfirm} from './awaiting-confirm';

export class Synchronized {
  applyClient(operation: TextOperation, client: Client) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendOperation(operation);
    return new AwaitingConfirm(operation);
  }

  applyServer(operation: TextOperation, client: Client) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    client.applyOperation(operation);
    return this;
  }
}
