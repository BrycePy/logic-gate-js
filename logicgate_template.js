logicGateDefaultTemplate = `
<div id="logic-gate-templates" class="">
  <h3>Logic Gates Preview</h3>
  <div class="logic-gate-div-relative logic-and-template">
    <span class="logic-gate-label">AND</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
      <div class="logic-gate-terminal"></div>
    </div>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-or-template">
    <span class="logic-gate-label">OR</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
      <div class="logic-gate-terminal"></div>
    </div>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-not-template">
    <span class="logic-gate-label">NOT</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-xor-template">
    <span class="logic-gate-label">XOR</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
      <div class="logic-gate-terminal"></div>
    </div>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-in-template">
    <span class="logic-gate-label">IN</span>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-out-template">
    <span class="logic-gate-label">OUT</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
      <div class="logic-gate-terminal"></div>
    </div>
  </div>

  <div class="logic-gate-div-relative logic-world-template">
    <span class="logic-gate-label">USER</span>
    <div class="logic-gate-input-terminal logic-gate-terminal-container">
    </div>
    <div class="logic-gate-output-terminal logic-gate-terminal-container">
    </div>
  </div>
</div>
`;


let tt = "whatever";

const ttWrapperFunc = () => {
  return tt
}

const exampleFunc = () => {
  tt = ""
  for(let i=0; i<100; i++) {
    tt += `i = ${i}`
  }

  return tt
}

const apptt = (a, b, tt) => {
  console.log("I got a: ", a)
  console.log("I got b: ", b)
  console.log("I got tt: ", tt)
}

const appfunc = (a, b, func) => {
  console.log("I got a: ", a)
  console.log("I got b: ", b)
  console.log("I got tt: ", func())
}

// apptt(1, 2, tt)
appfunc(1, 2, exampleFunc)