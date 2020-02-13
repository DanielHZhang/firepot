export function makeEventEmitter(clazz: any, allowedEvents: any) {
  clazz.prototype.allowedEvents_ = allowedEvents;

  clazz.prototype.on = function(eventType: string, callback: Function, context: any) {
    this.validateEventType_(eventType);
    this.eventListeners_ = this.eventListeners_ || {};
    this.eventListeners_[eventType] = this.eventListeners_[eventType] || [];
    this.eventListeners_[eventType].push({callback: callback, context: context});
  };

  clazz.prototype.off = function(eventType: string, callback: Function) {
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

  clazz.prototype.trigger = function(eventType: string) {
    this.eventListeners_ = this.eventListeners_ || {};
    let listeners = this.eventListeners_[eventType] || [];
    for (let i = 0; i < listeners.length; i++) {
      listeners[i].callback.apply(listeners[i].context, Array.prototype.slice.call(arguments, 1));
    }
  };

  clazz.prototype.validateEventType_ = function(eventType: string) {
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
}

export function setTextContent(e: HTMLElement, str: string) {
  e.innerHTML = '';
  e.appendChild(document.createTextNode(str));
}

export function elt(tag: string, content: string | Node[], attrs: Record<string, any>) {
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

export function on(emitter, type: string, f, capture) {
  if (emitter.addEventListener) {
    emitter.addEventListener(type, f, capture || false);
  } else if (emitter.attachEvent) {
    emitter.attachEvent('on' + type, f);
  }
}

export function off(emitter, type: string, f, capture) {
  if (emitter.removeEventListener) {
    emitter.removeEventListener(type, f, capture || false);
  } else if (emitter.detachEvent) {
    emitter.detachEvent('on' + type, f);
  }
}

export function preventDefault(e: Event) {
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = false;
  }
}

export function stopPropagation(e: Event) {
  if (e.stopPropagation) {
    e.stopPropagation();
  } else {
    e.cancelBubble = true;
  }
}

export function stopEvent(e: Event) {
  preventDefault(e);
  stopPropagation(e);
}

export function stopEventAnd(fn: Function) {
  return (e: Event) => {
    fn(e);
    stopEvent(e);
    return false;
  };
}

export function trim(str: string) {
  return str.replace(/^\s+/g, '').replace(/\s+$/g, '');
}

export function stringEndsWith(str: string, suffix: string) {
  const list = typeof suffix === 'string' ? [suffix] : suffix;
  for (let i = 0; i < list.length; i++) {
    const suf = list[i];
    if (str.indexOf(suf, str.length - suf.length) !== -1) {
      return true;
    }
  }
  return false;
}

export function assert(b: any, msg: string) {
  if (!b) {
    throw new Error(msg || 'assertion error');
  }
}

export function log() {
  if (typeof console !== 'undefined' && typeof console.log !== 'undefined') {
    const args = ['Firepad:'];
    for (let i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.log(args);
  }
}
