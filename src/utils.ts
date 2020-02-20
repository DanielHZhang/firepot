type Class = {
  new (...args: any[]): any;
};

export function makeEventEmitter<T extends Class>(extendable: T, allowedEvents?: string[]) {
  extendable.prototype.allowedEvents_ = allowedEvents;

  extendable.prototype.validateEventType_ = function(eventType: string) {
    if (this.allowedEvents_) {
      let allowed = false;
      for (let i = 0; i < this.allowedEvents_.length; i++) {
        if (this.allowedEvents_[i] === eventType) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        throw new Error('Unknown event "' + eventType + '"');
      }
    }
  };

  extendable.prototype.on = function(eventType: string, callback: Function, context: any) {
    this.validateEventType_(eventType);
    this.eventListeners_ = this.eventListeners_ || {};
    this.eventListeners_[eventType] = this.eventListeners_[eventType] || [];
    this.eventListeners_[eventType].push({callback, context});
  };

  extendable.prototype.off = function(eventType: string, callback: Function) {
    this.validateEventType_(eventType);
    this.eventListeners_ = this.eventListeners_ || {};
    let listeners = this.eventListeners_[eventType] || [];
    for (let i = 0; i < listeners.length; i++) {
      if (listeners[i].callback === callback) {
        listeners.splice(i, 1);
        return;
      }
    }
  };

  extendable.prototype.trigger = function(eventType: string, ...args: any[]) {
    this.eventListeners_ = this.eventListeners_ || {};
    const listeners: {callback: Function; context: any}[] = this.eventListeners_[eventType] || [];
    for (let i = 0; i < listeners.length; i++) {
      listeners[i].callback.apply(listeners[i].context, args);
      // listeners[i].callback.apply(listeners[i].context, Array.prototype.slice.call(arguments, 1));
    }
  };

  return extendable;
}

export function setTextContent(e: HTMLElement, str: string) {
  e.innerHTML = '';
  e.appendChild(document.createTextNode(str));
}

export function elt(tag: string, content: string | Node[] | null, attrs: Record<string, any>) {
  let e = document.createElement(tag);
  if (typeof content === 'string') {
    setTextContent(e, content);
  } else if (content) {
    for (let i = 0; i < content.length; ++i) {
      e.appendChild(content[i]);
    }
  }
  for (let attr in attrs || {}) {
    e.setAttribute(attr, attrs[attr]);
  }
  return e;
}

export function stopEvent(e: Event) {
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = false;
  }
  if (e.stopPropagation) {
    e.stopPropagation();
  } else {
    e.cancelBubble = true;
  }
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg || 'Assertion error!');
  }
}
