'use strict';
const debug = require('debug')('metrics');
const dogapi = require('dogapi');

//
// NullReporter
//

function NullReporter() {}

NullReporter.prototype.report = function(series, onSuccess) {
  // Do nothing.
  onSuccess();
};

//
// DataDogReporter
//
class DataDogReporter {
  constructor(opts) {
    opts.api_key = opts.api_key || process.env.DATADOG_API_KEY;
    opts.app_key = opts.app_key || process.env.DATADOG_APP_KEY;

    if (!opts.api_key) {
      throw new Error('DATADOG_API_KEY environment variable not set');
    }

    dogapi.initialize(opts);
  }
  report(series, onSuccess, onError) {
    var callback = function(err, res, status) {
      if (err === null && status.toString()[0] === '2') {
        debug('add_metrics succeeded (status=%s)', status);
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      } else {
        debug(
          'ERROR: add_metrics failed: %s (err=%s, status=%s)',
          res,
          err,
          status
        );
        if (typeof onError === 'function') {
          onError(err, res, status);
        }
      }
    };

    if (debug.enabled) {
      // Only call stringify when debugging.
      debug('Calling add_metrics with %s', JSON.stringify(series));
    }

    dogapi.metric.send_all(series, callback);
  }
}

module.exports = {
  NullReporter,
  DataDogReporter
};
