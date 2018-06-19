/* global Realm */
/* eslint no-self-compare: "off" */

// basic sanity check: they all should output true
// Root realm
const r1 = new Realm();
console.log(1.1, r1.evaluate('JSON'));
console.log(1.2, r1.evaluate('JSON') !== JSON);
console.log(1.3, r1.evaluate('JSON') === r1.evaluate('JSON'));
console.log(1.4, r1.evaluate('JSON') === r1.evaluate('eval("JSON")'));
console.log(1.5, r1.evaluate('eval instanceof Function'));

// Root realm vs root realm
const r2 = new Realm();
console.log(2.1, r2.evaluate('JSON'));
console.log(2.2, r2.evaluate('JSON') !== JSON);
console.log(2.3, r2.evaluate('JSON') === r2.evaluate('JSON'));
console.log(2.4, r2.evaluate('JSON') === r2.evaluate('eval("JSON")'));
console.log(2.5, r2.evaluate('eval instanceof Function'));
console.log(2.6, r2.evaluate('JSON') !== r1.evaluate('JSON'));
console.log(2.7, r2.evaluate('eval("JSON")') !== r1.evaluate('eval("JSON")'));

// Compartment realm vs root realm
const r3 = r1.global.Realm.makeCompartment();
console.log(3.1, r3.evaluate('JSON'));
console.log(3.2, r3.evaluate('JSON') !== JSON);
console.log(3.3, r3.evaluate('JSON') === r3.evaluate('JSON'));
console.log(3.4, r3.evaluate('JSON') === r3.evaluate('eval("JSON")'));
console.log(3.5, r1.evaluate('eval instanceof Function'));
console.log(3.6, r3.evaluate('JSON') === r1.evaluate('JSON'));
console.log(3.7, r3.evaluate('eval("JSON")') === r1.evaluate('eval("JSON")'));

const r = new Realm();

document.getElementById('run').addEventListener('click', () => {
  const sourceText = document.getElementById('sourceText').value;
  let result, output;
  try {
    result = r.evaluate(sourceText);
  } catch (e) {
    result = `Error: ${e}`;
  }
  try {
    output = typeof result === 'function' ? result.toString() : JSON.stringify(result);
  } catch (e) {
    output = `Error trying to serialize the result: ${e}\nOriginal Object: ${result}`;
  }
  console.log(result);
  document.getElementById('output').value = output;
});
