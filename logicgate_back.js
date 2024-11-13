class State {
  static ON = true;
  static OFF = false;
}

class Terminal {
  constructor(world, parent, isSource) {
    this.isSource = isSource;
    this.state = State.OFF;
    this.parent = parent;

    this.world = world;
    world.terminals.push(this);
  }

  setDomElement(domElement) {
    this.domElement = domElement;
  }

  remove() {
    this.world.terminals = this.world.terminals.filter(t => t !== this);
    this.world = null;
    this.parent = null;
    if (this.domElement) {
      this.domElement.remove();
    }
  }
}

class Wire {
  constructor(world, terminal1, terminal2) {
    if (terminal1 === terminal2) {
      console.error("Cannot connect terminal to itself");
      return;
    }
    if (terminal1.isSource && terminal2.isSource) {
      console.error("Wire cannot connect two sources");
      return;
    }
    if (!terminal1.isSource && !terminal2.isSource) {
      console.error("Wire cannot connect two sinks");
      return;
    }

    this.world = world;
    world.wires.push(this);

    if (terminal1.isSource) {
      this.terminalSrc = terminal1;
      this.terminalSink = terminal2;
    } else {
      this.terminalSrc = terminal2;
      this.terminalSink = terminal1;
    }
    this.state = State.OFF;
  }
  setDomElement(domElement) {
    this.domElement = domElement;
  }
  update() {
    this.state = this.terminalSrc.state;
    this.terminalSink.state = this.state;
  }
  remove() {
    this.terminalSink.state = State.OFF;
    this.world.wires = this.world.wires.filter(w => w !== this);
    this.world = null;
    this.terminalSrc = null;
    this.terminalSink = null;
    if (this.domElement) {
      this.domElement.remove(); 
    }
  }
}

class Gate {
  constructor(world, funcSpec) {
    this.world = world;
    world.gates.push(this);

    this.func = funcSpec.func;
    this.input_terminals = [];
    this.output_terminals = [];

    for (let i = 0; i < funcSpec.input_count; i++) {
      this.input_terminals.push(new Terminal(world, this, false));
    }

    for (let i = 0; i < funcSpec.output_count; i++) {
      this.output_terminals.push(new Terminal(world, this, true));
    }
  }
  setDomElement(domElement) {
    this.domElement = domElement;
  }

  update() {
    if (this.input_terminals.length === 0) return;
    if (this.output_terminals.length === 0) return;
    let inputs = this.input_terminals.map(t => t.state);
    let outputs = this.func(...inputs);
    if (outputs instanceof Array) {
      outputs.forEach((output, i) => {
        this.output_terminals[i].state = output;
      });
    } else {
      this.output_terminals[0].state = outputs;
    }
  }

  terminals() {
    return this.input_terminals.concat(this.output_terminals);
  }

  remove() {
    this.world.inputs = this.world.inputs.filter(g => g !== this);
    this.world.outputs = this.world.outputs.filter(g => g !== this);
    this.world.gates = this.world.gates.filter(g => g !== this);
    this.world = null;
    this.input_terminals.forEach(t => t.remove());
    this.output_terminals.forEach(t => t.remove());
    if (this.domElement) {
      this.domElement.remove();
    }
  }
}

class EventManager {
  constructor() {
    this.events = {};
  }
  subscribe(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }
  publish(event, data) {
    if (!this.events[event] || this.events[event].length < 1) return;
    this.events[event].forEach(callback => callback(data));
  }
}

class LogicGateFunctionSpec {
  constructor(name, func, input_count, output_count) {
    this.name = name;
    this.func = func;
    this.input_count = input_count;
    this.output_count = output_count;
  }
}

let functionSpecAND = new LogicGateFunctionSpec("AND", (a, b) => a && b, 2, 1);
let functionSpecOR = new LogicGateFunctionSpec("OR", (a, b) => a || b, 2, 1);
let functionSpecNOT = new LogicGateFunctionSpec("NOT", (a) => !a, 1, 1);
let functionSpecIN = new LogicGateFunctionSpec("IN", () => { }, 0, 1);
let functionSpecOUT = new LogicGateFunctionSpec("OUT", () => { }, 1, 0);

class World {
  constructor(eventManager) {
    this.eventManager = eventManager == undefined ? new EventManager() : eventManager;

    // World components
    this.terminals = [];
    this.wires = [];
    this.gates = [];

    // World I/O
    this.inputs = [];
    this.outputs = [];

    // World state
    this.previousState = "";
    this.stableCount = 0;
    this.instableCount = 0;
    this.tickCount = 0;
  }

  setDomElement(domElement) {
    this.domElement = domElement;
  }

  checkFinished() {
    let stateTemp = "";
    this.terminals.forEach(t => {
      stateTemp += t.state ? "1" : "0";
    });
    if (stateTemp === this.previousState) {
      this.stableCount++;
      this.instableCount = 0;
    } else {
      this.stableCount = 0;
      this.instableCount++;
      this.previousState = stateTemp;
    }

    if (this.stableCount === 3) {
      this.eventManager.publish("WORLD_STABLE", this);
    }
    if (this.instableCount === 1) {
      this.eventManager.publish("WORLD_INSTABLE", this);
    }
  }

  isStable() {
    return this.stableCount > 3;
  }

  tick() {
    this.gates.forEach(g => g.update());
    this.wires.forEach(w => w.update());
    this.checkFinished();
    this.tickCount++;
  }

  makeConnection(terminal) {
    console.log("Making connection", terminal);
    if (!this.previousTerminal) {
      this.previousTerminal = terminal;
    } else {
      let existingWires = this.getWiresBetween(this.previousTerminal, terminal);
      if(existingWires.length > 0) {
        existingWires.forEach(w => w.remove());
      }else{
        new Wire(this, this.previousTerminal, terminal);
      }
      this.previousTerminal = null;
    }
  }

  clearSelction() {
    this.previousTerminal = null;
  }

  createLogicGate(funcSpec) {
    let gate = new Gate(this, funcSpec);
    return gate;
  }

  addInputGate(gate) {
    this.inputs.push(gate);
  }

  removeInputGate(gate) {
    this.inputs = this.inputs.filter(g => g !== gate);
  }
  
  addOutputGate(gate) {
    this.outputs.push(gate);
  }

  removeOutputGate(gate) {
    this.outputs = this.outputs.filter(g => g !== gate);
  }

  getWiresByTerminal(terminal) {
    return this.wires.filter(w => w.terminalSrc === terminal || w.terminalSink === terminal);
  }

  getWiresBetween(terminal1, terminal2) {
    return this.wires.filter(w => (w.terminalSrc === terminal1 && w.terminalSink === terminal2) || (w.terminalSrc === terminal2 && w.terminalSink === terminal1));
  }
}

console.log("logicgate_back.js loaded");