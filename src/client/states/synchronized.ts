import {Client} from '../client';
import {TextOperation} from '../../operations/text-operation';
import {AwaitingConfirm} from './awaiting-confirm';

export class Synchronized {
  applyClient(client: Client, operation: TextOperation) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendOperation(operation);
    return new AwaitingConfirm(operation);
  }

  applyServer(client: Client, operation: TextOperation) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    client.applyOperation(operation);
    return this;
  }

  serverAck(client: Client) {
    throw new Error('There is no pending operation.');
  }

  serverRetry(client: Client) {
    throw new Error('There is no pending operation.');
  }
}
