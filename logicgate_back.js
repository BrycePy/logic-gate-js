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
  unsubscribe(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }
  once(event, callback, condition) {
    let temp = data => {
      if (condition && !condition(data)) return;
      callback(data);
      this.unsubscribe(event, temp);
    };
    this.subscribe(event, temp);
  }
  async wait(event, condition) {
    return new Promise((resolve, reject) => {
      this.once(event, resolve, condition);
    });
  }
}

class State {
  static ON = true;
  static OFF = false;
}

class Terminal {
  constructor(world, parent, isSource) {
    this.isSource = isSource;
    this.state = State.OFF;
    this.parent = parent;
    this.index = -1;
    this.relatedTerminals = [];

    this.world = world;
    world.terminals.push(this);
    this.world.eventManager.publish("TERMINAL_CREATED", this);
  }

  setDomElement(domElement) {
    this.domElement = domElement;
    this.world.eventManager.publish("TERMINAL_DOM_SET", this);
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.world.eventManager.publish("TERMINAL_STATE_CHANGED", this);
    }
  }

  toggle(){
    this.setState(!this.state);
  }

  remove() {
    this.parent = null;
    this.relatedTerminals = null;
    if (this.domElement) {
      this.domElement.remove();
      this.domElement = null;
    }
    this.world.terminals = this.world.terminals.filter(t => t !== this);
    this.world.eventManager.publish("TERMINAL_REMOVED", this);
    this.world = null;
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

    this.terminalSrc.relatedTerminals.push(this.terminalSink);
    this.terminalSink.relatedTerminals.push(this.terminalSrc);

    this.world.eventManager.publish("WIRE_CREATED", this);
  }
  setDomElement(domElement) {
    this.domElement = domElement;
    this.world.eventManager.publish("WIRE_DOM_SET", this);
  }
  update() {
    if (this.state !== this.terminalSrc.state) {
      this.world.eventManager.publish("WIRE_STATE_CHANGED", this);
      this.state = this.terminalSrc.state;
    }
    this.terminalSink.setState(this.state);
  }
  remove() {
    this.terminalSrc.relatedTerminals = this.terminalSrc.relatedTerminals.filter(t => t !== this.terminalSink);
    this.terminalSink.relatedTerminals = this.terminalSink.relatedTerminals.filter(t => t !== this.terminalSrc);
    this.terminalSink.setState(State.OFF);
    this.world.wires = this.world.wires.filter(w => w !== this);
    this.world.eventManager.publish("WIRE_REMOVED", this);
    this.world = null;
    this.terminalSrc = null;
    this.terminalSink = null;
    if (this.domElement) {
      this.domElement.remove();
      this.domElement = null;
    }
    delete this;
  }
  getState() {
    return this.state ? State.ON : State.OFF;
  }
  setState(state) {
    if (state !== this.state) {
      this.state = state;
      this.world.eventManager.publish("WIRE_STATE_CHANGED", this);
    }
  }
}

class Gate {
  constructor(world, funcSpec) {
    this.world = world;
    world.gates.push(this);

    this.funcSpec = funcSpec;
    this.inputTerminals = [];
    this.outputTerminals = [];

    for (let i = 0; i < funcSpec.inputCount; i++) {
      this.inputTerminals.push(new Terminal(world, this, false));
    }

    for (let i = 0; i < funcSpec.outputCount; i++) {
      this.outputTerminals.push(new Terminal(world, this, true));
    }

    this.terminals().forEach((t, i) => {
      t.index = i;
    });

    this.world.eventManager.publish("GATE_CREATED", this);
  }
  setDomElement(domElement) {
    this.domElement = domElement;
    this.world.eventManager.publish("GATE_DOM_SET", this);
  }

  update() {
    if (this.inputTerminals.length === 0) return;
    if (this.outputTerminals.length === 0) return;
    let inputs = this.inputTerminals.map(t => t.state);
    let outputs = this.funcSpec.func(...inputs);
    if (outputs === undefined) return;
    if (outputs instanceof Array) {
      outputs.forEach((output, i) => {
        this.outputTerminals[i].setState(output);
      });
    } else {
      this.outputTerminals[0].setState(outputs);
    }
  }

