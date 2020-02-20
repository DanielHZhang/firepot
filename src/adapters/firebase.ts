import {database} from 'firebase';
import {TextOperation} from '../operations/text-operation';
import {assert, makeEventEmitter} from '../utils';

// Save a checkpoint every 100 edits.
const CHECKPOINT_FREQUENCY = 100;

// Based off ideas from http://www.zanopha.com/docs/elen.pdf
const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function revisionToId(revision: number) {
  if (revision === 0) {
    return 'A0';
  }
  let str = '';
  while (revision > 0) {
    let digit = revision % characters.length;
    str = characters[digit] + str;
    revision -= digit;
    revision /= characters.length;
  }
  // Prefix with length (starting at 'A' for length 1) to ensure the id's sort lexicographically.
  const prefix = characters[str.length + 9];
  return prefix + str;
}
function revisionFromId(revisionId: string) {
  assert(revisionId.length > 0 && revisionId[0] === characters[revisionId.length + 8]);
  let revision = 0;
  for (let i = 1; i < revisionId.length; i++) {
    revision *= characters.length;
    revision += characters.indexOf(revisionId[i]);
  }
  return revision;
}

export class FirebaseAdapter {
  public ref_: database.Reference;
  public document_: TextOperation;
  public ready_: boolean;
  public zombie_: boolean;
  public firebaseCallbacks_: any[];
  public revision_: number;
  public pendingReceivedRevisions_: Record<string, {o: TextOperation; a: string}>;
  public userId_: string | number;
  public sent_: {id: string; op: TextOperation} | null;
  public checkpointRevision_: number;
  public userRef_: any;
  public cursor_: any;
  public color_: any;

  constructor(ref: database.Reference, userId: string | number, userColor: string) {
    this.ref_ = ref;
    this.ready_ = false;
    this.firebaseCallbacks_ = [];
    this.zombie_ = false;

    // We store the current document state as a TextOperation so we can write checkpoints to Firebase occasionally.
    this.document_ = new TextOperation();

    // The next expected revision.
    this.revision_ = 0;

    // This is used for two purposes:
    // 1) On initialization, we fill this with the latest checkpoint and any subsequent operations and then process them all together.
    // 2) If we ever receive revisions out-of-order (e.g. rev 5 before rev 4), we queue them here until it's time for them to be handled. [this should never happen with well-behaved clients; but if it /does/ happen we want to handle it gracefully.]
    this.pendingReceivedRevisions_ = {};

    if (userId) {
      this.setUserId(userId);
      this.setColor(userColor);

      let connectedRef = ref.root.child('.info/connected');

      this.firebaseOn_(
        connectedRef,
        'value',
        (snapshot) => {
          if (snapshot.val() === true) {
            this.initializeUserData_();
          }
        },
        this
      );

      // Once we're initialized, start tracking users' cursors.
      this.on('ready', () => {
        this.monitorCursors_();
      });
    } else {
      this.userId_ = ref.push().key;
    }

    // Avoid triggering any events until our callers have had a chance to attach their listeners.
    setTimeout(() => {
      this.monitorHistory_();
    }, 0);

    makeEventEmitter(FirebaseAdapter, ['ready', 'cursor', 'operation', 'ack', 'retry']);
  }

  dispose() {
    if (!this.ready_) {
      // TODO: this completes loading the text even though we're no longer interested in it.
      this.on('ready', () => {
        this.dispose();
      });
      return;
    }

    this.removeFirebaseCallbacks_();

    if (this.userRef_) {
      this.userRef_.child('cursor').remove();
      this.userRef_.child('color').remove();
    }

    this.ref_ = null;
    this.document_ = null;
    this.zombie_ = true;
  }

  setUserId(userId: string | number) {
    if (this.userRef_) {
      // Clean up existing data.  Avoid nuking another user's data
      // (if a future user takes our old name).
      this.userRef_.child('cursor').remove();
      this.userRef_
        .child('cursor')
        .onDisconnect()
        .cancel();
      this.userRef_.child('color').remove();
      this.userRef_
        .child('color')
        .onDisconnect()
        .cancel();
    }
    this.userId_ = userId;
    this.userRef_ = this.ref_.child('users').child(userId);
    this.initializeUserData_();
  }

