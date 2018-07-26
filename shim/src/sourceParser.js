// this \s *must* match all kinds of syntax-defined whitespace. If e.g.
// U+2028 (LINE SEPARATOR) or U+2029 (PARAGRAPH SEPARATOR) is treated as
// whitespace by the parser, but not matched by /\s/, then this would admit
// an attack like: import\u2028('power.js') . We're trying to distinguish
// something like that from something like importnotreally('power.js') which
// is perfectly safe.

const importParser = /^(.*)\bimport\s*(\(|\/\/|\/\*)/m;

export function rejectImportExpressions(s) {
  const matches = importParser.exec(s);
  if (matches) {
    // todo: if we have a full parser available, use it here. If there is no
    // 'import' token in the string, we're safe.
    // if (!parse(s).contains('import')) return;
    const linenum = matches[1].split('\n').length; // more or less
    throw new SyntaxError(`possible import expression rejected around line ${linenum}`);
  }
}