  terminals() {
    return this.inputTerminals.concat(this.outputTerminals);
  }

  getTerminalIndex(terminal) {
    return this.terminals().indexOf(terminal);
  }

  setTerminalStateByIndex(index, state) {
    this.terminals()[index].state = state;
  }

  getState() {
    return this.terminals().map(t => t.state ? State.ON : State.OFF);
  }

  setState(states) {
    states.forEach((state, i) => {
      this.terminals()[i].state = state ? State.ON : State.OFF;
    });
  }

  getTerminalStateByIndex(index) {
    return this.terminals()[index].state;
  }

  unlinkAll() {
    this.terminals().forEach(t => {
      this.world.getWiresByTerminal(t).forEach(w => w.remove());
    })
  }

  remove() {
    this.unlinkAll();
    this.world.inputs = this.world.inputs.filter(g => g !== this);
    this.world.outputs = this.world.outputs.filter(g => g !== this);
    this.world.gates = this.world.gates.filter(g => g !== this);
    this.world.eventManager.publish("GATE_REMOVED", this);
    this.world = null;
    this.inputTerminals.forEach(t => t.remove());
    this.outputTerminals.forEach(t => t.remove());
    if (this.domElement) {
      this.domElement.remove();
      this.domElement = null;
    }
    delete this;
  }

  isFundamental() {
    return FundamentalGate.isSpecFundamental(this.funcSpec);
  }

  in(i) {
    return this.inputTerminals[i];
  }

  out(i) {
    return this.outputTerminals[i];
  }
}

class LogicGateFunctionSpec {
  constructor(name, func, inputCount, outputCount) {
    this.name = name;
    this.func = func;
    this.inputCount = inputCount;
    this.outputCount = outputCount;
  }
}

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

    this.eventManager.publish("WORLD_CREATED", this);
  }

  setDomElement(domElement) {
    this.domElement = domElement;
    this.eventManager.publish("WORLD_DOM_SET", this);
  }

  setParent(parent) {
    this.parent = parent;
    this.eventManager.publish("WORLD_PARENT_SET", this);
  }

  setInputsState(inputs) {
    inputs = inputs.map(i => i ? State.ON : State.OFF);
    this.inputs.forEach((gate, i) => {
      gate.out(0).state = inputs[i];
    });
  }

  async evaluate(inputs) {
    this.setInputsState(inputs);
    await this.waitStable();
    let results = this.outputs.map(g => g.in(0).state)
    this.eventManager.publish("WORLD_RESULT", { inputs: inputs, results: results });
    return results;
  }

  notifyInstability() {
    this.instableCount++;
    this.stableCount = 0;
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

  async waitStable() {
    this.notifyInstability();
    return new Promise((resolve, reject) => {
      this.eventManager.subscribe("WORLD_STABLE", () => {
        resolve();
      });
    });
  }

  enableAutoSleep() { // this should be called at the root world
    this.autoSleep = true;
    this.sleepSince = Date.now();
  }

  tick() {
    if (this.autoSleep) {
      let now = Date.now();
      let dt = now - this.sleepSince;
      let stable = this.stableCount > 10;
      if (stable) {
        if (dt < 100) return;
        this.sleepSince = now;
      }
    }

    this.gates.forEach(g => g.update());
    this.wires.forEach(w => w.update());
    this.checkFinished();
    this.tickCount++;
    this.eventManager.publish("WORLD_TICK", this);
  }

  makeConnection(terminal) {
    let result = false;
    if (!this.previousTerminal) {
      this.previousTerminal = terminal;
      this.eventManager.publish("WORLD_TERMINAL_SELECTED", {
        from: this.previousTerminal,
        world: this
      });
    } else {
      let existingWires = this.getWiresBetween(this.previousTerminal, terminal);
      if (existingWires.length > 0) {
        existingWires.forEach(w => w.remove());
        this.eventManager.publish("WORLD_TERMINAL_DISCONNECTED", {
          from: this.previousTerminal,
          to: terminal,
          world: this
        });
      } else {
        let sink = terminal.isSource ? this.previousTerminal : terminal;
        let wirestoSink = this.getWiresByTerminal(sink);
        if (wirestoSink.length == 0) {
          result = new Wire(this, this.previousTerminal, terminal);
          this.eventManager.publish("WORLD_TERMINAL_CONNECTED", {
            from: this.previousTerminal,
            to: terminal,
            world: this
          });
        }
      }
      this.previousTerminal = null;
    }
    return result;
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
    this.eventManager.publish("GATE_INPUT_ADDED", gate);
  }

  removeInputGate(gate) {
    this.inputs = this.inputs.filter(g => g !== gate);
    this.eventManager.publish("GATE_INPUT_REMOVED", gate);
  }

  addOutputGate(gate) {
    this.outputs.push(gate);
    this.eventManager.publish("GATE_OUTPUT_ADDED", gate);
  }

  removeOutputGate(gate) {
    this.outputs = this.outputs.filter(g => g !== gate);
    this.eventManager.publish("GATE_OUTPUT_REMOVED", gate);
  }

  getWiresByTerminal(terminal) {
    return this.wires.filter(w => w.terminalSrc === terminal || w.terminalSink === terminal);
  }

  getWiresBetween(terminal1, terminal2) {
    return this.wires.filter(w => (w.terminalSrc === terminal1 && w.terminalSink === terminal2) || (w.terminalSrc === terminal2 && w.terminalSink === terminal1));
  }

  export() {
    return {
      inputs: this.inputs,
      outputs: this.outputs,
      gates: this.gates,
      wires: this.wires
    };
  }

  clear() {
    this.gates.forEach(g => g.remove());
    this.wires.forEach(w => w.remove());
    this.terminals.forEach(t => t.remove());
    this.inputs = [];
    this.outputs = [];
  }

  remove() {
    this.clear();
    this.eventManager = null;
    this.domElement = null;
    this.parent = null;
    delete this;
  }
}

