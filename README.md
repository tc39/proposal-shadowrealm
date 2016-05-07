# ECMAScript spec proposal for Realms API

## Status

### Current Stage

 * __Stage 0__

### Champions

 * @dherman
 * @caridy

### Spec Text

You can view the spec rendered as [HTML](https://rawgit.com/caridy/proposal-realms/master/index.html).

## Background

 * [What are Realms?](https://gist.github.com/dherman/7568885)
 * [JS dialects with ES6 Realms](https://gist.github.com/dherman/9146568)

## Contributing

### Updating the spec text for this proposal

The source for the spec text is located in [spec/index.emu](spec/index.emu) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML version in
`index.html` by using the following command:

```bash
npm install
npm run build
open index.html
```

Alternative, you can use `npm run watch`.
