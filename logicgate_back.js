console.log("logicgate_back.js loaded");

class State {
  static ON = true;
  static OFF = false;
}

class LogicGate {
  static AND = (a, b) => a && b;
  static OR = (a, b) => a || b;
  static NOT = a => !a;
  static XOR = (a, b) => a !== b;
  static NAND = (a, b) => !(a && b);
  static NOR = (a, b) => !(a || b);
  static XNOR = (a, b) => a === b;
  static NULL = (a, b) => undefined;
}

class Terminal {
  constructor(world, parent) {
    this.isSource = false;
    this.state = State.OFF;
    this.parent = parent;

    this.world = world;
  }
  setDomElement(domElement) {
    this.domElement = domElement;
  }
}

class Wire {
  constructor(world, terminal1, terminal2) {
    if (terminal1 === terminal2) {
      this.eventManager.publish("ERROR", "Wire cannot connect to itself");
    }
    if (terminal1.isSource && terminal2.isSource) {
      this.eventManager.publish("ERROR", "Wire cannot connect two sources");
    }
    if (terminal1.isSource) {
      this.terminalSrc = terminal1;
      this.terminalSink = terminal2;
    } else {
      this.terminalSrc = terminal2;
      this.terminalSink = terminal1;
    }
    this.state = State.OFF;

    this.world = world;
    world.wires.push(this);
  }
  setDomElement(domElement) {
    this.domElement = domElement;
  }
  update() {
    this.state = this.terminalSrc.state;
    this.terminalSink.state = this.state;
  }
}

class Gate {
  constructor(world, func) {
    this.func = func;
    this.in1 = new Terminal(world, null, this);
    this.in2 = new Terminal(world, null, this);
    this.out = new Terminal(world, null, this);
    this.out.is_source = true;

    this.world = world;
    world.gates.push(this);
  }
  setDomElement(domElement) {
    this.domElement = domElement;
  }

  update() {
    
    this.out.state = this.func(this.in1.state, this.in2.state);
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

class World {
  constructor(eventManager) {
    this.eventManager = eventManager ? eventManager : new EventManager();

    // World components
    this.wires = [];
    this.gates = [];

    // World I/O
    this.inputs = [];
    this.outputs = [];

    // World state
    this.previousState = "";
    this.stableCount = 0;
    this.instableCount = 0;
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
  }

  makeConnection(terminal) {
    if (!this.previousTerminal) {
      this.previousTerminal = terminal;
    } else {
      new Wire(this, this.previousTerminal, terminal);
      this.previousTerminal = null;
    }
  }
}