'use strict';
//
// --- Metric (base class)
//
class Metric {
  constructor(key, tags, host) {
    this.key = key;
    this.tags = tags || [];
    this.host = host || '';
  }
  addPoint() {
    return null;
  }
  flush() {
    return null;
  }
  posixTimestamp(timestampInMillis) {
    // theoretically, 0 is a valid timestamp, albeit unlikely
    var timestamp =
      timestampInMillis === undefined ? Date.now() : timestampInMillis;
    return Math.round(timestamp / 1000);
  }
  updateTimestamp(timestampInMillis) {
    this.timestamp = this.posixTimestamp(timestampInMillis);
  }
  serializeMetric(value, type, key) {
    return {
      metric: key || this.key,
      points: [[this.timestamp, value]],
      type: type,
      host: this.host,
      tags: this.tags
    };
  }
}

//
// --- Gauge
//
//
// GAUGE
// -----
// Record the current *value* of a metric. They most recent value in
// a given flush interval will be recorded. Optionally, specify a set of
// tags to associate with the metric. This should be used for sum values
// such as total hard disk space, process uptime, total number of active
// users, or number of rows in a database table.
//
class Gauge extends Metric {
  constructor(key, tags, host) {
    super(key, tags, host);
    this.value = 0;
  }
  addPoint(val, timestampInMillis) {
    this.value = val;
    this.updateTimestamp(timestampInMillis);
  }
  flush() {
    return [this.serializeMetric(this.value, 'gauge')];
  }
}

//
// --- Counter
//
//
// COUNTER
// -------
// Increment the counter by the given *value*. Optionally, specify a list of
// *tags* to associate with the metric. This is useful for counting things
// such as incrementing a counter each time a page is requested.
//
class Counter extends Metric {
  constructor(key, tags, host) {
    super(key, tags, host);
    this.value = 0;
  }
  addPoint(val, timestampInMillis) {
    this.value += val;
    this.updateTimestamp(timestampInMillis);
  }
  flush() {
    return [this.serializeMetric(this.value, 'count')];
  }
}

//
// --- Histogram
//
//
// HISTOGRAM
// ---------
// Sample a histogram value. Histograms will produce metrics that
// describe the distribution of the recorded values, namely the minimum,
// maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
// Optionally, specify a list of *tags* to associate with the metric.
//
class Histogram extends Metric {
  constructor(key, tags, host) {
    super(key, tags, host);
    this.min = Infinity;
    this.max = -Infinity;
    this.sum = 0;
    this.count = 0;
    this.samples = [];
    this.percentiles = [0.75, 0.85, 0.95, 0.99];
  }
  addPoint(val, timestampInMillis) {
    this.updateTimestamp(timestampInMillis);

    this.min = Math.min(val, this.min);
    this.max = Math.max(val, this.max);
    this.sum += val;
    this.count += 1;

    // The number of samples recorded is unbounded at the moment.
    // If this becomes a problem we might want to limit how many
    // samples we keep.
    this.samples.push(val);
  }
  flush() {
    const points = [
      this.serializeMetric(this.min, 'gauge', this.key + '.min'),
      this.serializeMetric(this.max, 'gauge', this.key + '.max'),
      this.serializeMetric(this.sum, 'gauge', this.key + '.sum'),
      this.serializeMetric(this.count, 'count', this.key + '.count'),
      this.serializeMetric(this.average(), 'gauge', this.key + '.avg')
    ];

    // Careful, calling samples.sort() will sort alphabetically giving
    // the wrong result. We must define our own compare function.
    const numericalSortAscending = (a, b) => a - b;
    this.samples.sort(numericalSortAscending);

    const calcPercentile = p => {
      const val = this.samples[Math.round(p * this.samples.length) - 1];
      const suffix = '.' + Math.floor(p * 100) + 'percentile';
      return this.serializeMetric(val, 'gauge', this.key + suffix);
    };

    const percentiles = this.percentiles.map(calcPercentile);
    return points.concat(percentiles);
  }
  average() {
    if (this.count === 0) {
      return 0;
    } else {
      return this.sum / this.count;
    }
  }
}

module.exports = {
  Metric: Metric,
  Gauge: Gauge,
  Counter: Counter,
  Histogram: Histogram
};
