function addStackedAnimation(element, classname) {
  let newDiv = document.createElement("div");
  newDiv.style.position = element.style.position;
  newDiv.style.top = element.style.top;
  newDiv.style.left = element.style.left;
  newDiv.style.width = element.style.width;
  newDiv.style.height = element.style.height;
  newDiv.style.pointerEvents = "none";
  element.style.top = "0px";
  element.style.left = "0px";
  newDiv.classList.add(classname);
  newDiv.classList.add("hintcursor-animation-stacked");
  element.replaceWith(newDiv);
  newDiv.appendChild(element);
}

function removeAllStackedAnimation(element) {
  let parent = element.parentElement;
  if (parent.classList.contains("hintcursor-animation-stacked")) {
    element.style.top = parent.style.top;
    element.style.left = parent.style.left;
    let grandparent = parent.parentElement;
    grandparent.appendChild(element);
    parent.remove();
    removeAllStackedAnimation(element);
  }
}

function getStackTop(element) {
  let parent = element?.parentElement;
  if (parent == null) {
    return element;
  }
  if (parent.classList.contains("hintcursor-animation-stacked")) {
    return getStackTop(parent);
  }
  return element;
}

function moveStack(element, x, y) {
  let top = getStackTop(element);
  top.style.top = `${y}px`;
  top.style.left = `${x}px`;
}

class CursorHint {
  constructor(element, transitionDuration) {
    this.transitionDuration = transitionDuration || 500;
    this.target = {};
    this.hintElement = null;
    this.creatDomElement();
    this.currentAnimation = null;

    this.animations = {
      click: () => {
        removeAllStackedAnimation(this.hintElement);
        addStackedAnimation(this.hintElement, "hintcursor-animation-fadeinfromright");
        addStackedAnimation(this.hintElement, "hintcursor-animation-jiggle");
        addStackedAnimation(this.hintElement, "hintcursor-animation-blink");
        this.setTransitionDuration(this.transitionDuration);
      },
      drag: () => {
        removeAllStackedAnimation(this.hintElement);
        addStackedAnimation(this.hintElement, "hintcursor-animation-drag");
        this.setTransitionDuration(this.transitionDuration);
      },
      point: () => {
        removeAllStackedAnimation(this.hintElement);
        addStackedAnimation(this.hintElement, "hintcursor-animation-fadeinfromright");
        addStackedAnimation(this.hintElement, "hintcursor-animation-point");
        this.setTransitionDuration(this.transitionDuration);
      }
    }

    this.setAnimation("click");
    this.moveTo(element, transitionDuration);

    this._onWindowResizeProxy = this.moveToTarget.bind(this);
    window.addEventListener("resize", this._onWindowResizeProxy);

    this.followInterval = setInterval(() => {
      this.moveToTarget();
    }, 100);
  }

  creatDomElement() {
    let element = document.createElement("img");
    element.src = "hintcursor_click.png";
    element.style.position = "absolute";
    element.style.top = "0px";
    element.style.left = "0px";
    element.style.width = "40px";
    element.style.height = "40px";
    element.style.zIndex = 1000;
    element.style.pointerEvents = "none";
    document.documentElement.appendChild(element);
    this.hintElement = element;
  }

  setAnimation(animation, replay) {
    if(replay || animation != this.currentAnimation){
      this.currentAnimation = animation;
      this.animations[animation]();
    }
  }

  setTarget(element) {
    this.target = element;
  }

  moveToTarget() {
    let element = this.target;
    let offset = calculateOffset(element, document.documentElement);
    let x = offset.left;
    let y = offset.top;
    x += $(element).outerWidth() * 0.6;
    y += $(element).outerHeight() * 0.6;
    moveStack(this.hintElement, x, y);
  }

  moveTo(element, duration) {
    this.setTransitionDuration(duration);
    this.setTarget(element);
    this.moveToTarget();
  }

  setTransitionDuration(duration) {
    if (duration == undefined) return;
    this.transitionDuration = duration;
    let top = getStackTop(this.hintElement);
    top.style.transition = `top ${duration}ms, left ${duration}ms`;
    top.style.transitionTimingFunction = "ease-in-out";
  }

  hide() {
    this.hintElement.style.transition = "opacity 0.5s";
    this.hintElement.style.opacity = 0;
  }

  unhide() {
    this.hintElement.style.transition = "opacity 0.5s";
    this.hintElement.style.opacity = 1;
  }

