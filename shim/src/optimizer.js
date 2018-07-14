import {
  arrayFilter,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  objectHasOwnProperty,
  regexpTest
} from './commons';

// todo: think about how this interacts with endowments, check for conflicts
// between the names being optimized and the ones added by endowments

// Admits many (but not all) legal variable names: starts with letter/_/$,
// continues with letter/digit/_/$. It will reject many legal names that
// involve unicode characters. \w is equivalent [a-zA-Z_0-9]
const identifierPattern = /^[a-zA-Z_$][\w$]*$/;

const keywords = new Set([
  // actual keywords
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',

  // future reserved word
  'enum',

  // future reserved word in strict mode
  'implements',
  'package',
  'protected',
  'interface',
  'private',
  'public',

  // contextual worth refusing
  'let',
  'async',
  'arguments'
]);

/**
 * getOptimizableGlobals()
 * What variable names might it bring into scope? These include all
 * property names which can be variable names, including the names
 * of inherited properties. It excludes symbols and names which are
 * keywords. We drop symbols safely. Currently, this shim refuses
 * service if any of the names are keywords or keyword-like. This is
 * safe and only prevent performance optimization.
 */
export function getOptimizableGlobals(safeGlobal) {
  const descs = getOwnPropertyDescriptors(safeGlobal);

  // getOwnPropertyNames does ignore Symbols so we don't need this extra check:
  // typeof name === 'string' &&
  const constants = arrayFilter(getOwnPropertyNames(descs), name => {
    // Ensure we have a valid identifier. We use regexpTest rather than
    // /../.test() to guard against the case where RegExp has been poisoned.
    if (name === 'eval' || keywords.has(name) || !regexpTest(identifierPattern, name)) {
      return false;
    }

    const desc = descs[name];
    return (
      //
      // The getters will not have .writable, don't let the falsyness of
      // 'undefined' trick us: test with === false, not ! . However descriptors
      // inherit from the (potentially poisoned) global object, so we might see
      // extra properties which weren't really there. Accessor properties have
      // 'get/set/enumerable/configurable', while data properties have
      // 'value/writable/enumerable/configurable'.
      desc.configurable === false &&
      desc.writable === false &&
      //
      // Checks for accessor properties: we don't want to optimize these,
      // they're obviously non-constant. Value properties can't have
      // accessors at the same time, so this check is sufficient. Using
      // explicit own property deal with the case where
      // Object.prototype has been poisoned.
      objectHasOwnProperty(desc, 'value')
    );
  });

  return constants;
}
