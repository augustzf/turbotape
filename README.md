# Turbotape

Note: This is highly experimental, use at your own risk.

Turbotape is a single-purpose tool for super fast serial port uploading of files to ESP8266 modules with [NodeMCU](http://nodemcu.com/index_en.html) firmware.

Please note that Turbotape is a (double-edged) Viking sword not a Swiss Army knife. A complete ESP8266 toolchain should therefore also include the fine [NodeMCU Tool](https://www.npmjs.com/package/nodemcu-tool) and perhaps others, too.

## How it Works, Sort Of

Turbotape consists of a JavaScript snippet that runs on your dev machine and a LUA function that runs on the ESP8266. The LUA function is defined in the script turbotape.lua. This script needs to be uploaded and run on the chip prior to using Turbotape for uploads. Turbotape will detect if the script has not been installed (or not yet run).

The LUA turbotape() function enables fast and naive/optimistic serial transfers by completely disregarding acks and nacks and whatnot, instead relying on a SHA1 hash comparison at the end of the complete file transfer and re-trying with more line delay in case of hash mismatch. This is of course completely nuts but it works most of the time, and when it fails it will gently tell you so. 

## How To Use

Turbotape will attempt to guess which USB port to use. To override, use the -p option.

```shell
$ node turbotape.js helloworld.lua
```

## Bugs?

Please open a new issue on [GitHub](https://github.com/augustzf/turbotape/issues)

## License

[MIT License](http://opensource.org/licenses/MIT).
