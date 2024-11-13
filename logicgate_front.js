class LogicCanvas {
  constructor(world, div) {
    this.world = world;
    this.div = div;

    $(div).addClass("logic-canvas-div");

    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);
    this.updateCanvas();
    this.clearCanvas();
    this.drawGrid();
  }

  updateCanvas() {
    this.canvas.width = this.div.clientWidth;
    this.canvas.height = this.div.clientHeight;
    this.canvas.style.width = this.div.clientWidth + "px";
    this.canvas.style.height = this.div.clientHeight + "px";
    this.ctx = this.canvas.getContext("2d");
  }

  updateTerminalsDom() {
    this.world.terminals.forEach(terminal => {
      let jq_terminal = $(terminal.domElement);
      if (terminal.state === State.ON) {
        jq_terminal.addClass("terminal-on");
      } else {
        jq_terminal.removeClass("terminal-on");
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
      let jq_terminal1 = $(terminal1.domElement);
      let jq_terminal2 = $(terminal2.domElement);

      let src_position = jq_terminal1.offset()
      let sink_position = jq_terminal2.offset()
      src_position.top -= jq_terminal1.height() / 2;
      src_position.left -= jq_terminal1.width() / 2;
      sink_position.top -= jq_terminal2.height() / 2;
      sink_position.left -= jq_terminal2.width() / 2;

      let x_mid = (src_position.left + sink_position.left) / 2;
      let y_mid = (src_position.top + sink_position.top) / 2;

      ctx.beginPath();
      ctx.strokeStyle = wire.state === State.ON ? "white" : "black";

      const drawCases = {
        "self-connecting": () => {
          let yOffset = 50;
          let xOffset = 30;
          let bridgeY;
          if (sink_position.top > src_position.top) {
            bridgeY = src_position.top - yOffset;
          }else{
            bridgeY = src_position.top + yOffset;
          }
          ctx.moveTo(src_position.left, src_position.top);
          ctx.lineTo(src_position.left + xOffset, src_position.top);
          ctx.lineTo(src_position.left + xOffset, bridgeY);
          ctx.lineTo(sink_position.left - xOffset, bridgeY);
          ctx.lineTo(sink_position.left - xOffset, sink_position.top);
          ctx.lineTo(sink_position.left, sink_position.top);
        },
        "src-right-of-sink": () => {
          let yOffset = 30;
          let xOffset = 30;
          ctx.moveTo(src_position.left, src_position.top);
          ctx.lineTo(src_position.left + xOffset, src_position.top);
          if (src_position.top < sink_position.top) {
            ctx.lineTo(src_position.left + xOffset, src_position.top + yOffset);
            ctx.lineTo(sink_position.left - xOffset, sink_position.top - yOffset);
            ctx.lineTo(sink_position.left - xOffset, sink_position.top);
            ctx.lineTo(sink_position.left, sink_position.top);
          } else {
            ctx.lineTo(src_position.left + xOffset, src_position.top - yOffset);
            ctx.lineTo(sink_position.left - xOffset, sink_position.top + yOffset);
            ctx.lineTo(sink_position.left - xOffset, sink_position.top);
            ctx.lineTo(sink_position.left, sink_position.top);
          }
        },
        "default-grid": () => {
          ctx.moveTo(src_position.left, src_position.top);
          ctx.lineTo(x_mid, src_position.top);
          ctx.lineTo(x_mid, sink_position.top);
          ctx.lineTo(sink_position.left, sink_position.top);
        },
        "default": () => {
          ctx.moveTo(src_position.left, src_position.top);
          ctx.lineTo(sink_position.left, sink_position.top);
        }
      }
      
      let dx = sink_position.left - src_position.left;
      let dy = Math.abs(src_position.top - sink_position.top);
      let srcRightOfSink = src_position.left > sink_position.left;
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

    let inputsContainer = $(clone).find(".input-terminals")[0];
    let outputsContainer = $(clone).find(".output-terminals")[0];

    let inputs_terminals = $(inputsContainer).children();
    let outputs_terminals = $(outputsContainer).children();

    if (inputs_terminals.length !== functionSpec.input_count) {
      throw new Error("Input count does not match");
    }
    if (outputs_terminals.length !== functionSpec.output_count) {
      throw new Error("Output count does not match");
    }

    let gate = this.world.createLogicGate(functionSpec);
    gate.setDomElement(clone);
    gate.input_terminals.forEach((terminal, i) => {
      terminal.setDomElement(inputs_terminals[i]);
    });
    gate.output_terminals.forEach((terminal, i) => {
      terminal.setDomElement(outputs_terminals[i]);
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
      let current_state = gate.output_terminals[0].state;
      gate.output_terminals[0].state = !current_state;
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
}


let mainWorld = new World();
let mainDiv = document.getElementById("main-div");
mainDiv.style.width = "600px"
mainDiv.style.height = "400px"

let logicCanvas = new LogicCanvas(mainWorld, mainDiv);

let templates = {
  "and": document.getElementById("logic-and-template"),
  "or": document.getElementById("logic-or-template"),
  "not": document.getElementById("logic-not-template"),
  "in": document.getElementById("logic-in-template"),
  "out": document.getElementById("logic-out-template")
}

let gateAnd = logicCanvas.createGateElement(templates["and"], functionSpecAND, 150, 100);
let gateOr = logicCanvas.createGateElement(templates["or"], functionSpecOR, 150, 200);
let gateNot = logicCanvas.createGateElement(templates["not"], functionSpecNOT, 300, 100);

mainWorld.makeConnection(gateAnd.output_terminals[0]);
mainWorld.makeConnection(gateOr.input_terminals[0]);

mainWorld.makeConnection(gateNot.output_terminals[0]);
mainWorld.makeConnection(gateNot.input_terminals[0]);

logicCanvas.createInput(templates["in"]);
logicCanvas.createInput(templates["in"]);
logicCanvas.createInput(templates["in"]);
logicCanvas.createOutput(templates["out"]);
logicCanvas.createOutput(templates["out"]);

const visualTick = () => {
  logicCanvas.visualTick();
  requestAnimationFrame(visualTick);
}
requestAnimationFrame(visualTick);

const backendTick = () => {
  logicCanvas.worldTick();
}
setInterval(backendTick, 100);

console.log("logicgate_front.js loaded");
