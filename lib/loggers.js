'use strict';
const debug = require('debug')('metrics');

const {Aggregator} = require('./aggregators');
const {DataDogReporter} = require('./reporters');
const {Gauge} = require('./metrics');
const {Counter} = require('./metrics');
const {Histogram} = require('./metrics');

//
// --- BufferedMetricsLogger
//
// This talks to the DataDog HTTP API to log a bunch of metrics.
//
// Because we don't want to fire off an HTTP request for each data point
// this buffers all metrics in the given time slice and periodically
// flushes them to DataDog.
//
// Look here if you want to learn more about the DataDog API:
// >> http://docs.datadoghq.com/guides/metrics/ <<
//
//
// `opts` may include:
//
//     - api_key: DataDog API key
//     - app_key: DataDog APP key
//     - proxy_agent: a https agent
//     - host: Default host for all reported metrics
//     - prefix: Default key prefix for all metrics
//     - flushIntervalSeconds:
//
// You can also use it to override (dependency-inject) the aggregator
// and reporter instance, which is useful for testing:
//
//     - aggregator: an Aggregator instance
//     - reporter: a Reporter instance
//
class BufferedMetricsLogger {
  constructor(opts) {
    const {
      aggregator,
      reporter,
      defaultTags,
      host,
      prefix,
      flushIntervalSeconds,
      ...datadogOpts
    } = opts;
    this.aggregator = aggregator || new Aggregator(defaultTags);
    this.reporter = reporter || new DataDogReporter(datadogOpts);
    this.host = host;
    this.prefix = prefix || '';
    this.flushIntervalSeconds = flushIntervalSeconds;

    if (this.flushIntervalSeconds) {
      debug('Auto-flushing every %d seconds', this.flushIntervalSeconds);
    } else {
      debug('Auto-flushing is disabled');
    }

    var self = this;
    var autoFlushCallback = function() {
      self.flush();
      if (self.flushIntervalSeconds) {
        var interval = self.flushIntervalSeconds * 1000;
        var tid = setTimeout(autoFlushCallback, interval);
        // Let the event loop exit if this is the only active timer.
        tid.unref();
      }
    };

    autoFlushCallback();
  }
  // Prepend the global key prefix and set the default host.
  addPoint(Type, key, value, tags, timestampInMillis) {
    this.aggregator.addPoint(
      Type,
      this.prefix + key,
      value,
      tags,
      this.host,
      timestampInMillis
    );
  }
  gauge(key, value, tags, timestampInMillis) {
    this.addPoint(Gauge, key, value, tags, timestampInMillis);
  }
  increment(key, value, tags, timestampInMillis) {
    if (value === undefined || value === null) {
      this.addPoint(Counter, key, 1, tags, timestampInMillis);
    } else {
      this.addPoint(Counter, key, value, tags, timestampInMillis);
    }
  }
  histogram(key, value, tags, timestampInMillis) {
    this.addPoint(Histogram, key, value, tags, timestampInMillis);
  }
  flush(onSuccess, onError) {
    var series = this.aggregator.flush();
    if (series.length > 0) {
      debug('Flushing %d metrics to DataDog', series.length);
      this.reporter.report(series, onSuccess, onError);
    } else {
      debug('Nothing to flush');
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    }
  }
}

module.exports = {
  BufferedMetricsLogger: BufferedMetricsLogger
};
