#!/usr/bin/env node

// Turbotape
// Insanely fast serial port file uploader for NodeMCU / ESP8266
// August Flatby augustzf@gmail.com

'use strict';

require('colors');
const SerialPort = require('serialport');
const fs = require('fs');
const path = require('path');
const sha1 = require('sha1');
const argv = require('yargs')
  .usage('Usage: $0 [-p serial port] [-run] filename')
  .boolean('run')
  .demand(1)
  .alias('p', 'port')
  .argv;
 
class SHAError extends Error {}
class SendError extends Error {}
class TurbotapeNotInstalledError extends Error {}

const uploadFile = (port, msDelay, name, runChunk) => {
    const data = fs.readFileSync(name, 'utf8');
    const basename = path.basename(name);

    return new Promise((resolve, reject) => {
        return sendCmd(port, 0, 'turbotape("' + basename + '", ' + data.length + ')', 'READY')
            .then(() => {
                console.log('Got READY');
                // turbotape function installed on chip: we're ready
                process.stdout.write((basename + ': ').yellow);
                return sendData(port, msDelay, data);
            })
            .catch(() => {
                reject(TurbotapeNotInstalledError());
            })
            .then(() => {
                process.stdout.write('\nVerifying SHA: '.yellow);
                return verifySHA(port, data);
            })
            .then(() => {
                console.log('OK'.green);
                if (runChunk) {
                    console.log(('Running ' + basename).yellow);
                    return sendCmd(port, 0, 'dofile("' + basename + '")');
                }
            })
            .then(() => {                
                resolve();
            })
            .catch((err) => {
                console.log('catch ' + err);
                reject(err);
            });
    });
};

const sendData = (port, msDelay, data) => {
    console.log('sendData');
    const CHUNK_SIZE = 40;
    // Send the data in chunks
    // const fileLines = chunk.split('\n')
    const remainder = data.length % CHUNK_SIZE;
    if (remainder !== 0) {
        data = data + 'X'.repeat(remainder);
        console.log('Padded: ' + remainder);
    }
    else {
        console.log('No padding needed. ' + data.length + ' bytes');
    }
    const chunks = data.match(/[\s\S]{1,40}/g); // CHUNK_SIZE doesn't work here
    var prev = Promise.resolve();
    const promises = chunks.map(chunk => {
        prev = prev.then(() => {
            // send the chunk, wait for no response
            process.stdout.write('#'.green);            
            return new Promise((resolve, reject) => {
                port.write(chunk, (err) => {
                    port.drain(() => {
                        if (err) {
                            console.log(('TX error: ' + err).red);
                            console.log('TX err name: ' + err.name);
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });      
            });
        });
        return prev;
    });
    return Promise.all(promises);
};

// Verify by comparing SHA1 hashes.
const verifySHA = (port, chunk) => {    
    const expectedResponse = '> ' + sha1(chunk + '\n');
    const shaCmd = sendCmd(port, 0, 'EOF', expectedResponse);
    shaCmd.catch(() => {
        return SHAError();
    });
    return shaCmd;
};

const sendCmd = (port, msDelay, cmd, expectedResponse) => {    
    console.log('sendCmd: ' + cmd + ' expect ' + expectedResponse);
    return new Promise((resolve, reject) => {
        var rxTimeout;

        // incoming data handler
        const rx = (data) => {
            clearTimeout(rxTimeout);

            if (data.substring(0, cmd.length) === cmd) {
                // ignore echoed line, just set up listener again
                port.once('data', rx);
                return;
            }
            if (data.substring(0, expectedResponse.length) === expectedResponse) {
                // expected response received
                resolve();
            }
            else {
                // unexpected data received
                process.stderr.write('Expected: ');
                process.stderr.write(expectedResponse.green);
                process.stderr.write(' got ');
                process.stderr.write(data.red + '\n');
                reject(SendError);
            }
        };

        // set up listener for one single line of response
        if (expectedResponse) {
            rxTimeout = setTimeout(() => {
                reject('Timeout while waiting for response');
            }, 5000);

            port.once('data', rx);
        }

        port.write(cmd + '\n', (err) => {
            port.drain(() => {
                if (err) {
                    console.log(('TX error: ' + err).red);
                    console.log('TX err name: ' + err.name);
                    reject(err);
                    return;
                }

                if (!expectedResponse) {
                    // The msDelay should be increased progressively for each retry
                    setTimeout(() => {
                        resolve();
                    }, msDelay);
                }
            });
        });
    });
};

const findPort = callback => {
    if (argv.port) {
        return callback(argv.port);
    }

    SerialPort.list((err, ports) => {
        var found = false;
        ports.forEach((port) => {
            if (/USB/.test(port.comName)) {
                // Assume this is the port we're looking for
                console.log('Will use ' + port.comName);
                found = true;
                callback(port.comName);
            }
        });
        if (!found) {
            console.error('No suitable port found. Use the -p option to specify a port.');
        }
    });
};

// assumes that turbotape() function is defined on ESP8266
const main = () => {
    findPort((comName) => {
        const port = new SerialPort(comName, {
            baudrate: 115200,
            parser: SerialPort.parsers.readline('\n'),
        });

        port.on('error', (err) => {
            console.error(err.toString().red);
        });

        port.on('open', () => {
            // Start out with 4ms delay per line
            tryUpload(port, 4, argv._[0], argv.run);
        });
    });
};

const tryUpload = (port, delayMs, filename, run) => {
    console.log('tryUpload ' + delayMs + ' ' + filename);
    uploadFile(port, delayMs, filename, run)
    .then(() => {
        console.log('Done!'.green);
        port.close();
    })
    .catch(err => {
        if (err instanceof SendError) {
            delayMs = delayMs * 2;
            console.log('Trying again with delay ' + delayMs + 'ms');
            return tryUpload(port, delayMs, filename, run);
        }
        else if (err instanceof SHAError) {
            console.log('SHA error!');
        }
        else if (err instanceof TurbotapeNotInstalledError) {
            // turbotape not installed on chip! Upload it first, the slow way
            console.log('Turbotape not installed on chip! Please upload and run \'turbotape.lua\' using your other tools first.');
            process.exit(1);
        }
        port.close();
    });  
};

main();
