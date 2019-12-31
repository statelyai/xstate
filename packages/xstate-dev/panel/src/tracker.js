export function isHidden(el) {
  if (!el) {
    return true;
  }
  const rect = el.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    return true;
  }

  return false;
}

class Tracker {
  elements = new Map();
  constructor() {
    // if (typeof window !== 'undefined') {
    //   let timeout;
    //   window.addEventListener('resize', () => {
    //     if (timeout) {
    //       cancelAnimationFrame(timeout);
    //     }
    //     timeout = requestAnimationFrame(() => {
    //       this.updateAll();
    //     });
    //   });
    // }
    // setInterval(() => {
    //   this.updateAll();
    // }, 500);
  }

  updateAll() {
    Array.from(this.elements.keys()).forEach(key => {
      this.update(key, this.elements.get(key).element);
    });
  }

  debug() {
    let el = document.querySelector('#tracker');

    if (!el) {
      el = document.createElement('div');
      document.body.appendChild(el);
      el.style = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        border: 5px solid red;
        pointer-events: none;
      `.replace('\n', '');
      el.setAttribute('id', 'tracker');
    }

    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    for (const [key, value] of this.elements.entries()) {
      const child = document.createElement('div');
      el.appendChild(child);
      child.style = `
        position: fixed;
        top: ${value.rect.top}px;
        left: ${value.rect.left}px;
        width: ${value.rect.width}px;
        height: ${value.rect.height}px;
        outline: 1px solid red;
      `.replace('\n', '');
      child.dataset.key = key;
    }
  }

  update(id, element) {
    console.log('updating ' + id, element);
    if (!this.elements.get(id)) {
      this.elements.set(id, {
        listeners: new Set(),
        element: element || undefined,
        rect: element ? element.getBoundingClientRect() : undefined,
        hidden: isHidden(element)
      });
    }
    const prevData = this.elements.get(id);
    const { rect: prevRect } = prevData;
    const rect = element ? element.getBoundingClientRect() : undefined;

    if (
      prevRect.top === rect.top &&
      prevRect.left === rect.left &&
      prevRect.bottom === rect.bottom &&
      prevRect.right === rect.right
    ) {
      return;
    }

    const data = {
      ...prevData,
      element: element || undefined,
      rect: element ? element.getBoundingClientRect() : undefined,
      hidden: isHidden(element)
    };

    this.elements.set(id, data);
    requestAnimationFrame(() => {
      this.notify(data);
    });

    if (element) {
      const desc = element.querySelectorAll(`[data-id]`);

      Array.from(desc).forEach(el => {
        const id = el.getAttribute(`data-id`);

        this.update(id, el);
      });
    }

    // this.debug();
  }

  listen(id, listener) {
    if (!this.elements.get(id)) {
      this.elements.set(id, {
        listeners: new Set(),
        element: undefined,
        rect: undefined,
        hidden: true
      });
    }

    const data = this.elements.get(id);
    data.listeners.add(listener);

    console.log('new listener', id, data.rect);

    this.notify(data);
  }

  get(id) {
    if (this.elements.get(id)) {
      return this.elements.get(id);
    }

    return undefined;
  }

  notify(data) {
    data.listeners.forEach(listener => {
      listener(data);
    });
  }
}

const tracker = new Tracker();

export { tracker };
