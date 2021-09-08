# Notes from various F2F discussions

## Oct 18th (SES Strategy Meeting):

Notes about why we need realms:

* ShadowRealms allow virtualization of the language itself.
* Same origin is seen as legacy from some implementers, but same origin iframes is available anyways.
  * It is also available in node via `vm` module.
* Same origin is an atomic part of the web reality.
* Various examples of why ShadowRealms are needed:
  * Web-based IDEs or any kind of 3rd party code execution uses same origin evaluation.
  * Fiddler & Co.
  * JSPerf & Co.
  * Test frameworks (in-browser tests, but also in node using `vm`).
  * Most plugin mechanism for the web.
  * Sandboxing (e.g.: Oasis Project)
  * Server side rendering (to avoid collition and data leakage)
