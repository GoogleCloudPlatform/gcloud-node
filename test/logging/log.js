/**
 * Copyright 2015 Google Inc. All Rights Reserved.
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
var concat = require('concat-stream');
var extend = require('extend');
var mockery = require('mockery');
var nodeutil = require('util');
var through = require('through2');

var Entry = require('../../lib/logging/entry.js');
var ServiceObject = require('../../lib/common/service-object.js');
var util = require('../../lib/common/util.js');

function FakeServiceObject() {
  this.calledWith_ = arguments;
  ServiceObject.apply(this, arguments);
}

nodeutil.inherits(FakeServiceObject, ServiceObject);

describe('Log', function() {
  var Log;
  var log;

  var PROJECT_ID = 'project-id';
  var LOG_NAME = 'escaping/required/for/this/log-name';
  var LOG_NAME_ENCODED = encodeURIComponent(LOG_NAME);
  var LOG_NAME_FORMATTED = [
    'projects',
    PROJECT_ID,
    'logs',
    LOG_NAME_ENCODED
   ].join('/');

  var LOGGING = {
    projectId: PROJECT_ID,
    entry: util.noop,
    request: util.noop
  };

  var assignSeverityToEntriesOverride = null;

  before(function() {
    mockery.registerMock('../common/service-object.js', FakeServiceObject);
    mockery.registerMock('./entry.js', Entry);

    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    Log = require('../../lib/logging/log.js');
    var assignSeverityToEntries_ = Log.assignSeverityToEntries_;
    Log.assignSeverityToEntries_ = function() {
      return (assignSeverityToEntriesOverride || assignSeverityToEntries_)
        .apply(null, arguments);
    };
  });

  after(function() {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(function() {
    assignSeverityToEntriesOverride = null;
    log = new Log(LOGGING, LOG_NAME_FORMATTED);
  });

  describe('instantiation', function() {
    it('should localize the escaped name', function() {
      assert.strictEqual(log.name, LOG_NAME_ENCODED);
    });

    it('should localize the formatted name', function() {
      var formattedName = 'formatted-name';

      var formatName_ = Log.formatName_;
      Log.formatName_ = function() {
        Log.formatName_ = formatName_;
        return formattedName;
      };

      var log = new Log(LOGGING, LOG_NAME_FORMATTED);

      assert.strictEqual(log.formattedName_, formattedName);
    });

    it('should inherit from ServiceObject', function() {
      assert(log instanceof ServiceObject);

      var calledWith = log.calledWith_[0];

      assert.strictEqual(calledWith.parent, LOGGING);
      assert.strictEqual(calledWith.baseUrl, '/logs');
      assert.strictEqual(calledWith.id, LOG_NAME_ENCODED);
      assert.deepEqual(calledWith.methods, {
        delete: true
      });
    });
  });

  describe('assignSeverityToEntries_', function() {
    var ENTRIES = [
      {},
      {}
    ];

    var SEVERITY = 'severity';

    it('should assign severity property to every entry', function() {
      var entries = Log.assignSeverityToEntries_(ENTRIES, SEVERITY);

      var allEntriesAssignedWithSeverity = entries.every(function(entry) {
        return entry.severity === SEVERITY;
      });

      assert.strictEqual(allEntriesAssignedWithSeverity, true);
    });

    it('should not affect original array', function() {
      var originalEntries = extend({}, ENTRIES);

      Log.assignSeverityToEntries_(originalEntries, SEVERITY);

      assert.deepEqual(originalEntries, ENTRIES);
    });
  });

  describe('formatName_', function() {
    var PROJECT_ID = 'project-id';
    var NAME = 'log-name';

    var EXPECTED = 'projects/' + PROJECT_ID + '/logs/' + NAME;

    it('should properly format the name', function() {
      assert.strictEqual(Log.formatName_(PROJECT_ID, NAME), EXPECTED);
    });

    it('should encode a name that requires it', function() {
      var name = 'appengine/logs';
      var expectedName = 'projects/' + PROJECT_ID + '/logs/appengine%2Flogs';

      assert.strictEqual(Log.formatName_(PROJECT_ID, name), expectedName);
    });

    it('should not encode a name that does not require it', function() {
      var name = 'appengine%2Flogs';
      var expectedName = 'projects/' + PROJECT_ID + '/logs/' + name;

      assert.strictEqual(Log.formatName_(PROJECT_ID, name), expectedName);
    });
  });

  describe('createWriteStream', function() {
    beforeEach(function() {
      log.request = util.noop;
    });

    it('should return a writable object stream', function() {
      var ws = log.createWriteStream();

      assert.strictEqual(ws.writable, true);
    });

    it('should make a request once writing started', function(done) {
      log.parent.request = function(reqOpts) {
        assert.strictEqual(reqOpts.method, 'POST');
        assert.strictEqual(reqOpts.uri, '/entries:write');

        setImmediate(done);

        return through();
      };

      var ws = log.createWriteStream();
      ws.emit('writing');
    });

    it('should emit the response from the request', function(done) {
      var response = {};
      var ws = log.createWriteStream();

      log.parent.request = function() {
        var stream = through();

        setImmediate(function() {
          stream.emit('response', response);
        });

        return stream;
      };

      ws.on('response', function(response_) {
        assert.strictEqual(response_, response);
        done();
      });

      ws.emit('writing');
    });

    it('should format each entry', function(done) {
      var entry = { formatted: false };
      var formattedEntry = { formatted: true };

      var ws = log.createWriteStream();

      var expectedData = {
        entries: [
          formattedEntry,
          formattedEntry
        ]
      };

      var requestStream = concat(function(data) {
        assert.deepEqual(JSON.parse(data), expectedData);
        done();
      });

      log.parent.request = function() {
        return requestStream;
      };

      log.formatEntryForApi_ = function(entry_) {
        assert.strictEqual(entry_, entry);
        return formattedEntry;
      };

      ws.write(entry);
      ws.end(entry);
    });
  });

  describe('entry', function() {
    it('should return an entry from Logging', function() {
      var resource = {};
      var data = {};

      var entryObject = {};

      log.parent.entry = function(resource_, data_) {
        assert.strictEqual(resource_, resource);
        assert.strictEqual(data_, data);
        return entryObject;
      };

      var entry = log.entry(resource, data);
      assert.strictEqual(entry, entryObject);
    });

    it('should attach the log name to the entry', function() {
      log.parent.entry = function() {
        return {};
      };

      var entry = log.entry({}, {});
      assert.strictEqual(entry.logName, log.formattedName_);
    });
  });

  describe('getEntries', function() {
    var EXPECTED_OPTIONS = {
      filter: 'logName="' + LOG_NAME_FORMATTED + '"'
    };

    it('should call Logging getEntries with defaults', function(done) {
      log.parent.getEntries = function(options, callback) {
        assert.deepEqual(options, EXPECTED_OPTIONS);
        callback(); // done()
      };

      log.getEntries(done);
    });

    it('should allow overriding the options', function(done) {
      var options = {
        custom: true,
        filter: 'custom filter'
      };

      log.parent.getEntries = function(options_, callback) {
        assert.deepEqual(options_, extend({}, EXPECTED_OPTIONS, options));
        callback(); // done()
      };

      log.getEntries(options, done);
    });
  });

  describe('write', function() {
    var ENTRY = {};
    var OPTIONS = {
      resource: {}
    };

    it('should make the correct API request', function(done) {
      var formattedEntry = {};

      log.formatEntryForApi_ = function() {
        return formattedEntry;
      };

      log.parent.request = function(reqOpts) {
        assert.strictEqual(reqOpts.method, 'POST');
        assert.strictEqual(reqOpts.uri, '/entries:write');
        assert.strictEqual(reqOpts.json.entries[0], formattedEntry);
        assert.strictEqual(reqOpts.json.resource, OPTIONS.resource);

        done();
      };

      log.write(ENTRY, OPTIONS, assert.ifError);
    });

    it('should exec callback with only error and API response', function(done) {
      var args = [1, 2, 3, 4];

      log.formatEntryForApi_ = util.noop;

      log.parent.request = function(reqOpts, callback) {
        callback.apply(null, args);
      };

      log.write(ENTRY, OPTIONS, function() {
        assert.strictEqual(arguments.length, 2);

        assert.strictEqual(arguments[0], args[0]);
        assert.strictEqual(arguments[1], args[1]);

        done();
      });
    });
  });

  describe('severity shortcuts', function() {
    var ENTRY = {};
    var LABELS = [];

    beforeEach(function() {
      log.write = util.noop;
    });

    describe('alert', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'ALERT');

          done();
        };

        log.alert(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.alert(ENTRY, LABELS, done);
      });
    });

    describe('critical', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'CRITICAL');

          done();
        };

        log.critical(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.critical(ENTRY, LABELS, done);
      });
    });

    describe('debug', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'DEBUG');

          done();
        };

        log.debug(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.debug(ENTRY, LABELS, done);
      });
    });

    describe('emergency', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'EMERGENCY');

          done();
        };

        log.emergency(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.emergency(ENTRY, LABELS, done);
      });
    });

    describe('error', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'ERROR');

          done();
        };

        log.error(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.error(ENTRY, LABELS, done);
      });
    });

    describe('info', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'INFO');

          done();
        };

        log.info(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.info(ENTRY, LABELS, done);
      });
    });

    describe('notice', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'NOTICE');

          done();
        };

        log.notice(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.notice(ENTRY, LABELS, done);
      });
    });

    describe('warning', function() {
      it('should format the entries', function(done) {
        assignSeverityToEntriesOverride = function(entries, severity) {
          assert.strictEqual(entries, ENTRY);
          assert.strictEqual(severity, 'WARNING');

          done();
        };

        log.warning(ENTRY, LABELS, assert.ifError);
      });

      it('should pass correct arguments to write', function(done) {
        var assignedEntries = [];

        assignSeverityToEntriesOverride = function() {
          return assignedEntries;
        };

        log.write = function(entry, labels, callback) {
          assert.strictEqual(entry, assignedEntries);
          assert.strictEqual(labels, LABELS);
          callback(); // done()
        };

        log.warning(ENTRY, LABELS, done);
      });
    });
  });

  describe('formatEntryForApi_', function() {
    var ENTRY = {};
    var EXPECTED_FORMATTED_ENTRY = {};
    var ENTRY_INSTANCE = new Entry();

    it('should create an entry if one is not provided', function() {
      var fakeEntryInstance = {
        toJSON: function() {
          return EXPECTED_FORMATTED_ENTRY;
        }
      };

      log.entry = function(entry) {
        assert.strictEqual(entry, ENTRY);
        return fakeEntryInstance;
      };

      var formattedEntry = log.formatEntryForApi_(ENTRY);
      assert.strictEqual(formattedEntry, EXPECTED_FORMATTED_ENTRY);
    });

    it('should get JSON format from entry object', function(done) {
      log.entry = function() {
        done(); // will result in multiple done() calls and fail the test.
      };

      var toJSON = ENTRY_INSTANCE.toJSON;
      ENTRY_INSTANCE.toJSON = function() {
        ENTRY_INSTANCE.toJSON = toJSON;
        return EXPECTED_FORMATTED_ENTRY;
      };

      var formattedEntry = log.formatEntryForApi_(ENTRY_INSTANCE);
      assert.strictEqual(formattedEntry, EXPECTED_FORMATTED_ENTRY);
      done();
    });

    it('should assign the log name', function() {
      var entry = log.formatEntryForApi_(ENTRY_INSTANCE);

      assert.strictEqual(entry.logName, log.formattedName_);
    });
  });
});