let functionSpecAND = new LogicGateFunctionSpec("AND", (a, b) => a && b, 2, 1);
let functionSpecOR = new LogicGateFunctionSpec("OR", (a, b) => a || b, 2, 1);
let functionSpecNOT = new LogicGateFunctionSpec("NOT", (a) => !a, 1, 1);
let functionSpecNAND = new LogicGateFunctionSpec("NAND", (a, b) => !(a && b), 2, 1);
let functionSpecNOR = new LogicGateFunctionSpec("NOR", (a, b) => !(a || b), 2, 1);
let functionSpecXOR = new LogicGateFunctionSpec("XOR", (a, b) => (a || b) && !(a && b), 2, 1);
let functionSpecIN = new LogicGateFunctionSpec("IN", () => { }, 0, 1);
let functionSpecOUT = new LogicGateFunctionSpec("OUT", () => { }, 1, 0);

class FundamentalGate {
  static AND = {
    name: "AND",
    functionSpec: functionSpecAND
  };
  static OR = {
    name: "OR",
    functionSpec: functionSpecOR
  };
  static NOT = {
    name: "NOT",
    functionSpec: functionSpecNOT
  };
  static NAND = {
    name: "NAND",
    functionSpec: functionSpecNAND
  };
  static NOR = {
    name: "NOR",
    functionSpec: functionSpecNOR
  };
  static XOR = {
    name: "XOR",
    functionSpec: functionSpecXOR
  };
  static IN = {
    name: "IN",
    functionSpec: functionSpecIN
  };
  static OUT = {
    name: "OUT",
    functionSpec: functionSpecOUT
  };
  static isSpecFundamental(spec) {
    return spec === functionSpecAND || spec === functionSpecOR || spec === functionSpecNOT || spec === functionSpecNAND || spec === functionSpecNOR || spec === functionSpecXOR || spec === functionSpecIN || spec === functionSpecOUT;
  }
}

console.log("logicgate_back.js loaded");