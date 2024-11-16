const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

$(function () {
  let div = document.createElement("div");
  div.id = "logic-gate-default-template";
  div.style.display = "none";
  document.body.appendChild(div);
  div.innerHTML = logicGateDefaultTemplate;
});

// const calculateOffset = (element, parent) => {
//   let offset = { top: 0, left: 0 };
//   while (element !== parent) {
//     if (!element) {
//       return offset;
//     }
//     offset.top += element.offsetTop;
//     offset.left += element.offsetLeft;
//     element = element.parentElement;
//   }
//   return offset;
// };

const calculateOffset = (element, parent) => {
  let offset = { top: 0, left: 0 };
  if(!element) return offset;
  offset.top += $(element).offset().top;
  offset.left += $(element).offset().left;
  if(!parent) return offset;
  offset.top -= $(parent).offset().top;
  offset.left -= $(parent).offset().left;
  return offset;
}

function isInside(element1, element2) {
  let rect1 = element1.getBoundingClientRect();
  let rect2 = element2.getBoundingClientRect();
  return (
    rect1.top >= rect2.top &&
    rect1.left >= rect2.left &&
    rect1.bottom <= rect2.bottom &&
    rect1.right <= rect2.right
  );
}

// Handle User click/tap events. with throttling and double firing prevention.
let skipMouse = 0;
const onInteract = (element, callback, options) => {
  let lastCallAt = 0;
  const call = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type.includes("touch")) skipMouse = 3;
    if (event.type.includes("mouse") && skipMouse) {
      skipMouse--;
      return;
    }
    let now = Date.now();
    if (now - lastCallAt < 100) return;
    lastCallAt = now;
    callback(event);
  }
  ["mousedown", "touchstart"].forEach(event => {
    element.addEventListener(event, call, options);
  });
}

class LogicCanvas {
  constructor(world, div, templateID) {
    world.setDomElement(div);
    world.setParent(this);
    this.world = world;
    this.domElement = div;
    this.eventManager = this.world.eventManager;
    this.loadTemplate(templateID || "logic-gate-templates");

    $(div).addClass("logic-gate-div");

    this.canvas = document.createElement("canvas");
    this.domElement.appendChild(this.canvas);
    this.updateCanvas();
    this.clearCanvas();
    this.drawGrid();

    this.onResize = () => {
      this.updateCanvas();
      this.visualTick();
    }
    window.addEventListener("resize", this.onResize);

    this.mousePos = { x: 0, y: 0 };
    this.onMouseMove = (event) => {
      let bounds = this.domElement.getBoundingClientRect();
      this.mousePos = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      };
    }
    this.domElement.addEventListener("mousemove", this.onMouseMove, true);

    this.canvas.addEventListener("click", () => {
      this.world.clearSelction();
      this.showConnectableTerminals();
    });

    this.slowVisualTick = setInterval(() => {
      this.visualTick();
    }, 100);

