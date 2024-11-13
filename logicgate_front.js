const calculateOffset = (element, parent) => {
  let offset = {top: 0, left: 0};
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
  constructor(world, div) {
    this.world = world;
    this.div = div;

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
      // console.log(srcPos, sinkPos);
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
          }else{
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
    let gate = this.createGateElement(template, functionSpecIN, 0, 100, false, false);
    this.world.addInputGate(gate);

    gate.domElement.addEventListener("click", () => {
      let currentState = gate.outputTerminals[0].state;
      gate.outputTerminals[0].state = !currentState;
    });

    let worldInputs = this.world.inputs;
    let stepSize = this.canvas.height / (worldInputs.length + 1);
    let yOffset = stepSize/2;
    this.world.inputs.forEach(inputGate => {
      inputGate.domElement.style.left = "0px";
      inputGate.domElement.style.right = "";
      inputGate.domElement.style.top = `${yOffset}px`;
      yOffset += stepSize;
    });
    return gate;
  }

  createOutput(template) {
    let gate = this.createGateElement(template, functionSpecOUT, 500, 100, false, false);
    this.world.addOutputGate(gate);

    let worldOutputs = this.world.outputs;
    let stepSize = this.canvas.height / (worldOutputs.length + 1);
    let yOffset = stepSize/2;
    this.world.outputs.forEach(outputGate => {
      outputGate.domElement.style.left = "";
      outputGate.domElement.style.right = "0px";
      outputGate.domElement.style.top = `${yOffset}px`;
      yOffset += stepSize;
    });
    return gate;
  }

  connect(terminal1, terminal2) {
    this.world.clearSelction();
    this.world.makeConnection(terminal1);
    this.world.makeConnection(terminal2);
  }

  linkWorld(template, otherWorld, x, y) {
    console.log(otherWorld);
    let clone = template.cloneNode(true);
    $(clone).removeClass("logic-gate-div-relative");
    $(clone).addClass("logic-gate-div-absolute");
    this.div.appendChild(clone);
    clone.style.left = `${x || 100}px`;
    clone.style.top = `${y || 100}px`;
    $(clone).draggable();

    let inputsContainer = $(clone).find(".logic-gate-input-terminal")[0];
    let outputsContainer = $(clone).find(".logic-gate-output-terminal")[0];

    console.log(inputsContainer);

    let functionSpecWORLD = new LogicGateFunctionSpec(
      "world",
      () => {},
      otherWorld.inputs.length,
      otherWorld.outputs.length
    )
    let gate = this.world.createLogicGate(functionSpecWORLD);
    gate.setDomElement(clone);

    otherWorld.inputs.forEach((inputGate, i) => {
      let newTerminalDom = document.createElement("div");
      newTerminalDom.classList.add("terminal");
      inputsContainer.appendChild(newTerminalDom);
      gate.inputTerminals[i].setDomElement(newTerminalDom);
    });

    otherWorld.outputs.forEach((outputGate, i) => {
      let newTerminalDom = document.createElement("div");
      newTerminalDom.classList.add("terminal");
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
      if(!otherWorld.isStable()) {
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
      if(!this.visualTickRunning) return;
      this.visualTick();
      requestAnimationFrame(visualTick);
    }
    requestAnimationFrame(visualTick);
  }

  stopVisualTick() {
    this.visualTickRunning = false;
  }

  startWorldTick(tickPerSecond) {
    if (this.worldTickInterval) {
      clearInterval(this.worldTickInterval);
    }
    this.worldTickInterval = setInterval(() => {
      this.worldTick();
    }, 1000/tickPerSecond);
  }

  stopWorldTick() {
    clearInterval(this.worldTickInterval);
  }

  loadTemplate(id) {
    let parentDom = $(`#${id}`)[0];
    let class_name_mapping = {
      [FundamentalGate.AND.name]: "logic-and-template",
      [FundamentalGate.OR.name]: "logic-or-template",
      [FundamentalGate.NOT.name]: "logic-not-template",
      [FundamentalGate.NAND.name]: "logic-nand-template",
      [FundamentalGate.NOR.name]: "logic-nor-template",
      [FundamentalGate.XOR.name]: "logic-xor-template",
      [FundamentalGate.IN.name]: "logic-in-template",
      [FundamentalGate.OUT.name]: "logic-out-template"
    }

    let result = {};
    for(const [key, value] of Object.entries(class_name_mapping)) {
      result[key] = $(parentDom).find(`.${value}`)[0];
    }
    return result;
  }

  createGate(fundamentalGateType, templates, x, y) {
    let gateTemplate = templates[fundamentalGateType];
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

  hideWireFrame() {
    let children = $(this.div).find(".show-wireframe");
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      $(child).removeClass("show-wireframe");
    }
  }
}

let templates = {
  "and": document.getElementById("logic-and-template"),
  "or": document.getElementById("logic-or-template"),
  "not": document.getElementById("logic-not-template"),
  "xor": document.getElementById("logic-xor-template"),
  "in": document.getElementById("logic-in-template"),
  "out": document.getElementById("logic-out-template"),
  "world": document.getElementById("logic-world-template")
}

function createLatch(){
  let world = new World();
  let userDefinedGateDiv = document.getElementById("user-defined-gates");
  let latchDiv = document.createElement("div");
  latchDiv.style.width = "400px"
  latchDiv.style.height = "200px"
  userDefinedGateDiv.appendChild(latchDiv);

  let canvas = new LogicCanvas(world, latchDiv);

  let gateOr1 = canvas.createGateElement(templates["or"], functionSpecOR, 130, 20);
  let gateNot1 = canvas.createGateElement(templates["not"], functionSpecNOT, 200, 20);

  let gateOr2 = canvas.createGateElement(templates["or"], functionSpecOR, 130, 130);
  let gateNot2 = canvas.createGateElement(templates["not"], functionSpecNOT, 200, 130);

  let in1 = canvas.createInput(templates["in"]);
  let in2 = canvas.createInput(templates["in"]);
  let out1 = canvas.createOutput(templates["out"]);
  let out2 = canvas.createOutput(templates["out"]);

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


function createFullAdder(){
  let world = new World();
  let userDefinedGateDiv = document.getElementById("user-defined-gates");
  let fullAdderDiv = document.createElement("div");
  fullAdderDiv.style.width = "400px"
  fullAdderDiv.style.height = "200px"
  userDefinedGateDiv.appendChild(fullAdderDiv);

  let canvas = new LogicCanvas(world, fullAdderDiv);

  let gateXOR1 = canvas.createGateElement(templates["xor"], functionSpecXOR, 100, 20);
  let gateXOR2 = canvas.createGateElement(templates["xor"], functionSpecXOR, 200, 20);

  let gateAND1 = canvas.createGateElement(templates["and"], functionSpecAND, 120, 145);
  let gateAND2 = canvas.createGateElement(templates["and"], functionSpecAND, 200, 80);

  let gateOR = canvas.createGateElement(templates["or"], functionSpecOR, 280, 100);

  let in1 = canvas.createInput(templates["in"]);
  let in2 = canvas.createInput(templates["in"]);
  let in3 = canvas.createInput(templates["in"]);
  let out1 = canvas.createOutput(templates["out"]);
  let out2 = canvas.createOutput(templates["out"]);

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

function test(){
  let mainWorld = new World();
  let mainDiv = document.getElementById("main-div");
  mainDiv.style.width = "600px"
  mainDiv.style.height = "400px"
  let logicCanvas = new LogicCanvas(mainWorld, mainDiv);
  
  for(let i = 0; i < 8; i++){
    logicCanvas.createInput(templates["in"]);
  }
  
  for(let i = 0; i < 5; i++){
    logicCanvas.createOutput(templates["out"]);
  }
  
  let latch1 = createLatch();
  let latch2 = createLatch();

  // logicCanvas.linkWorld(templates["world"], latch1.world, 300, 200);
  // logicCanvas.linkWorld(templates["world"], latch2.world, 400, 200);
  
  logicCanvas.linkWorld(templates["world"], adder1.world, 100, 300);
  logicCanvas.linkWorld(templates["world"], adder2.world, 200, 300);
  logicCanvas.linkWorld(templates["world"], adder3.world, 300, 300);
  logicCanvas.linkWorld(templates["world"], adder4.world, 400, 300);
  
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
  setInterval(backendTick, 1000/30);
  
  console.log("logicgate_front.js loaded");
}
