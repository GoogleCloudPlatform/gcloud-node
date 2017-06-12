/*!
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

/*!
 * @module logging-bunyan
 */

'use strict';

var extend = require('extend');
var logging = require('@google-cloud/logging');
var util = require('util');
var Writable = require('stream').Writable;

/**
 * Map of Stackdriver logging levels.
 *
 * @type {object}
 * @private
 */
var BUNYAN_TO_STACKDRIVER = {
  60: 'CRITICAL',
  50: 'ERROR',
  40: 'WARNING',
  30: 'INFO',
  20: 'DEBUG',
  10: 'DEBUG'
};

/**
 * This module provides support for streaming your Bunyan logs to
 * [Stackdriver Logging](https://cloud.google.com/logging).
 *
 * @constructor
 * @alias module:logging-bunyan
 *
 * @param {object} options - [Configuration object](#/docs). Refer to this link
 *     for authentication information.
 * @param {string=} options.logName - The name of the log that will receive
 *     messages written to this bunyan stream. Default: `bunyan_Log`.
 * @param {object=} options.resource - The monitored resource that the log
 *     stream corresponds to. On Google Cloud Platform, this is detected
 *     automatically, but you may optionally specify a specific monitored
 *     resource. For more information, see the
 *     [official documentation]{@link https://cloud.google.com/logging/docs/api/reference/rest/v2/MonitoredResource}
 *
 * @example
 * var bunyan = require('bunyan');
 *
 * var loggingBunyan = require('@google-cloud/logging-bunyan')({
 *   projectId: 'grape-spaceship-123',
 *   keyFilename: '/path/to/keyfile.json',
 *   resource: {
 *     type: 'global'
 *   }
 * });
 *
 * var logger = bunyan.createLogger({
 *   name: 'my-service',
 *   streams: [
 *     loggingBunyan.stream('info')
 *   ]
 * });
 *
 */
function LoggingBunyan(options) {
  if (!(this instanceof LoggingBunyan)) {
    return new LoggingBunyan(options);
  }

  options = options || {};

  this.logName_ = options.logName || 'bunyan_log';
  this.resource_ = options.resource;

  this.log_ = logging(options).log(this.logName_, {
    removeCircular: true
  });

  Writable.call(this, {
    objectMode: true
  });
}
util.inherits(LoggingBunyan, Writable);

/**
 * Convenience method that Builds a bunyan stream object that you can put in
 * the bunyan streams list.
 *
 * @param {string|number} level - A bunyan logging level. Log entries at or
 *     above this level will be routed to Stackdriver Logging.
 *
 * @example
 * var logger = bunyan.createLogger({
 *   name: 'my-service',
 *   streams: [
 *     loggingBunyan.stream('info')
 *   ]
 * });
 */
LoggingBunyan.prototype.stream = function(level) {
  return {
    level: level,
    type: 'raw',
    stream: this
  };
};

/**
 * Format a bunyan record into a Stackdriver log entry.
 *
 * @param {object} record - Bunyan log record.
 *
 * @private
 */
LoggingBunyan.prototype.formatEntry_ = function(record) {
  if (typeof record === 'string') {
    throw new Error(
      '@google-cloud/logging-bunyan only works as a raw bunyan stream type.'
    );
  }

  record = extend({}, record);

  // Stackdriver Log Viewer picks up the summary line from the 'message' field
  // of the payload. Unless the user has provided a 'message' property also,
  // move the 'msg' to 'message'.
  if (!record.message) {
    // If this is an error, report the full stack trace. This allows Stackdriver
    // Error Reporting to pick up errors automatically (for severity 'error' or
    // higher). In this case we leave the 'msg' property intact.
    // https://cloud.google.com/error-reporting/docs/formatting-error-messages
    //
    // TODO(ofrobots): when resource.type is 'global' we need to additionally
    // provide serviceContext.service as part of the entry for Error Reporting
    // to automatically pick up the error.
    if (record.err && record.err.stack) {
      record.message = record.err.stack;
    } else if (record.msg) {
      // Simply rename `msg` to `message`.
      record.message = record.msg;
      delete record.msg;
    }
  }

  var entryMetadata = {
    resource: this.resource_,
    timestamp: record.time,
    severity: BUNYAN_TO_STACKDRIVER[record.level]
  };

  // If the record contains a httpRequest property, provide it on the entry
  // metadata. This allows Stackdriver to use request log formatting.
  // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#HttpRequest
  // Note that the httpRequest field must properly validate as a HttpRequest
  // proto message, or the log entry would be rejected by the API. We do no
  // validation here.
  if (record.httpRequest) {
    entryMetadata.httpRequest = record.httpRequest;
    delete record.httpRequest;
  }

  return this.log_.entry(entryMetadata, record);
};

/**
 * Relay a log entry to the logging agent. This is called by bunyan through
 * Writable#write.
 *
 * @param {object} record - Bunyan log record.
 *
 * @private
 */
LoggingBunyan.prototype._write = function(record, encoding, callback) {
  var entry = this.formatEntry_(record);
  this.log_.write(entry, callback);
};

/**
 * Relay an array of log entries to the logging agent. This is called by bunyan
 * through Writable#write.
 *
 * @param {object[]} records - Array of WritableStream WriteReq objects.
 *
 * @private
 */
LoggingBunyan.prototype._writev = function(chunks, callback) {
  var self = this;

  var entries = chunks.map(function(request) {
    return self.formatEntry_(request.chunk);
  });

  this.log_.write(entries, callback);
};

module.exports = LoggingBunyan;
module.exports.BUNYAN_TO_STACKDRIVER = BUNYAN_TO_STACKDRIVER;
