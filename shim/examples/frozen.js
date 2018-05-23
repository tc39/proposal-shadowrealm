/* global Realm */
/* eslint no-self-compare: "off" */

// basic sanity check: they all should output true or error
const r = new Realm();
r.freeze();

console.log(1, r.evaluate(`try { [].__proto__.slice = function(){} } catch(e) { e }`));
console.log(2, r.evaluate(`typeof Array.prototype.foo === 'function';`));
console.log(3, r.evaluate(`try { Map.prototype.set = function(){} } catch(e) { e }`));

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