  isHistoryEmpty() {
    assert(this.ready_, 'Not ready yet.');
    return this.revision_ === 0;
  }

  /*
   * Send operation, retrying on connection failure. Takes an optional callback with signature:
   * function(error, committed).
   * An exception will be thrown on transaction failure, which should only happen on
   * catastrophic failure like a security rule violation.
   */
  sendOperation(operation: TextOperation, callback) {
    // If we're not ready yet, do nothing right now, and trigger a retry when we're ready.
    if (!this.ready_) {
      this.on('ready', function() {
        this.trigger('retry');
      });
      return;
    }

    // Sanity check that this operation is valid.
    assert(
      this.document_.targetLength === operation.baseLength,
      'sendOperation() called with invalid operation.'
    );

    // Convert revision into an id that will sort properly lexicographically.
    let revisionId = revisionToId(this.revision_);

    const doTransaction = (revisionId: string, revisionData: any) => {
      this.ref_
        .child('history')
        .child(revisionId)
        .transaction(
          (current: any) => {
            if (current === null) {
              return revisionData;
            }
          },
          (error: any, committed: any) => {
            if (error) {
              if (error.message === 'disconnect') {
                if (this.sent_ && this.sent_.id === revisionId) {
                  // We haven't seen our transaction succeed or fail.  Send it again.
                  setTimeout(() => {
                    doTransaction(revisionId, revisionData);
                  }, 0);
                } else if (callback) {
                  callback(error, false);
                }
              } else {
                console.log('Transaction failure!', error);
                throw error;
              }
            } else {
              if (callback) {
                callback(null, committed);
              }
            }
          },
          false
        );
    };

    this.sent_ = {id: revisionId, op: operation};
    doTransaction(revisionId, {
      a: this.userId_,
      o: operation.toJSON(),
      t: database.ServerValue.TIMESTAMP,
    });
  }

  sendCursor(obj) {
    this.userRef_.child('cursor').set(obj);
    this.cursor_ = obj;
  }

  setColor(color) {
    this.userRef_.child('color').set(color);
    this.color_ = color;
  }

  getDocument() {
    return this.document_;
  }

  registerCallbacks(callbacks: any[]) {
    for (let eventType in callbacks) {
      this.on(eventType, callbacks[eventType]);
    }
  }

  initializeUserData_() {
    this.userRef_
      .child('cursor')
      .onDisconnect()
      .remove();
    this.userRef_
      .child('color')
      .onDisconnect()
      .remove();
    this.sendCursor(this.cursor_ || null);
    this.setColor(this.color_ || null);
  }

  monitorCursors_() {
    const usersRef = this.ref_.child('users');
    const childChanged = (childSnap: any) => {
      let userId = childSnap.key;
      let userData = childSnap.val();
      this.trigger('cursor', userId, userData.cursor, userData.color);
    };
    this.firebaseOn_(usersRef, 'child_added', childChanged);
    this.firebaseOn_(usersRef, 'child_changed', childChanged);
    this.firebaseOn_(usersRef, 'child_removed', (childSnap: any) => {
      let userId = childSnap.key;
      this.trigger('cursor', userId, null);
    });
  }

  monitorHistory_() {
    // Get the latest checkpoint as a starting point so we don't have to re-play entire history.
    this.ref_.child('checkpoint').once('value', (s) => {
      if (this.zombie_) {
        return;
      } // just in case we were cleaned up before we got the checkpoint data.
      let revisionId = s.child('id').val(),
        op = s.child('o').val(),
        author = s.child('a').val();
      if (op !== null && revisionId !== null && author !== null) {
        this.pendingReceivedRevisions_[revisionId] = {o: op, a: author};
        this.checkpointRevision_ = revisionFromId(revisionId);
        this.monitorHistoryStartingAt_(this.checkpointRevision_ + 1);
      } else {
        this.checkpointRevision_ = 0;
        this.monitorHistoryStartingAt_(this.checkpointRevision_);
      }
    });
  }

