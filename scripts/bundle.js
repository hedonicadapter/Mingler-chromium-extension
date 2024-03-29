(function () {
  function r(e, n, t) {
    function o(i, f) {
      if (!n[i]) {
        if (!e[i]) {
          var c = 'function' == typeof require && require;
          if (!f && c) return c(i, !0);
          if (u) return u(i, !0);
          var a = new Error("Cannot find module '" + i + "'");
          throw ((a.code = 'MODULE_NOT_FOUND'), a);
        }
        var p = (n[i] = { exports: {} });
        e[i][0].call(
          p.exports,
          function (r) {
            var n = e[i][1][r];
            return o(n || r);
          },
          p,
          p.exports,
          r,
          e,
          n,
          t
        );
      }
      return n[i].exports;
    }
    for (
      var u = 'function' == typeof require && require, i = 0;
      i < t.length;
      i++
    )
      o(t[i]);
    return o;
  }
  return r;
})()(
  {
    1: [function (require, module, exports) {}, {}],
    2: [
      function (require, module, exports) {
        'use strict';
        const net = require('net');

        class Locked extends Error {
          constructor(port) {
            super(`${port} is locked`);
          }
        }

        const lockedPorts = {
          old: new Set(),
          young: new Set(),
        };

        // On this interval, the old locked ports are discarded,
        // the young locked ports are moved to old locked ports,
        // and a new young set for locked ports are created.
        const releaseOldLockedPortsIntervalMs = 1000 * 15;

        // Lazily create interval on first use
        let interval;

        const getAvailablePort = (options) =>
          new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(options, () => {
              const { port } = server.address();
              server.close(() => {
                resolve(port);
              });
            });
          });

        const portCheckSequence = function* (ports) {
          if (ports) {
            yield* ports;
          }

          yield 0; // Fall back to 0 if anything else failed
        };

        module.exports = async (options) => {
          let ports;

          if (options) {
            ports =
              typeof options.port === 'number' ? [options.port] : options.port;
          }

          if (interval === undefined) {
            interval = setInterval(() => {
              lockedPorts.old = lockedPorts.young;
              lockedPorts.young = new Set();
            }, releaseOldLockedPortsIntervalMs);

            // Does not exist in some environments (Electron, Jest jsdom env, browser, etc).
            if (interval.unref) {
              interval.unref();
            }
          }

          for (const port of portCheckSequence(ports)) {
            try {
              let availablePort = await getAvailablePort({ ...options, port }); // eslint-disable-line no-await-in-loop
              while (
                lockedPorts.old.has(availablePort) ||
                lockedPorts.young.has(availablePort)
              ) {
                if (port !== 0) {
                  throw new Locked(port);
                }

                availablePort = await getAvailablePort({ ...options, port }); // eslint-disable-line no-await-in-loop
              }

              lockedPorts.young.add(availablePort);
              return availablePort;
            } catch (error) {
              if (
                !['EADDRINUSE', 'EACCES'].includes(error.code) &&
                !(error instanceof Locked)
              ) {
                throw error;
              }
            }
          }

          throw new Error('No available ports found');
        };

        module.exports.makeRange = (from, to) => {
          if (!Number.isInteger(from) || !Number.isInteger(to)) {
            throw new TypeError('`from` and `to` must be integer numbers');
          }

          if (from < 1024 || from > 65535) {
            throw new RangeError('`from` must be between 1024 and 65535');
          }

          if (to < 1024 || to > 65536) {
            throw new RangeError('`to` must be between 1024 and 65536');
          }

          if (to < from) {
            throw new RangeError(
              '`to` must be greater than or equal to `from`'
            );
          }

          const generator = function* (from, to) {
            for (let port = from; port <= to; port++) {
              yield port;
            }
          };

          return generator(from, to);
        };
      },
      { net: 1 },
    ],
    3: [
      function (require, module, exports) {
        const getPort = require('get-port');

        (async () => {
          let port = await getPort();
          // Will use 3000 if available, otherwise fall back to a random port
          const ws = new WebSocket.Server({ port: port });

          ws.addEventListener('open', () => {
            console.log('Mingler extension connected');

            chrome.tabs.onActivated.addListener(function (activeInfo) {
              chrome.tabs.query(
                { active: true, currentWindow: true },
                function (tabs) {
                  // since only one tab should be active and in the current window at once
                  // the return variable should only have one entry
                  var activeTab = tabs[0];
                  var activeTabTitle = activeTab.title;
                  var activeTabURL = activeTab.url;
                  ws.send(activeTabTitle + ' ' + activeTabURL);
                }
              );
            });
          });
          exports.port = port;
        })();
      },
      { 'get-port': 2 },
    ],
  },
  {},
  [3]
);
