# Turbotape

Turbotape is a single-purpose tool for super fast serial port uploading of files to ESP8266 modules with [NodeMCU](http://nodemcu.com/index_en.html) firmware.

```shell
$ npm install -g turbotape
```

Please note that Turbotape is a (double-edged) Viking sword not a Swiss Army knife. A complete ESP8266 toolchain should therefore also include the fine [NodeMCU Tool](https://www.npmjs.com/package/nodemcu-tool) and perhaps others, too.

## How it Works, Sort Of

Turbotape uses a LUA function, turbotape(), on your ESP8266. This function is defined in the script turbotape.lua. This script needs to be uploaded and run on the chip prior to using Turbotape for uploads. Turbotape will detect if the script has not been installed (or not yet run) and will upload it the slow and old-fashioned way first, when necesssary.

The LUA turbotape() function enables fast and naive/optimistic serial transfers by completely disregarding acks and nacks and whatnot, instead relying on SHA1 hash comparison at the end of the complete file transfer and re-trying with more line delay in case of hash mismatch. This is of course completely nuts but it works most of the time, and when it fails it will gently tell you so. It will even humbly revert to using NodeMCU Tool in case of failure.

## How To Use

Turbotape will attempt to guess which USB port to use. To override, use the -p option.

```shell
$ node turbotape.js helloworld.lua
```

## Bugs?

Please open a new issue on [GitHub](https://github.com/augustzf/turbotape/issues)

## License

[MIT License](http://opensource.org/licenses/MIT).
