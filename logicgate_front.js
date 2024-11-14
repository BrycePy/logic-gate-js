const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

$(function () {
  let div = document.createElement("div");
  div.id = "logic-gate-default-template";
  div.style.display = "none";
  document.body.appendChild(div);
  div.setHTMLUnsafe(logicGateDefaultTemplate);
});

const calculateOffset = (element, parent) => {
  let offset = { top: 0, left: 0 };
  while (element !== parent) {
    if (!element) {
      return offset;
    }
    offset.top += element.offsetTop;
    offset.left += element.offsetLeft;
    element = element.parentElement;
  }
  return offset;
};

const onInteract = (element, callback) => {
  let letCallAt = 0;
  const call = (event) => {
    let now = Date.now();
    if(now - letCallAt < 100) return;
    letCallAt = now;
    callback(event);
  }
  ["mousedown", "touchstart"].forEach(event => {
    element.addEventListener(event, call);
  });
}

class LogicCanvas {
  constructor(world, div, templateID) {
    world.setDomElement(div);
    world.setParent(this);
    this.world = world;
    this.div = div;
    this.loadTemplate(templateID || "logic-gate-templates");

    $(div).addClass("logic-gate-div");

    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);
    this.updateCanvas();
    this.clearCanvas();
    this.drawGrid();

    this.onResize = () => {
      this.updateCanvas();
      this.visualTick();
    }

    window.addEventListener("resize", this.onResize);

    this.slowVisualTick = setInterval(() => {
      this.visualTick();
    }, 100);
  }

  updateCanvas() {
    this.canvas.width = this.div.clientWidth;
    this.canvas.height = this.div.clientHeight;
    this.canvas.style.width = this.div.clientWidth + "px";
    this.canvas.style.height = this.div.clientHeight + "px";
    $(this.canvas).addClass("logic-gate-canvas")
    this.ctx = this.canvas.getContext("2d");
    this.arrangeIOGates();
  }

  updateTerminalsDom() {
    this.world.terminals.forEach(terminal => {
      let jqTerminal = $(terminal.domElement);
      if (terminal.state === State.ON) {
        jqTerminal.addClass("logic-gate-terminal-on");
      } else {
        jqTerminal.removeClass("logic-gate-terminal-on");
      }
    });
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

      let srcPos = calculateOffset(terminal1.domElement, this.div);
      let sinkPos = calculateOffset(terminal2.domElement, this.div);

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
  }

  drawIndicators() {
    let ctx = this.ctx;
    ctx.fillStyle = this.world.isStable() ? "#4f4" : "#f44";
    ctx.fillRect(0, 0, 10, 10);

    ctx.fillStyle = this.world.tickCount % 2 == 0 ? "#fff" : "#ccc";
    ctx.fillRect(10, 0, 10, 10);

    ctx.fillStyle = this.world.previousTerminal ? "#fff" : "#ccc";
    ctx.fillRect(20, 0, 10, 10);
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
    this.div.appendChild(clone);
    if (draggable){
      $(clone).draggable({
        handle: ".logic-gate-body",
      });
      $(clone).find(".logic-gate-body").addClass("logic-gate-body-active");
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

    let gate = this.world.createLogicGate(functionSpec);
    gate.setDomElement(clone);

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

    if (removeable) {
      gate.domElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        gate.remove();
      })
    }

    return gate;
  }

  showConnectableTerminals() {
    if(this.world.previousTerminal){
      let otherIsSource = this.world.previousTerminal.isSource;
      this.world.terminals.forEach(terminal => {
        if(otherIsSource !== terminal.isSource){
          let jqTerminal = $(terminal.domElement);
          jqTerminal.addClass("logic-gate-terminal-highlight");
        }
      });
      this.world.wires.forEach(wire => {
        $(wire.terminalSink.domElement).removeClass("logic-gate-terminal-highlight");
      });
    }else{{
      this.world.terminals.forEach(terminal => {
        let jqTerminal = $(terminal.domElement);
        jqTerminal.removeClass("logic-gate-terminal-highlight");
      });
    }}
  }

  createInput(template) {
    template = template || this.templates["IN"];
    let gate = this.createGateElement(template, functionSpecIN, 0, 100, false, false);
    this.world.addInputGate(gate);

    let togglePad = $(gate.domElement).find(".logic-gate-body")[0];
    onInteract(togglePad,() => {
      let currentState = gate.outputTerminals[0].state;
      gate.outputTerminals[0].state = !currentState;
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
        inputGate.outputTerminals[0].state = gate.inputTerminals[i].state;
      });
      otherWorld.outputs.forEach((outputGate, i) => {
        gate.outputTerminals[i].state = outputGate.inputTerminals[0].state;
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
    this.updateTerminalsDom();
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

  createGate(fundamentalGateType, x, y) {
    if (FundamentalGate[fundamentalGateType] === undefined) {
      console.error("Invalid fundamental gate type");
      return
    }
    let gateTemplate = this.templates[fundamentalGateType];
    let gateFuncSpec = FundamentalGate[fundamentalGateType].functionSpec;
    let gate = this.createGateElement(gateTemplate, gateFuncSpec, x, y);
    return gate;
  }

  showWireFrame(e) {
    e = e === undefined ? this.div : e;
    let children = $(e).children();
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      $(child).addClass("show-wireframe");
      this.showWireFrame(child);
    }
  }

  hideWireFrame(e) {
    e = e === undefined ? this.div : e;
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
        width: this.div.clientWidth,
        height: this.div.clientHeight
      }
    }
    // console.log(data);
    return data;
  }

  load(data) {
    this.div.style.width = data.canvasSize.width + "px";
    this.div.style.height = data.canvasSize.height + "px";
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
    let newDiv = this.div.cloneNode(false);
    let newCanvas = new LogicCanvas(new World(), newDiv);
    newCanvas.load(data);
    return newCanvas;
  }

  clear() {
    this.world.gates.forEach(gate => {
      if (gate.funcSpec.name === "WORLD") {
        gate._linkedWorld.parent.remove();
      }
      gate.remove();
    });
    this.world.clear();
  }

  remove() {
    this.clear();
    window.removeEventListener("resize", this.onResize);
    clearInterval(this.slowVisualTick);
    this.stopVisualTick();
    this.stopWorldTick();
    this.div.remove();
    this.div = null;
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