  monitorHistoryStartingAt_(revision: number) {
    const historyRef = this.ref_.child('history').startAt(null, revisionToId(revision));
    setTimeout(() => {
      this.firebaseOn_(historyRef, 'child_added', (revisionSnapshot) => {
        let revisionId = revisionSnapshot.key;
        this.pendingReceivedRevisions_[revisionId] = revisionSnapshot.val();
        if (this.ready_) {
          this.handlePendingReceivedRevisions_();
        }
      });
      historyRef.once('value', () => {
        this.handleInitialRevisions_();
      });
    }, 0);
  }

  handleInitialRevisions_() {
    assert(!this.ready_, 'Should not be called multiple times.');

    // Compose the checkpoint and all subsequent revisions into a single operation to apply at once.
    this.revision_ = this.checkpointRevision_;
    let revisionId = revisionToId(this.revision_);
    let pending = this.pendingReceivedRevisions_;

    while (pending[revisionId] !== null) {
      let revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        console.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
      }

      delete pending[revisionId];
      this.revision_++;
      revisionId = revisionToId(this.revision_);
    }

    this.trigger('operation', this.document_);
    this.ready_ = true;
    setTimeout(() => {
      this.trigger('ready');
    }, 0);
  }

  handlePendingReceivedRevisions_() {
    let pending = this.pendingReceivedRevisions_;
    let revisionId = revisionToId(this.revision_);
    let triggerRetry = false;

    while (pending[revisionId] !== null) {
      this.revision_++;
      let revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        console.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
        if (this.sent_ && revisionId === this.sent_.id) {
          // We have an outstanding change at this revision id.
          if (this.sent_.op.equals(revision.operation) && revision.author === this.userId_) {
            // This is our change; it succeeded.
            if (this.revision_ % CHECKPOINT_FREQUENCY === 0) {
              this.saveCheckpoint_();
            }
            this.sent_ = null;
            this.trigger('ack');
          } else {
            // our op failed.  Trigger a retry after we're done catching up on any incoming ops.
            triggerRetry = true;
            this.trigger('operation', revision.operation);
          }
        } else {
          this.trigger('operation', revision.operation);
        }
      }
      delete pending[revisionId];

      revisionId = revisionToId(this.revision_);
    }

    if (triggerRetry) {
      this.sent_ = null;
      this.trigger('retry');
    }
  }

  parseRevision_(data: Record<any, any> | string) {
    if (typeof data !== 'object') {
      return null;
    }
    if (typeof data.a !== 'string' || typeof data.o !== 'object') {
      return null;
    }
    let op = null;
    try {
      op = TextOperation.fromJSON(data.o);
    } catch (e) {
      return null;
    }
    if (op.baseLength !== this.document_.targetLength) {
      return null;
    }
    return {author: data.a, operation: op};
  }

  saveCheckpoint_() {
    this.ref_.child('checkpoint').set({
      a: this.userId_,
      o: this.document_.toJSON(),
      id: revisionToId(this.revision_ - 1), // use the id for the revision we just wrote.
    });
  }

  firebaseOn_(
    ref: database.Reference,
    eventType: database.EventType,
    callback: (a: database.DataSnapshot, b?: string | null | undefined) => any,
    context?: any
  ) {
    this.firebaseCallbacks_.push({ref, eventType, callback, context});
    ref.on(eventType, callback, context);
    return callback;
  }

  firebaseOff_(ref: database.Reference, eventType: database.EventType, callback, context) {
    ref.off(eventType, callback, context);
    for (let i = 0; i < this.firebaseCallbacks_.length; i++) {
      const l = this.firebaseCallbacks_[i];
      if (
        l.ref === ref &&
        l.eventType === eventType &&
        l.callback === callback &&
        l.context === context
      ) {
        this.firebaseCallbacks_.splice(i, 1);
        break;
      }
    }
  }

  removeFirebaseCallbacks_() {
    for (let i = 0; i < this.firebaseCallbacks_.length; i++) {
      let l = this.firebaseCallbacks_[i];
      l.ref.off(l.eventType, l.callback, l.context);
    }
    this.firebaseCallbacks_ = [];
  }
}