  remove() {
    this.hide();
    setTimeout(() => {
      this._remove();
    }, 500);
  }

  _remove() {
    clearInterval(this.followInterval);
    window.removeEventListener("resize", this._onWindowResizeProxy);
    removeAllStackedAnimation(this.hintElement);
    this.hintElement.remove();
    this.hintElement = null;
    this.target = null;
  }
}

class CursorHintSeries {
  constructor(elements, transitionDuration) {
    this.elements = elements ? elements : [];
    this.cursorHint = new CursorHint();
    this._finished = false;
    this.next();
  }

  next() {
    this.current = this.elements.splice(0, 1)[0];
    if (!this.current) {
      this.cursorHint.hide();
      this._finished = true;
      return;
    }
    if(this.current.animation){
      this.cursorHint.setAnimation(this.current.animation)
    }
    if(this.current.element){
      this.cursorHint.moveTo(this.current.element);
    }
  }

  add(element) {
    this.elements.push(element);
    if (this._finished) {
      this._finished = false;
      this.cursorHint.unhide();
      this.next();
    }
  }
}

class LogicCanvasHint {
  constructor(logicCanvas) {
    this.logicCanvas = logicCanvas;
    this.world = logicCanvas.world;
    this.eventManager = logicCanvas.eventManager;
    this.cursorHintSeries = new CursorHintSeries([], 500);
    this.currentHintSolution = null;
  }
  async addGate(btnElement, gateType) {
    this.setSolution("addGate", {gateType:gateType});

    this.cursorHintSeries.add({element:btnElement, animation:"click"});
    let gate = await this.eventManager.wait(
      "CANVAS_GATE_CREATED",
      (gate) => {
        return gate.funcSpec.name === gateType
      }
    );
    this.cursorHintSeries.next();
    return gate;
  }
  async removeGate(gate) {
    this.setSolution("removeGate", {gate:gate});

    this.cursorHintSeries.add({element:gate.domElement, animation:"click"});
    let removedGate = await this.eventManager.wait(
      "GATE_REMOVED",
      (removedGate) => removedGate === gate
    );
    this.cursorHintSeries.next();
    this.currentHintSolution = null;
  }
  async addWire(terminal1, terminal2, successEvent) {
    this.setSolution("addWire", {terminal1:terminal1, terminal2:terminal2});

    this.cursorHintSeries.add({element:terminal1.domElement, animation:"click"});
    await this.eventManager.wait(
      "WORLD_TERMINAL_SELECTED",
      (connection) => {
        if (connection.from === terminal2) {
          this.cursorHintSeries.cursorHint.setAnimation("click", true);
          let temp = terminal1;
          terminal1 = terminal2;
          terminal2 = temp;
        }
        let test = connection.from === terminal1 || connection.from === terminal2;
        if(!test){
          setTimeout(() => {
            this.world.clearSelction();
            this.logicCanvas.showConnectableTerminals();
            this.cursorHintSeries.cursorHint.setAnimation("click", true);
          }, 500);
        }
        return test;
      }
    );
    this.cursorHintSeries.next();
    this.cursorHintSeries.add({element:terminal2.domElement, animation:"click"});
    await this.eventManager.wait(
      successEvent || "WORLD_TERMINAL_CONNECTED",
      (connection) => {
        let test1 = connection.from === terminal1 && connection.to === terminal2;
        let test2 = connection.from === terminal2 && connection.to === terminal1;
        return test1 || test2;
      }
    );
    this.cursorHintSeries.next();
  }
  async removeWire(terminal1, terminal2) {
    await this.addWire(terminal1, terminal2, "WORLD_TERMINAL_DISCONNECTED");
  }
  async toggleInput(gate){
    this.setSolution("toggleInput", {gate:gate});

    this.cursorHintSeries.add({element:gate.domElement, animation:"click"});
    await this.eventManager.wait(
      "TERMINAL_STATE_CHANGED",
      (terminal) => terminal === gate.out(0)
    );
    this.cursorHintSeries.next();
  }
  async moveGate(gate, x, y, width, height, originalGateOffset){
    width = width==undefined ? 100 : width;
    height = height==undefined ? 100 : height;
    this.setSolution("moveGate", {gate:gate, x:x, y:y, width:width, height:height});

    originalGateOffset = originalGateOffset || $(gate.domElement).offset();
    this.cursorHintSeries.add({element:gate.domElement, animation:"drag"});
    await this.eventManager.wait(
      "CANVAS_GATE_MOVE_START",
      (movedGate) => movedGate === gate
    );
    this.cursorHintSeries.next();

    let targetRegion = document.createElement("div");
    targetRegion.style.position = "absolute";
    targetRegion.style.top = `${y}px`;
    targetRegion.style.left = `${x}px`;
    targetRegion.style.width = `${width}px`;
    targetRegion.style.height = `${height}px`;
    targetRegion.style.pointerEvents = "none";
    targetRegion.style.zIndex = 1000;
    targetRegion.style.border = "2px solid rgba(0,0,0,0.5)";
    targetRegion.style.borderRadius = "5px";
    targetRegion.style.backgroundColor = "rgba(100,0,0,0.1)";
    targetRegion.style.transition = "opacity 0.5s";

    this.logicCanvas.domElement.appendChild(targetRegion);
    this.cursorHintSeries.add({element:targetRegion, animation:"point"});

    await this.eventManager.wait(
      "CANVAS_GATE_MOVE_END",
      (movedGate) => movedGate === gate
    );
    this.cursorHintSeries.next();
    targetRegion.style.opacity = 0;

    if(!isInside(gate.domElement, targetRegion)){
      $(gate.domElement)[0].style.transition = "top 0.5s, left 0.5s";
      $(gate.domElement).offset(originalGateOffset);
      setTimeout(() => {
        $(gate.domElement)[0].style.transition = "";
      }, 500);
      await this.moveGate(gate, x, y, width, height, originalGateOffset);
    }
  }

