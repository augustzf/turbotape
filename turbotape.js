#!/usr/bin/env node

// Turbotape
// Insanely fast serial port file uploader for NodeMCU / ESP8266
// August Flatby august@biogrid.io

'use strict';

var serialport = require('serialport')
var colors = require('colors')
var fs = require('fs')
var path = require('path')
var sha1 = require('sha1')
var argv = require('yargs')
  .usage('Usage: $0 [-p serial port] [-run] filename')
  .boolean('run')
  .demand(1)
  .alias('p', 'port')
  .argv

class SHAError extends Error {}
class SendError extends Error {}

function uploadFile(port, msDelay, name, runChunk) {
  var chunk = fs.readFileSync(name, 'utf8');
  var basename = path.basename(name)

  return new Promise(function(resolve, reject) {
    return sendCmd(port, 0, 'turbotape("' + basename + '")', 'READY')
    .then(function () {
      // turbotape function installed on chip: we're ready
      process.stdout.write((basename + ': ').yellow)
      return sendChunk(port, msDelay, chunk)
    },
    function (err) {
      // turbotape not installed on chip! upload it first, the slow way

      process.stdout.write(('turbotape not installed on chip! Will upload the slow way: ').yellow)
      return slowUpload()
    })
    .then(function () {
      process.stdout.write('\nVerifying SHA: '.yellow)
      return verifySHA(port, chunk)
    })
    .then(function () {
      console.log('OK'.green)
      if (runChunk) {
        console.log(('Running ' + basename).yellow)
        return sendCmd(port, 0, 'dofile("' + basename + '")')
      }
    })
    .then(function () {
      resolve()
    })
    .catch(function(err) {
      reject(err)
    })
  })
}

function sendChunk(port, msDelay, chunk) {
  // Send the lines in the file, one by one
  var fileLines = chunk.split('\n')
  var prev = Promise.resolve()
  var lineTxPromises = fileLines.map(function (line) {
    prev = prev.then(function() {
        // promise to send the line, and wait for no response
        process.stdout.write('#'.green)
        return sendCmd(port, msDelay, line)
    })
    return prev
  })
  return Promise.all(lineTxPromises)
}

function verifySHA(port, chunk) {
  // Verify by comparing SHA1 hashes
  var expectedResponse = '> ' + sha1(chunk + '\n')
  var shaCmd = sendCmd(port, 0, 'EOF', expectedResponse)
  shaCmd.then(undefined, function () {
    reject(new SHAError())
  })
  return shaCmd
}

function sendCmd(port, msDelay, cmd, expectedResponse) {
  // console.log("sendCmd: " + cmd + ' expect ' + expectedResponse)
  return new Promise(function(resolve, reject) {
    var rxTimeout

    // incoming data handler
    var rx = function(data) {
      clearTimeout(rxTimeout)

      if (data.substring(0, cmd.length) == cmd) {
        // ignore echoed line, just set up listener again
        port.once('data', rx)
        return
      }
      if (data.substring(0, expectedResponse.length) == expectedResponse) {
        // expected response received
        resolve()
      }
      else {
        // unexpected data received
        process.stderr.write('Expected: ')
        process.stderr.write(expectedResponse.green)
        process.stderr.write(' got ')
        process.stderr.write(data.red + '\n')
        reject(new SendError)
      }
    }

    // set up listener for one single line of response
    if (expectedResponse) {
      rxTimeout = setTimeout(function() {
        reject("Timeout while waiting for response");
      }, 5000)

      port.once('data', rx)
    }

    port.write(cmd + '\n', function(err, results) {
      port.drain(function () {
        if (err) {
          console.log(('TX error: ' + err).red)
          console.log('TX err name: ' + err.name)
          reject(err)
          return
        }

        if (!expectedResponse) {
          // The msDelay should be increased progressively for each retry
          setTimeout(function() {
            resolve()
          }, msDelay)
        }

      })
    })
  })
}

function findPort(callback) {
  if (argv.port) {
    return callback(argv.port)
  }

  serialport.list(function (err, ports) {
    var found = false
    ports.forEach(function(port) {
      if (/USB/.test(port.comName)) {
        // Assume this is the port we're looking for
        console.log('Will use ' + port.comName)
        found = true
        callback(port.comName)
      }
    })
    if (!found) {
      console.error("No suitable port found. Use the -p option to specify a port.")
    }
  })
}

serialport.on('error', function (err) {
  console.error(err.toString().red)
})

// assumes that turbotape() function is defined on ESP8266
function main() {

  findPort(function(comName) {

    var port = new serialport.SerialPort(comName, {
      baudrate: 115200,
      parser: serialport.parsers.readline('\n'),
    })

    port.on('open', function () {
      // Start out with 4ms delay per line
      tryUpload(port, 4, argv._[0], argv.run)
    })
  })
}

function tryUpload(port, delayMs, filename, run) {
  uploadFile(port, delayMs, filename, run)
  .then(
    function () {
      console.log("Done!".green)
      port.close()
    },
    function (err) {
      if (err instanceof SendError) {
        delayMs = delayMs * 2
        console.log('Trying again with delay ' + delayMs + 'ms')
        return tryUpload(port, delayMs, filename, run)
      }
      else if (err instanceof SHAError) {
        console.log("SHA err man")
      }
    })
  .catch(function(error) {
    console.error(("Error: " + error) .red)
    port.close()
  })
}

main()
