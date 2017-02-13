/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var assert = require('assert');
var extend = require('extend');
var proxyquire = require('proxyquire');

describe('logging-bunyan', function() {
  var fakeLogInstance = {};
  var fakeLoggingOptions_;
  var fakeLogName_;

  function fakeLogging(options) {
    fakeLoggingOptions_ = options;
    return {
      log: function(logName) {
        fakeLogName_ = logName;
        return fakeLogInstance;
      }
    };
  }

  var LoggingBunyanCached;
  var LoggingBunyan;
  var loggingBunyan;

  var OPTIONS = {
    logName: 'log-name',
    resource: {}
  };

  before(function() {
    LoggingBunyan = proxyquire('../src/index.js', {
      '@google-cloud/logging': fakeLogging
    });

    LoggingBunyanCached = extend(true, {}, LoggingBunyan);
  });

  beforeEach(function() {
    fakeLogInstance = {};
    fakeLoggingOptions_ = null;
    fakeLogName_ = null;

    extend(true, LoggingBunyan, LoggingBunyanCached);
    loggingBunyan = new LoggingBunyan(OPTIONS);
  });

  describe('instantiation', function() {
    it('should create a new instance of LoggingBunyan', function() {
      // jshint newcap:false
      var loggingBunyan = LoggingBunyan(OPTIONS);
      assert(loggingBunyan instanceof LoggingBunyan);
    });

    it('should localize the provided resource', function() {
      assert.strictEqual(loggingBunyan.resource_, OPTIONS.resource);
    });

    it('should localize Log instance using provided name', function() {
      assert.strictEqual(fakeLoggingOptions_, OPTIONS);
      assert.strictEqual(fakeLogName_, OPTIONS.logName);
    });

    it('should localize Log instance using default name', function() {
      var optionsWithoutLogName = extend({}, OPTIONS);
      delete optionsWithoutLogName.logName;

      new LoggingBunyan(optionsWithoutLogName);

      assert.strictEqual(fakeLoggingOptions_, optionsWithoutLogName);
      assert.strictEqual(fakeLogName_, 'bunyan_log');
    });
  });

  describe('stream', function() {
    it('should return a properly formatted object', function() {
      var level = 'info';
      var stream = loggingBunyan.stream(level);

      assert.strictEqual(stream.level, level);
      assert.strictEqual(stream.type, 'raw');
      assert.strictEqual(stream.stream, loggingBunyan);
    });
  });

  describe('write', function() {
    var STACKDRIVER_LEVEL = 'info';

    var RECORD = {
      level: 30,
      time: '2012-06-19T21:34:19.906Z'
    };

    beforeEach(function() {
      fakeLogInstance.entry = function() {};
      loggingBunyan.log_[STACKDRIVER_LEVEL] = function() {};
    });

    it('should throw an error if record is a string', function() {
      assert.throws(function() {
        loggingBunyan.write('string record');
      }, new RegExp(
        '@google-cloud/logging-bunyan only works as a raw bunyan stream type.'
      ));
    });

    it('should properly create an entry', function(done) {
      loggingBunyan.log_.entry = function(entryMetadata, message) {
        assert.deepEqual(entryMetadata, {
          resource: loggingBunyan.resource_,
          timestamp: RECORD.time
        });
        assert.strictEqual(message, RECORD);
        done();
      };

      loggingBunyan.write(RECORD);
    });

    it('should write to the correct log', function(done) {
      var customLevel = 'custom-level';
      var entry = {};

      loggingBunyan.log_.entry = function() {
        return entry;
      };

      LoggingBunyan.BUNYAN_TO_STACKDRIVER[RECORD.level] = customLevel;

      loggingBunyan.log_[customLevel] = function(entry_) {
        assert.strictEqual(entry_, entry);
        done();
      };

      loggingBunyan.write(RECORD);
    });
  });

  describe('BUNYAN_TO_STACKDRIVER', function() {
    it('should correctly map to Stackdriver Logging levels', function() {
      assert.deepEqual(LoggingBunyan.BUNYAN_TO_STACKDRIVER, {
        60: 'critical',
        50: 'error',
        40: 'warning',
        30: 'info',
        20: 'debug',
        10: 'debug'
      });
    });
  });
});