  setSolution(currentOperation, data){
    const solutions = {
      addGate: ()=>{
        let gateType = data.gateType;
        this.currentHintSolution=()=>{
          this.logicCanvas.createGate(gateType);
        };
      },
      removeGate: ()=>{
        let gate = data.gate;
        this.currentHintSolution=()=>{
          gate.remove();
        };
      },
      addWire: ()=>{
        let terminal1 = data.terminal1;
        let terminal2 = data.terminal2;
        let terminal1Offset = calculateOffset(terminal1.domElement, this.logicCanvas.domElement);
        let terminal2Offset = calculateOffset(terminal2.domElement, this.logicCanvas.domElement);
        this.currentHintSolution=()=>{
          this.world.clearSelction();
          this.world.makeConnection(terminal1);
          this.logicCanvas.mousePos = {
            x: (terminal1Offset.left + terminal2Offset.left) / 2,
            y: (terminal1Offset.top + terminal2Offset.top) / 2
          };
          setTimeout(() => {
            this.world.makeConnection(terminal2);
          }, 100);
        };
      },
      toggleInput: ()=>{
        let gate = data.gate;
        this.currentHintSolution=()=>{
          gate.out(0).toggle();
        };
      },
      moveGate: ()=>{
        let gate = data.gate;
        let x = data.x;
        let y = data.y;
        let dWidth = data.width - $(gate.domElement).outerWidth();
        let dHeight = data.height - $(gate.domElement).outerHeight();
        this.currentHintSolution=()=>{
          this.eventManager.publish("CANVAS_GATE_MOVE_START", gate);
          gate.domElement.style.transition = "top 0.1s, left 0.1s";
          gate.domElement.style.top = `${y+dWidth/2}px`;
          gate.domElement.style.left = `${x+dHeight/2}px`;
          setTimeout(() => {
            gate.domElement.style.transition = "";
            this.eventManager.publish("CANVAS_GATE_MOVE_END", gate);
          }, 100);
        };
      }
    };
    solutions[currentOperation]();


    // switch(currentOperation){
    //   case "addGate":
    //     let gateType = data.gateType;
    //     this.currentHintSolution=()=>{
    //       this.logicCanvas.createGate(gateType);
    //     };
    //     break;
    //   case "removeGate":
    //     let gate = data.gate;
    //     this.currentHintSolution=()=>{
    //       gate.remove();
    //     };
    //     break;
    //   case "moveGate":
    //     let gate = data.gate;
    //     let x = data.x;
    //     let y = data.y;
    //     this.currentHintSolution=()=>{
    //       $(gate.domElement).offset({top:y, left:x});
    //     };
    //     break;
    // }
  }

  skip(){
    if(this.currentHintSolution){
      this.currentHintSolution();
      this.currentHintSolution = null;
    }
  }
}