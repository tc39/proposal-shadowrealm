# Realm Shim

This folder contains a shim implementation of the Realm API specified in this repo.

## Limitations

The current implementation has 3 main limitations:

* All code evaluated inside a Realm runs in strict mode.
* Direct eval is not supported.
* `let`, global function declarations and any other feature that relies on new bindings in global contour are not preserved between difference invocations of eval, instead we create a new contour everytime.

## Building the Shim

```bash
git clone https://github.com/caridy/proposal-realms.git
cd proposal-realms
npm install
npm run build-shim-dev
open shim/examples/simple.html
```

This will install the necessary dependencies, build the shim locally, and open the playground example in your default browser.