    this.eventManager.subscribe("TERMINAL_STATE_CHANGED", (terminal) => {
      if (terminal.state === State.ON) {
        $(terminal.domElement).addClass("logic-gate-terminal-on");
      } else {
        $(terminal.domElement).removeClass("logic-gate-terminal-on");
      }
    });
  }

  updateCanvas() {
    this.canvas.width = this.domElement.clientWidth;
    this.canvas.height = this.domElement.clientHeight;
    this.canvas.style.width = this.domElement.clientWidth + "px";
    this.canvas.style.height = this.domElement.clientHeight + "px";
    $(this.canvas).addClass("logic-gate-canvas")
    this.ctx = this.canvas.getContext("2d");
    this.arrangeIOGates();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid() {
    let ctx = this.ctx;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = 0;
    while (x < this.canvas.width) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      x += 20;
    }
    let y = 0;
    while (y < this.canvas.height) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      y += 20;
    }
    ctx.stroke();
  }

  drawWires() {
    let ctx = this.ctx;
    this.world.wires.forEach(wire => {
      let terminal1 = wire.terminalSrc;
      let terminal2 = wire.terminalSink;
      let jqTerminal1 = $(terminal1.domElement);
      let jqTerminal2 = $(terminal2.domElement);

      let srcPos = calculateOffset(terminal1.domElement, this.domElement);
      let sinkPos = calculateOffset(terminal2.domElement, this.domElement);

      srcPos.top += jqTerminal1.height() / 2;
      srcPos.left += jqTerminal1.width() / 2;
      sinkPos.top += jqTerminal2.height() / 2;
      sinkPos.left += jqTerminal2.width() / 2;

      let xMid = (srcPos.left + sinkPos.left) / 2;
      let yMid = (srcPos.top + sinkPos.top) / 2;

      ctx.beginPath();
      ctx.strokeStyle = wire.state === State.ON ? "white" : "black";

      const drawCases = {
        "self-connecting": () => {
          let yOffset = 50;
          let xOffset = 30;
          let bridgeY;
          if (sinkPos.top > srcPos.top) {
            bridgeY = srcPos.top - yOffset;
          } else {
            bridgeY = srcPos.top + yOffset;
          }
          ctx.moveTo(srcPos.left, srcPos.top);
          ctx.lineTo(srcPos.left + xOffset, srcPos.top);
          ctx.lineTo(srcPos.left + xOffset, bridgeY);
          ctx.lineTo(sinkPos.left - xOffset, bridgeY);
          ctx.lineTo(sinkPos.left - xOffset, sinkPos.top);
          ctx.lineTo(sinkPos.left, sinkPos.top);
        },
        "src-right-of-sink": () => {
          let yOffset = 30;
          let xOffset = 30;
          ctx.moveTo(srcPos.left, srcPos.top);
          ctx.lineTo(srcPos.left + xOffset, srcPos.top);
          if (srcPos.top < sinkPos.top) {
            ctx.lineTo(srcPos.left + xOffset, srcPos.top + yOffset);
            ctx.lineTo(sinkPos.left - xOffset, sinkPos.top - yOffset);
            ctx.lineTo(sinkPos.left - xOffset, sinkPos.top);
            ctx.lineTo(sinkPos.left, sinkPos.top);
          } else {
            ctx.lineTo(srcPos.left + xOffset, srcPos.top - yOffset);
            ctx.lineTo(sinkPos.left - xOffset, sinkPos.top + yOffset);
            ctx.lineTo(sinkPos.left - xOffset, sinkPos.top);
            ctx.lineTo(sinkPos.left, sinkPos.top);
          }
        },
        "default-grid": () => {
          ctx.moveTo(srcPos.left, srcPos.top);
          ctx.lineTo(xMid, srcPos.top);
          ctx.lineTo(xMid, sinkPos.top);
          ctx.lineTo(sinkPos.left, sinkPos.top);
        },
        "default": () => {
          ctx.moveTo(srcPos.left, srcPos.top);
          ctx.lineTo(sinkPos.left, sinkPos.top);
        }
      }

      let dx = sinkPos.left - srcPos.left;
      let dy = Math.abs(srcPos.top - sinkPos.top);
      let srcRightOfSink = srcPos.left > sinkPos.left;
      let sameParent = terminal1.parent === terminal2.parent;

      if (sameParent || (srcRightOfSink && dy < 70)) {
        drawCases["self-connecting"]();
      } else if (dx < 50 && dy > 70) {
        drawCases["src-right-of-sink"]();
      } else {
        drawCases["default"]();
      }
      ctx.stroke();
    });

    if(!skipMouse && this.world.previousTerminal){
      let terminal = this.world.previousTerminal;
      let pos = calculateOffset(terminal.domElement, this.domElement);
      let jqTerminal = $(terminal.domElement);
      pos.top += jqTerminal.height() / 2;
      pos.left += jqTerminal.width() / 2;
      ctx.beginPath();
      ctx.strokeStyle = "red";
      ctx.moveTo(pos.left, pos.top);
      ctx.lineTo(this.mousePos.x, this.mousePos.y);
      ctx.stroke();
    }
  }

  drawIndicators() {
    let ctx = this.ctx;
    ctx.fillStyle = this.world.isStable() ? "#4f4" : "#f44";
    ctx.fillRect(0, 0, 10, 10);

    ctx.fillStyle = this.world.tickCount % 2 == 0 ? "#fff" : "#ccc";
    ctx.fillRect(10, 0, 10, 10);

    ctx.fillStyle = this.world.previousTerminal ? "#fff" : "#ccc";
    ctx.fillRect(20, 0, 10, 10);

    ctx.fillStyle = skipMouse ? "#fff" : "#ccc";
    ctx.fillRect(30, 0, 10, 10);
  }

  createGateElement(template, functionSpec, x, y, draggable, removeable) {
    x = x || 100;
    y = y || 100;
    draggable = draggable == undefined ? true : draggable;
    removeable = removeable == undefined ? true : removeable;
    let clone = template.cloneNode(true);
    $(clone).removeClass("logic-gate-div-relative");
    $(clone).addClass("logic-gate-div-absolute");
    clone.style.left = `${x}px`;
    clone.style.top = `${y}px`;
    this.domElement.appendChild(clone);
    
    let gate = this.world.createLogicGate(functionSpec);
    gate.setDomElement(clone);
    gate._removeable = removeable;
    gate._draggable = draggable;

    function moveToOrigin() {
      gate.domElement.style.transition = "all 0.1s";
      gate.domElement.style.left = x + "px";
      gate.domElement.style.top = y + "px";
      setTimeout(()=>{
        gate.domElement.style.transition = "";
      }, 500);
    }

    if (draggable) {
      $(clone).draggable({
        handle: ".logic-gate-body",
        distance: 15,
        start: () => {
          this.eventManager.publish("CANVAS_GATE_MOVE_START", gate);
        },
        stop: ()=>{
          this.eventManager.publish("CANVAS_GATE_MOVE_END", gate);
          let onCanvas = isInside(gate.domElement, this.domElement);
          let removeable = gate._removeable;
          if(!onCanvas){
            if(removeable){
              gate.remove();
            }else{
              moveToOrigin();
            }
          }
        }
      });
      $(clone).find(".logic-gate-body").addClass("logic-gate-body-active");
    }

    if (removeable) {
      gate.domElement.addEventListener("contextmenu", (event) => {
        if(!gate._removeable) return;
        this.eventManager.publish("CANVAS_GATE_REMOVED", gate);
        event.preventDefault();
        gate.remove();
      })
    }

    let inputsContainer = $(clone).find(".logic-gate-input-terminal")[0];
    let outputsContainer = $(clone).find(".logic-gate-output-terminal")[0];

    let inputsTerminals = $(inputsContainer).children();
    let outputsTerminals = $(outputsContainer).children();

    if (inputsTerminals.length !== functionSpec.inputCount) {
      throw new Error("Input count does not match");
    }
    if (outputsTerminals.length !== functionSpec.outputCount) {
      throw new Error("Output count does not match");
    }

    gate.setLabel = (text) => {
      let div = gate.domElement;
      let label = $(div).find(".logic-gate-label")[0];
      label.innerHTML = text;
    };

    gate.inputTerminals.forEach((terminal, i) => {
      terminal.setDomElement(inputsTerminals[i]);
    });
    gate.outputTerminals.forEach((terminal, i) => {
      terminal.setDomElement(outputsTerminals[i]);
    });

    gate.terminals().forEach(terminal => {
      onInteract(terminal.domElement, (event) => {
        event.stopPropagation();
        this.world.makeConnection(terminal);
        this.showConnectableTerminals();
      });
    });

    this.eventManager.publish("CANVAS_GATE_CREATED", gate);
    return gate;
  }

  showConnectableTerminals() {
    let selectedTerminal = this.world.previousTerminal;
    let selectedIsSource = selectedTerminal?.isSource;

    if (selectedTerminal) {
      selectedTerminal.relatedTerminals.forEach(terminal => {
        let jqTerminal = $(terminal.domElement);
        jqTerminal.addClass("logic-gate-terminal-removeable");
      });
      if (!selectedIsSource && selectedTerminal.relatedTerminals.length > 0) return;
      this.world.terminals.forEach(terminal => {
        if (selectedIsSource !== terminal.isSource) {
          let jqTerminal = $(terminal.domElement);
          jqTerminal.addClass("logic-gate-terminal-connectable");
        }
      });
      this.world.wires.forEach(wire => {
        $(wire.terminalSink.domElement).removeClass("logic-gate-terminal-connectable");
      });
    } else {
      {
        this.world.terminals.forEach(terminal => {
          let jqTerminal = $(terminal.domElement);
          jqTerminal.removeClass("logic-gate-terminal-connectable");
          jqTerminal.removeClass("logic-gate-terminal-removeable");
        });
      }
    }
  }

  createInput(template) {
    template = template || this.templates["IN"];
    let gate = this.createGateElement(template, functionSpecIN, 0, 100, false, false);
    this.world.addInputGate(gate);

    let togglePad = $(gate.domElement).find(".logic-gate-body")[0];
    onInteract(togglePad, () => {
      gate.out(0).toggle()
    });

    this.arrangeIOGates();
    return gate;
  }

  createOutput(template) {
    template = template || this.templates["OUT"];
    let gate = this.createGateElement(template, functionSpecOUT, 500, 100, false, false);
    this.world.addOutputGate(gate);
    this.arrangeIOGates();
    return gate;
  }

  removeInput() {
    let input = this.world.inputs.pop();
    input.remove();
    this.arrangeIOGates();
  }

  removeOutput() {
    let output = this.world.outputs.pop();
    output.remove();
    this.arrangeIOGates();
  }

  arrangeIOGates() {
    let worldInputs = this.world.inputs;
    let worldOutputs = this.world.outputs;
    {
      let stepSize = this.canvas.height / (worldInputs.length + 1);
      let yOffset = stepSize - 25;
      worldInputs.forEach(gate => {
        gate.domElement.style.left = "0px";
        gate.domElement.style.right = "";
        gate.domElement.style.top = `${yOffset}px`;
        yOffset += stepSize;
      });
    }
    {
      let stepSize = this.canvas.height / (worldOutputs.length + 1);
      let yOffset = stepSize - 25;
      worldOutputs.forEach(gate => {
        gate.domElement.style.right = "0px";
        gate.domElement.style.left = "";
        gate.domElement.style.top = `${yOffset}px`;
        yOffset += stepSize;
      });
    }
  }

  connect(terminal1, terminal2) {
    this.world.clearSelction();
    this.world.makeConnection(terminal1);
    return this.world.makeConnection(terminal2);
  }

  linkWorld(otherWorld, x, y) {
    let clone = this.templates["WORLD"].cloneNode(true);
    let inputsContainer = $(clone).find(".logic-gate-input-terminal")[0];
    let outputsContainer = $(clone).find(".logic-gate-output-terminal")[0];

    let terminalTemp = document.createElement("div");
    terminalTemp.classList.add("logic-gate-terminal");

    otherWorld.inputs.forEach((i) => {
      inputsContainer.appendChild(terminalTemp.cloneNode(true));
    });

    otherWorld.outputs.forEach((i) => {
      outputsContainer.appendChild(terminalTemp.cloneNode(true));
    });


    let maxTerminalCount = Math.max(otherWorld.inputs.length, otherWorld.outputs.length);
    let extraHeight = (maxTerminalCount - 3) * 15;
    if (extraHeight > 0) {
      let currentHeight = $(clone).height();
      $(clone).height(currentHeight + extraHeight);
    }

    terminalTemp.remove();
    terminalTemp = null;

    let functionSpecWORLD = new LogicGateFunctionSpec(
      "WORLD",
      () => { },
      otherWorld.inputs.length,
      otherWorld.outputs.length
    )
    let gate = this.createGateElement(clone, functionSpecWORLD, x, y, true, false);
    gate._linkedWorld = otherWorld;

    let linkFunction = () => {
      otherWorld.inputs.forEach((inputGate, i) => {
        inputGate.outputTerminals[0].setState(gate.inputTerminals[i].state);
      });
      otherWorld.outputs.forEach((outputGate, i) => {
        gate.outputTerminals[i].setState(outputGate.inputTerminals[0].state);
      });
      otherWorld.tick();
      if (!otherWorld.isStable()) {
        this.world.notifyInstability();
      }
    }
    functionSpecWORLD.func = linkFunction;

    gate.domElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      let otherWorld = gate._linkedWorld;
      let otherCanvas = otherWorld.parent;
      otherCanvas.remove();
      gate.remove();
    })

    inputsContainer = null;
    outputsContainer = null;

    return gate;
  }

  worldTick() {
    this.world.tick();
  }

  visualTick() {
    this.clearCanvas();
    this.drawGrid();
    this.drawWires();
    this.drawIndicators();
  }

  startVisualTick() {
    clearInterval(this.slowVisualTick);
    this.visualTickRunning = true;
    const visualTick = () => {
      if (!this.visualTickRunning) return;
      this.visualTick();
      requestAnimationFrame(visualTick);
    }
    requestAnimationFrame(visualTick);
  }

  stopVisualTick() {
    this.slowVisualTick = setInterval(() => { }, 100);
    this.visualTickRunning = false;
  }

  startWorldTick(tickPerSecond) {
    tickPerSecond = tickPerSecond || 60;
    if (this.worldTickInterval) {
      clearInterval(this.worldTickInterval);
    }
    this.worldTickInterval = setInterval(() => {
      this.worldTick();
    }, 1000 / tickPerSecond);
  }

  stopWorldTick() {
    clearInterval(this.worldTickInterval);
  }

  loadTemplate(id) {
    let parentDom = $(`#${id}`)[0];
    let class_name_mapping = {
      AND: "logic-and-template",
      OR: "logic-or-template",
      NOT: "logic-not-template",
      NAND: "logic-nand-template",
      NOR: "logic-nor-template",
      XOR: "logic-xor-template",
      IN: "logic-in-template",
      OUT: "logic-out-template",
      WORLD: "logic-world-template"
    }
    let result = {};
    for (const [key, value] of Object.entries(class_name_mapping)) {
      result[key] = $(parentDom).find(`.${value}`)[0];
    }
    this.templates = result;
    return result;
  }

  createGate(fundamentalGateType, x, y, draggable, removeable) {
    if (x === undefined) x = this.domElement.clientWidth / 2;
    if (y === undefined) y = this.domElement.clientHeight / 2;
    if (FundamentalGate[fundamentalGateType] === undefined) {
      console.error("Invalid fundamental gate type");
      return
    }
    let gateTemplate = this.templates[fundamentalGateType];
    let gateFuncSpec = FundamentalGate[fundamentalGateType].functionSpec;
    let gate = this.createGateElement(gateTemplate, gateFuncSpec, x, y, draggable, removeable);
    return gate;
  }

  showWireFrame(e) {
    e = e === undefined ? this.domElement : e;
    let children = $(e).children();
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      $(child).addClass("show-wireframe");
      this.showWireFrame(child);
    }
  }

  hideWireFrame(e) {
    e = e === undefined ? this.domElement : e;
    let children = $(e).find(".show-wireframe");
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      $(child).removeClass("show-wireframe");
    }
  }

  async evaluate(inputs) {
    return await this.world.evaluate(inputs);
  }

  export() {
    let worldData = this.world.export();

    let gateExport = [];
    worldData.gates.forEach((gate, i) => {
      gate._exportID = i;
      if (gate.funcSpec.name === "WORLD") {
        gateExport.push(
          {
            type: gate.funcSpec.name,
            x: gate.domElement.style.left,
            y: gate.domElement.style.top,
            id: gate._exportID,
            state: gate.getState(),
            worldExport: gate._linkedWorld.parent.export(),
            canvasSize: {
              width: gate._linkedWorld.domElement.clientWidth,
              height: gate._linkedWorld.domElement.clientHeight
            }
          }
        )
      } else if (gate.isFundamental()) {
        gateExport.push(
          {
            type: gate.funcSpec.name,
            x: gate.domElement.style.left,
            y: gate.domElement.style.top,
            id: gate._exportID,
            state: gate.getState(),
            isWorldInput: this.world.inputs.includes(gate),
            isWorldOutput: this.world.outputs.includes(gate)
          }
        )
      } else {
        console.error("Unknown gate type");
        return
      }
    });

    let wireExport = [];
    worldData.wires.forEach(wire => {
      let terminal1 = wire.terminalSrc;
      let terminal2 = wire.terminalSink;
      let gate1 = terminal1.parent;
      let gate2 = terminal2.parent;
      let terminal1ID = gate1.terminals().indexOf(terminal1);
      let terminal2ID = gate2.terminals().indexOf(terminal2);
      wireExport.push({
        t1: { gateID: gate1._exportID, terminalID: terminal1ID },
        t2: { gateID: gate2._exportID, terminalID: terminal2ID },
        state: wire.state
      });
    });
    let data = {
      gates: gateExport,
      wires: wireExport,
      canvasSize: {
        width: this.domElement.clientWidth,
        height: this.domElement.clientHeight
      }
    }
    // console.log(data);
    return data;
  }

  load(data) {
    this.domElement.style.width = data.canvasSize.width + "px";
    this.domElement.style.height = data.canvasSize.height + "px";
    this.updateCanvas();

    this.clear();
    let gates = {};
    data.gates.forEach(gateData => {
      if (gateData.type === "WORLD") {
        let world = new World();
        let div = document.createElement("div");
        div.style.width = gateData.canvasSize.width + "px";
        div.style.height = gateData.canvasSize.height + "px";
        document.body.appendChild(div);
        // div.style.display = "none";
        let canvas = new LogicCanvas(world, div);
        canvas.load(gateData.worldExport);
        let x = parseInt(gateData.x);
        let y = parseInt(gateData.y);
        let gate = this.linkWorld(world, x, y);
        gates[gateData.id] = gate;
        gates[gateData.id].setState(gateData.state);
      } else if (FundamentalGate[gateData.type] !== undefined) {
        let x = parseInt(gateData.x);
        let y = parseInt(gateData.y);
        if (gateData.isWorldInput) {
          gates[gateData.id] = this.createInput();
        } else if (gateData.isWorldOutput) {
          gates[gateData.id] = this.createOutput();
        } else {
          gates[gateData.id] = this.createGate(gateData.type, x, y);
        }
        gates[gateData.id].setState(gateData.state);
      } else {
        console.error("Unknown gate type", gateData);
        return;
      }
    });

    data.wires.forEach(wireData => {
      let terminal1 = gates[wireData.t1.gateID].terminals()[wireData.t1.terminalID];
      let terminal2 = gates[wireData.t2.gateID].terminals()[wireData.t2.terminalID];
      let wire = this.connect(terminal1, terminal2);
      wire.setState(wireData.state);
    });
    this.visualTick();
  }

  clone() {
    let data = this.export();
    let newDiv = this.domElement.cloneNode(false);
    let newCanvas = new LogicCanvas(new World(), newDiv);
    newCanvas.load(data);
    return newCanvas;
  }

  clear(keepIO) {
    if(keepIO){
      this.world.gates.forEach(gate => {
        let isInput = this.world.inputs.includes(gate);
        let isOutput = this.world.outputs.includes(gate);
        let isIO = isInput || isOutput;
        if (gate.funcSpec.name === "WORLD") {
          gate._linkedWorld.parent.remove();
        }
        if(isIO) return;
        gate.remove();
      });
      this.world.wires.forEach(wire => {
        wire.remove();
      })
    }else{
      this.world.clear(); 
    }
  }

  remove() {
    this.clear();
    window.removeEventListener("resize", this.onResize);
    clearInterval(this.slowVisualTick);
    this.stopVisualTick();
    this.stopWorldTick();
    this.domElement.remove();
    this.domElement = null;
    this.world.remove();
    this.world = null;
  }

  importAsGate(data, x, y) {
    if (data instanceof LogicCanvas) { data = data.export(); }
    let newDiv = document.createElement("div");
    newDiv.style.width = `${data.canvasSize.width}px`;
    newDiv.style.height = `${data.canvasSize.height}px`;
    document.body.appendChild(newDiv);
    let newWorld = new World();
    let newCanvas = new LogicCanvas(newWorld, newDiv);
    newCanvas.load(data);

    x = x || 100;
    y = y || 100;
    let gate = this.linkWorld(newCanvas.world, x, y);

    return gate;
  }
}