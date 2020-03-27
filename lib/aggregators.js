'use strict';

//
// --- Aggregator
//
class Aggregator {
  constructor(defaultTags) {
    this.buffer = {};
    this.defaultTags = defaultTags || [];
  }
  makeBufferKey(key, tags) {
    tags = tags || [''];
    return (
      key +
      '#' +
      tags
        .concat()
        .sort()
        .join('.')
    );
  }
  addPoint(Type, key, value, tags, host, timestampInMillis) {
    var bufferKey = this.makeBufferKey(key, tags);
    if (!this.buffer[bufferKey]) {
      this.buffer[bufferKey] = new Type(key, tags, host);
    }

    this.buffer[bufferKey].addPoint(value, timestampInMillis);
  }
  flush() {
    var series = [];
    for (var key in this.buffer) {
      if (this.buffer[key]) {
        series = series.concat(this.buffer[key].flush());
      }
    }

    // Concat default tags
    if (this.defaultTags) {
      for (var i = 0; i < series.length; i++) {
        series[i].tags = this.defaultTags.concat(series[i].tags);
      }
    }

    this.buffer = {};

    return series;
  }
}

module.exports = {
  Aggregator
};
