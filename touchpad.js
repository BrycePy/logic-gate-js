let touchPadCSS = `
#touch-region {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: transparent;
  z-index: 9999;
  cursor: none;
  display: none;
  pointer-events: all;
}

#touch-cursor {
  position: absolute;
  left: 50px;
  top: 50px;
  width: 10px;
  height: 10px;
  background-color: red;
  border-radius: 50%;
  z-index: 9998;
  cursor: none;
  display: none;
  pointer-events: none;
}
`
class Touchpad {
  constructor(parent) {
    this.parent = parent;

    this.onDrag = null;
    this.dragElement = null;

    this.applyCSS();

    let touchRegion = document.createElement("div");
    this.touchRegion = touchRegion;
    touchRegion.id = "touch-region";
    touchRegion.style.display = "block";
    parent.appendChild(touchRegion);

    let touchCursor = document.createElement("div");
    this.touchCursor = touchCursor;
    touchCursor.id = "touch-cursor";
    touchCursor.style.display = "block";
    parent.appendChild(touchCursor);

    let previousPoint = { x: 0, y: 0 };
    let startPoint = { x: 0, y: 0, at: 0 };
    let lastClickTime = 0;

    touchRegion.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("touch start");
      previousPoint.x = e.touches[0].clientX;
      previousPoint.y = e.touches[0].clientY;
      startPoint.x = previousPoint.x;
      startPoint.y = previousPoint.y;
      startPoint.at = Date.now();
    }, { passive: false });

    touchRegion.addEventListener("touchmove", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if(!this.dragElement && Date.now() - lastClickTime < 500) {
        this.dragElement = this.getElement();
        let clientPos = this.getCursorClientPosition();
        this.dragElement.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            clientX: clientPos.x,
            clientY: clientPos.y
          })
        )
      }

      let offset = $(touchCursor).offset();
      let dx = e.touches[0].clientX - previousPoint.x;
      let dy = e.touches[0].clientY - previousPoint.y;
      previousPoint.x = e.touches[0].clientX;
      previousPoint.y = e.touches[0].clientY;

      if(this.dragElement && this.onDrag) {
        this.onDrag({
          dx: dx,
          dy: dy,
          touchEvent: e,
          cursor: touchCursor,
          dragElement: this.dragElement
        });
      }

      let velocity = Math.sqrt(dx * dx + dy * dy);
      let factor = Math.min(1, velocity / 10);
      let tempX = dx * (0.5 + factor);
      let tempY = dy * (0.5 + factor);
      offset.left += tempX;
      offset.top += tempY;

      let offsetInParent = calculateOffset(touchCursor, parent);
      offsetInParent.left += tempX;
      offsetInParent.top += tempY;
      let aX = offsetInParent.left + $(touchCursor).width() / 2;
      let aY = offsetInParent.top + $(touchCursor).height() / 2;
      if (!(aX < 0 || aX > $(parent).width() || aY < 0 || aY > $(parent).height())) {
        $(touchCursor).offset(offset);
      }

      parent.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: offset.left + $(touchCursor).width() / 2,
        clientY: offset.top + $(touchCursor).height() / 2
      }));
    }, { passive: false });

    let onTouchpadClick = () => {
      this.blink();
      let element = this.getElement();
      if (element) {
        touchRegion.style.pointerEvents = "none";
        element.dispatchEvent(new Event("touchstart", { bubbles: false, cancelable: true }));
        element.dispatchEvent(new Event("touchend", { bubbles: false, cancelable: true }));
        touchRegion.style.pointerEvents = "all";
      }
    }

    touchRegion.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(this.dragElement) {
        let clientPos = this.getCursorClientPosition();
        this.dragElement.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            clientX: clientPos.x,
            clientY: clientPos.y
          })
        )
        this.dragElement = null;
      }
      let downTime = Date.now() - startPoint.at;
      let dx = e.changedTouches[0].clientX - startPoint.x;
      let dy = e.changedTouches[0].clientY - startPoint.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      if (downTime < 300 && distance < 10) {
        onTouchpadClick();
        lastClickTime = Date.now();
      }
    }, { passive: false });
  }

  applyCSS() {
    let style = document.createElement("style");
    style.innerHTML = touchPadCSS;
    document.head.appendChild(style);
  }

  getElement() {
    let cursorOffset = $(this.touchCursor).offset();
    let x = cursorOffset.left;
    let y = cursorOffset.top;
    x += $(this.touchCursor).width() / 2;
    y += $(this.touchCursor).height() / 2;
    this.touchRegion.style.pointerEvents = "none";
    let element = document.elementFromPoint(x, y);
    this.touchRegion.style.pointerEvents = "all";
    return element;
  }

  blink() {
    this.touchCursor.style.backgroundColor = "green";
    setTimeout(() => {
      this.touchCursor.style.backgroundColor = "red";
    }, 100);
  }

  getCursorClientPosition() {
    let bounds = this.touchCursor.getBoundingClientRect();
    return {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2
    };
  }
}