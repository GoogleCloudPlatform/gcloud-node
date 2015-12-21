/*!
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
var async = require('async');
var format = require('string-format-obj');
var googleAuth = require('google-auto-auth');
var is = require('is');
var uuid = require('node-uuid');

var env = require('./env.js');
var BigQuery = require('../lib/bigquery/index.js');
var Logging = require('../lib/logging/index.js');
var PubSub = require('../lib/pubsub/index.js');
var Storage = require('../lib/storage/index.js');

describe('Logging', function() {
  var TESTS_PREFIX = 'gcloud-logging-test';

  var authClient = googleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  var logging = new Logging(env);
  var loggingWithUserAuth;

  var bigQuery = new BigQuery(env);
  var pubsub = new PubSub(env);
  var storage = new Storage(env);

  // Create the possible destinations for sinks that we will create.
  var bucket = storage.bucket(generateName());
  var dataset = bigQuery.dataset(generateName().replace(/-/g, '_'));
  var topic = pubsub.topic(generateName());

  before(function(done) {
    async.parallel([
      checkIfUserAuthIsAvailable,
      createBucket,
      createDataset,
      createTopic
    ], done);

    function checkIfUserAuthIsAvailable(callback) {
      authClient.getToken(function(err) {
        if (!err) {
          loggingWithUserAuth = new Logging({
            projectId: env.projectId
          });
        }

        callback();
      });
    }

    function createBucket(callback) {
      bucket.create(callback);
    }

    function createDataset(callback) {
      dataset.create(callback);
    }

    function createTopic(callback) {
      topic.create(callback);
    }
  });

  after(function(done) {
    async.parallel([
      deleteBuckets,
      deleteDatasets,
      deleteTopics
    ], done);

    function deleteBuckets(callback) {
      storage.getBuckets({
        prefix: TESTS_PREFIX
      }, function(err, buckets) {
        if (err) {
          done(err);
          return;
        }

        function deleteBucket(bucket, callback) {
          bucket.deleteFiles(function(err) {
            if (err) {
              callback(err);
              return;
            }

            bucket.delete(callback);
          });
        }

        async.each(buckets, deleteBucket, callback);
      });
    }

    function deleteDatasets(callback) {
      bigQuery.getDatasets(function(err, datasets) {
        if (err) {
          callback(err);
          return;
        }

        async.each(filterByPrefix(datasets), deleteObject, callback);
      });
    }

    function deleteTopics(callback) {
      pubsub.getTopics(function(err, topics) {
        if (err) {
          callback(err);
          return;
        }

        async.each(filterByPrefix(topics), deleteObject, callback);
      });
    }

    function filterByPrefix(objects) {
      return objects.filter(function(object) {
        return object.id.indexOf(TESTS_PREFIX) === 0;
      });
    }

    function deleteObject(object, callback) {
      object.delete(callback);
    }
  });

  describe('sinks (user auth operations)', function() {
    beforeEach(function() {
      if (!loggingWithUserAuth) {
        this.skip();
      }
    });

    it('should create a sink with a Bucket destination', function(done) {
      var sink = loggingWithUserAuth.sink(generateName());

      sink.create({
        destination: bucket
      }, function(err, sink, apiResponse) {
        assert.ifError(err);

        var destination = 'storage.googleapis.com/' + bucket.name;
        assert.strictEqual(apiResponse.destination, destination);

        sink.delete(done);
      });
    });

    it('should create a sink with a Dataset destination', function(done) {
      var sink = loggingWithUserAuth.sink(generateName());

      sink.create({
        destination: dataset
      }, function(err, sink, apiResponse) {
        assert.ifError(err);

        var destination = format('{baseUrl}/projects/{pId}/datasets/{dId}', {
          baseUrl: 'bigquery.googleapis.com',
          pId: dataset.parent.projectId,
          dId: dataset.id
        });

        assert.strictEqual(apiResponse.destination, destination);

        sink.delete(done);
      });
    });

    it('should create a sink with a Topic destination', function(done) {
      var sink = loggingWithUserAuth.sink(generateName());

      sink.create({
        destination: topic
      }, function(err, sink, apiResponse) {
        assert.ifError(err);

        var destination = 'pubsub.googleapis.com/' + topic.name;
        assert.strictEqual(apiResponse.destination, destination);

        sink.delete(done);
      });
    });

    describe('metadata', function() {
      var sink;
      var FILTER = 'severity = ALERT';

      before(function(done) {
        if (!loggingWithUserAuth) {
          this.skip();
          return;
        }

        sink = loggingWithUserAuth.sink(generateName());

        sink.create({
          destination: topic
        }, done);
      });

      beforeEach(function() {
        if (!loggingWithUserAuth) {
          this.skip();
        }
      });

      after(function(done) {
        if (!loggingWithUserAuth) {
          this.skip();
          return;
        }

        sink.delete(done);
      });

      it('should set metadata', function(done) {
        var metadata = {
          filter: FILTER
        };

        sink.setMetadata(metadata, function(err, apiResponse) {
          assert.ifError(err);
          assert.strictEqual(apiResponse.filter, FILTER);
          done();
        });
      });

      it('should set a filter', function(done) {
        sink.setFilter(FILTER, function(err, apiResponse) {
          assert.ifError(err);
          assert.strictEqual(apiResponse.filter, FILTER);
          done();
        });
      });
    });

    describe('listing sinks', function() {
      var sink;

      before(function(done) {
        if (!loggingWithUserAuth) {
          this.skip();
          return;
        }

        sink = loggingWithUserAuth.sink(generateName());

        sink.create({
          destination: topic
        }, done);
      });

      beforeEach(function() {
        if (!loggingWithUserAuth) {
          this.skip();
        }
      });

      it('should list sinks', function(done) {
        logging.getSinks(function(err, sinks) {
          assert.ifError(err);
          assert(sinks.length > 0);
          done();
        });
      });

      it('should list sinks as a stream', function(done) {
        logging.getSinks({ pageSize: 1 })
          .on('error', done)
          .once('data', function() {
            this.end();
            done();
          });
      });

      it('should get metadata', function(done) {
        logging.getSinks({ pageSize: 1 })
          .on('error', done)
          .once('data', function(sink) {
            sink.getMetadata(function(err, metadata) {
              assert.ifError(err);
              assert.strictEqual(is.object(metadata), true);
              done();
            });
          });
      });
    });
  });

  describe('logs', function() {
    var log = logging.log('syslog');

    var logEntries = [
      log.entry('log entry 1'), // string data
      log.entry({ delegate: process.env.USER }) // object data
    ];

    var options = {
      resource: {
        type: 'gce_instance',
        labels: {
          zone: 'global',
          instance_id: '3'
        }
      }
    };

    it('should list log entries', function(done) {
      logging.getEntries({ pageSize: 1 }, function(err, entries) {
        assert.ifError(err);
        assert.strictEqual(entries.length, 1);
        done();
      });
    });

    it('should list log entries as a stream', function(done) {
      log.getEntries({ pageSize: 1 })
        .on('error', done)
        .once('data', function() {
          this.end();
          done();
        });
    });

    it('should write to a log', function(done) {
      log.write(logEntries, options, done);
    });

    it('should write to a log with alert helper', function(done) {
      log.alert(logEntries, options, done);
    });

    it('should write to a log with critical helper', function(done) {
      log.critical(logEntries, options, done);
    });

    it('should write to a log with debug helper', function(done) {
      log.debug(logEntries, options, done);
    });

    it('should write to a log with emergency helper', function(done) {
      log.emergency(logEntries, options, done);
    });

    it('should write to a log with error helper', function(done) {
      log.error(logEntries, options, done);
    });

    it('should write to a log with info helper', function(done) {
      log.info(logEntries, options, done);
    });

    it('should write to a log with notice helper', function(done) {
      log.notice(logEntries, options, done);
    });

    it('should write to a log with warning helper', function(done) {
      log.warning(logEntries, options, done);
    });

    it('should write from a stream', function(done) {
      log.createWriteStream()
        .on('error', done)
        .on('finish', done)
        .end(logEntries);
    });
  });

  function generateName() {
    return TESTS_PREFIX + uuid.v1();
  }
});
