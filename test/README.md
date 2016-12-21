These tests are written in the style of [test262].

[test262]: https://github.com/tc39/test262

## Packaging for use with Test262 Web Runner

The [web runner][1] expects a zip file shaped like test262.
I cobbled one together that seems to work as follows; note the
addition of `realm-shim.js` to the harness:

    ~/projects$ git clone https://github.com/tc39/test262.git
    ~/projects$ cd proposal-realms
    ~/projects/proposal-realms$ ln -s ~/projects/test262/harness
    ~/projects/proposal-realms$ cp shim/dist/realm-shim.js harness/
    ~/projects/proposal-realms$ zip -r /tmp/realmTests.zip test/ harness/
    
[1] https://bakkot.github.io/test262-web-runner/

