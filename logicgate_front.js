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

class LogicCanvas {
  constructor(world, div, templateID) {
    this.world = world;
    this.div = div;
    this.loadTemplate(templateID || "logic-gate-templates");

    $(div).addClass("logic-gate-div");

    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);
    this.updateCanvas();
    this.clearCanvas();
    this.drawGrid();

    window.addEventListener("resize", () => {
      this.updateCanvas();
      this.visualTick();
    });

  }

  updateCanvas() {
    this.canvas.width = this.div.clientWidth;
    this.canvas.height = this.div.clientHeight;
    this.canvas.style.width = this.div.clientWidth + "px";
    this.canvas.style.height = this.div.clientHeight + "px";
    $(this.canvas).addClass("logic-gate-canvas")
    this.ctx = this.canvas.getContext("2d");
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
    if (draggable) $(clone).draggable();

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
    gate.inputTerminals.forEach((terminal, i) => {
      terminal.setDomElement(inputsTerminals[i]);
    });
    gate.outputTerminals.forEach((terminal, i) => {
      terminal.setDomElement(outputsTerminals[i]);
    });

    gate.terminals().forEach(terminal => {
      terminal.domElement.addEventListener("click", (event) => {
        event.stopPropagation();
        this.world.makeConnection(terminal);
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

  createInput(template) {
    template = template || this.templates["IN"];
    let gate = this.createGateElement(template, functionSpecIN, 0, 100, false, false);
    this.world.addInputGate(gate);

    gate.domElement.addEventListener("click", () => {
      let currentState = gate.outputTerminals[0].state;
      gate.outputTerminals[0].state = !currentState;
    });

    this.arangeInputOutput();
    return gate;
  }

  createOutput(template) {
    template = template || this.templates["OUT"];
    let gate = this.createGateElement(template, functionSpecOUT, 500, 100, false, false);
    this.world.addOutputGate(gate);
    this.arangeInputOutput();
    return gate;
  }

  arangeInputOutput() {
    let worldInputs = this.world.inputs;
    let worldOutputs = this.world.outputs;
    {
      let stepSize = this.canvas.height / (worldInputs.length + 1);
      let yOffset = stepSize / 2;
      worldInputs.forEach(gate => {
        gate.domElement.style.left = "0px";
        gate.domElement.style.right = "";
        gate.domElement.style.top = `${yOffset}px`;
        yOffset += stepSize;
      });
    }
    {
      let stepSize = this.canvas.height / (worldOutputs.length + 1);
      let yOffset = stepSize / 2;
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

  linkWorld(template, otherWorld, x, y) {
    let clone = template.cloneNode(true);
    $(clone).removeClass("logic-gate-div-relative");
    $(clone).addClass("logic-gate-div-absolute");
    this.div.appendChild(clone);
    clone.style.left = `${x || 100}px`;
    clone.style.top = `${y || 100}px`;
    $(clone).draggable();

    let inputsContainer = $(clone).find(".logic-gate-input-terminal")[0];
    let outputsContainer = $(clone).find(".logic-gate-output-terminal")[0];

    let functionSpecWORLD = new LogicGateFunctionSpec(
      "world",
      () => { },
      otherWorld.inputs.length,
      otherWorld.outputs.length
    )
    let gate = this.world.createLogicGate(functionSpecWORLD);
    gate.setDomElement(clone);

    otherWorld.inputs.forEach((inputGate, i) => {
      let newTerminalDom = document.createElement("div");
      newTerminalDom.classList.add("logic-gate-terminal");
      inputsContainer.appendChild(newTerminalDom);
      gate.inputTerminals[i].setDomElement(newTerminalDom);
    });

    otherWorld.outputs.forEach((outputGate, i) => {
      let newTerminalDom = document.createElement("div");
      newTerminalDom.classList.add("logic-gate-terminal");
      outputsContainer.appendChild(newTerminalDom);
      gate.outputTerminals[i].setDomElement(newTerminalDom);
    });

    gate.terminals().forEach(terminal => {
      terminal.domElement.addEventListener("click", (event) => {
        event.stopPropagation();
        this.world.makeConnection(terminal);
      });
    });

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
    this.visualTickRunning = true;
    const visualTick = () => {
      if (!this.visualTickRunning) return;
      this.visualTick();
      requestAnimationFrame(visualTick);
    }
    requestAnimationFrame(visualTick);
  }

  stopVisualTick() {
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
      if (!gate.isFundamental()) {
        console.error("User defined gates are not supported in export yet");
      }
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
      wires: wireExport
    }
    console.log(data);
    return data;
  }

  import(data) {
    let gates = {};
    data.gates.forEach(gateData => {
      let x = parseInt(gateData.x);
      let y = parseInt(gateData.y);
      if (gateData.isWorldInput) {
        gates[gateData.id] = this.createInput();
      }else if (gateData.isWorldOutput) {
        gates[gateData.id] = this.createOutput();
      } else {
        gates[gateData.id] = this.createGate(gateData.type, x, y);
      }
      gates[gateData.id].setState(gateData.state);
    });

    data.wires.forEach(wireData => {
      let terminal1 = gates[wireData.t1.gateID].terminals()[wireData.t1.terminalID];
      let terminal2 = gates[wireData.t2.gateID].terminals()[wireData.t2.terminalID];
      let wire = this.connect(terminal1, terminal2);
      wire.setState(wireData.state);
    });
    this.visualTick();
  }

  clone(div) {
    let exportData = this.export();
    let newCanvas = new LogicCanvas(new World(), div);
    newCanvas.import(exportData);
    return newCanvas;
  }
}

function createLatch(templates) {
  let world = new World();
  let userDefinedGateDiv = document.getElementById("user-defined-gates");
  let latchDiv = document.createElement("div");
  latchDiv.style.width = "400px"
  latchDiv.style.height = "200px"
  userDefinedGateDiv.appendChild(latchDiv);

  let canvas = new LogicCanvas(world, latchDiv);

  let gateOr1 = canvas.createGateElement(templates["OR"], functionSpecOR, 130, 20);
  let gateNot1 = canvas.createGateElement(templates["NOT"], functionSpecNOT, 200, 20);

  let gateOr2 = canvas.createGateElement(templates["OR"], functionSpecOR, 130, 130);
  let gateNot2 = canvas.createGateElement(templates["NOT"], functionSpecNOT, 200, 130);

  let in1 = canvas.createInput(templates["IN"]);
  let in2 = canvas.createInput(templates["IN"]);
  let out1 = canvas.createOutput(templates["OUT"]);
  let out2 = canvas.createOutput(templates["OUT"]);

  world.makeConnection(in1.outputTerminals[0]);
  world.makeConnection(gateOr1.inputTerminals[0]);

  world.makeConnection(in2.outputTerminals[0]);
  world.makeConnection(gateOr2.inputTerminals[1]);

  world.makeConnection(gateOr1.outputTerminals[0]);
  world.makeConnection(gateNot1.inputTerminals[0]);

  world.makeConnection(gateOr2.outputTerminals[0]);
  world.makeConnection(gateNot2.inputTerminals[0]);

  world.makeConnection(gateNot1.outputTerminals[0]);
  world.makeConnection(out1.inputTerminals[0]);

  world.makeConnection(gateNot2.outputTerminals[0]);
  world.makeConnection(out2.inputTerminals[0]);

  world.makeConnection(gateNot1.outputTerminals[0]);
  world.makeConnection(gateOr2.inputTerminals[0]);

  world.tick();
  world.tick();

  world.makeConnection(gateNot2.outputTerminals[0]);
  world.makeConnection(gateOr1.inputTerminals[1]);

  return canvas;
}


function createFullAdder(templates) {
  let world = new World();
  let userDefinedGateDiv = document.getElementById("user-defined-gates");
  let fullAdderDiv = document.createElement("div");
  fullAdderDiv.style.width = "400px"
  fullAdderDiv.style.height = "200px"
  userDefinedGateDiv.appendChild(fullAdderDiv);

  let canvas = new LogicCanvas(world, fullAdderDiv);

  let gateXOR1 = canvas.createGateElement(templates["XOR"], functionSpecXOR, 100, 20);
  let gateXOR2 = canvas.createGateElement(templates["XOR"], functionSpecXOR, 200, 20);

  let gateAND1 = canvas.createGateElement(templates["AND"], functionSpecAND, 120, 145);
  let gateAND2 = canvas.createGateElement(templates["AND"], functionSpecAND, 200, 80);

  let gateOR = canvas.createGateElement(templates["OR"], functionSpecOR, 280, 100);

  let in1 = canvas.createInput(templates["IN"]);
  let in2 = canvas.createInput(templates["IN"]);
  let in3 = canvas.createInput(templates["IN"]);
  let out1 = canvas.createOutput(templates["OUT"]);
  let out2 = canvas.createOutput(templates["OUT"]);

  world.makeConnection(in1.outputTerminals[0]);
  world.makeConnection(gateXOR1.inputTerminals[0]);

  world.makeConnection(in1.outputTerminals[0]);
  world.makeConnection(gateAND1.inputTerminals[0]);

  world.makeConnection(in2.outputTerminals[0]);
  world.makeConnection(gateXOR1.inputTerminals[1]);

  world.makeConnection(in2.outputTerminals[0]);
  world.makeConnection(gateAND1.inputTerminals[1]);

  world.makeConnection(gateXOR1.outputTerminals[0]);
  world.makeConnection(gateXOR2.inputTerminals[0]);

  world.makeConnection(gateXOR1.outputTerminals[0]);
  world.makeConnection(gateAND2.inputTerminals[0]);

  world.makeConnection(in3.outputTerminals[0]);
  world.makeConnection(gateXOR2.inputTerminals[1]);

  world.makeConnection(in3.outputTerminals[0]);
  world.makeConnection(gateAND2.inputTerminals[1]);

  world.makeConnection(gateXOR2.outputTerminals[0]);
  world.makeConnection(out1.inputTerminals[0]);

  world.makeConnection(gateAND1.outputTerminals[0]);
  world.makeConnection(gateOR.inputTerminals[1]);

  world.makeConnection(gateAND2.outputTerminals[0]);
  world.makeConnection(gateOR.inputTerminals[0]);

  world.makeConnection(gateOR.outputTerminals[0]);
  world.makeConnection(out2.inputTerminals[0]);

  return canvas;
}


function test() {
  let mainWorld = new World();
  let mainDiv = document.getElementById("main-div");
  mainDiv.style.width = "600px"
  mainDiv.style.height = "400px"
  let logicCanvas = new LogicCanvas(mainWorld, mainDiv);
  let templates = logicCanvas.loadTemplate("logic-gate-templates");

  for (let i = 0; i < 8; i++) {
    logicCanvas.createInput(templates["IN"]);
  }

  for (let i = 0; i < 5; i++) {
    logicCanvas.createOutput(templates["OUT"]);
  }

  let latch1 = createLatch(templates);
  let latch2 = createLatch(templates);

  let adder1 = createFullAdder(templates);
  let adder2 = createFullAdder(templates);
  let adder3 = createFullAdder(templates);
  let adder4 = createFullAdder(templates);

  logicCanvas.linkWorld(templates["WORLD"], latch1.world, 300, 200);
  logicCanvas.linkWorld(templates["WORLD"], latch2.world, 400, 200);

  logicCanvas.linkWorld(templates["WORLD"], adder1.world, 100, 300);
  logicCanvas.linkWorld(templates["WORLD"], adder2.world, 200, 300);
  logicCanvas.linkWorld(templates["WORLD"], adder3.world, 300, 300);
  logicCanvas.linkWorld(templates["WORLD"], adder4.world, 400, 300);

  const visualTick = () => {
    logicCanvas.visualTick();
    latch1.visualTick();
    latch2.visualTick();
    adder1.visualTick();
    adder2.visualTick();
    adder3.visualTick();
    adder4.visualTick();
    requestAnimationFrame(visualTick);
  }
  requestAnimationFrame(visualTick);

  const backendTick = () => {
    logicCanvas.worldTick();
  }
  setInterval(backendTick, 1000 / 30);
}

console.log("logicgate_front.js loaded");