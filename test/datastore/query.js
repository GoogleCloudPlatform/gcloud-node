/**
 * Copyright 2014 Google Inc. All Rights Reserved.
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

/*global describe, it */

'use strict';

var assert = require('assert');
var datastore = require('../../lib/datastore');
var entity = require('../../lib/datastore/entity.js');
var queryProto = require('../testdata/proto_query.json');

describe('Query', function() {
  var ds = new datastore.Dataset({ projectId: 'my-project-id' });

  it('should use default namespace if none is specified', function(done) {
    var q = ds.createQuery(['kind1']);
    assert.equal(q.namespace, '');
    done();
  });

  it('should use support custom namespaces', function(done) {
    var q = ds.createQuery('ns', ['kind1']);
    assert.equal(q.namespace, 'ns');
    done();
  });

  it('should support querying multiple kinds', function(done) {
    var q = ds.createQuery(['kind1', 'kind2']);
    var qNS = ds.createQuery('ns', ['kind1', 'kind2']);

    assert.strictEqual(q.namespace, '');
    assert.equal(q.kinds[0], 'kind1');
    assert.equal(q.kinds[1], 'kind2');

    assert.equal(qNS.namespace, 'ns');
    assert.equal(qNS.kinds[0], 'kind1');
    assert.equal(qNS.kinds[1], 'kind2');
    done();
  });

  it('should support field selection by field name', function(done) {
    var q = ds.createQuery(['kind1']).select(['name', 'title']);
    assert.equal(q.selectVal[0], 'name');
    assert.equal(q.selectVal[1], 'title');
    done();
  });

  it('should support ancestor filtering', function(done) {
    var q = ds.createQuery(['kind1']).hasAncestor(['kind2', 123]);
    assert.equal(q.filters[0].name, '__key__');
    assert.equal(q.filters[0].op, 'HAS_ANCESTOR');
    assert.deepEqual(q.filters[0].val, ['kind2', 123]);
    done();
  });

  it('should support multiple filters', function(done) {
    var now = new Date();
    var q = ds.createQuery(['kind1'])
        .filter('date <=', now)
        .filter('name =', 'Title')
        .filter('count >', 20);
    assert.equal(q.filters[0].name, 'date');
    assert.equal(q.filters[0].op, '<=');
    assert.strictEqual(q.filters[0].val, now);

    assert.equal(q.filters[1].name, 'name');
    assert.equal(q.filters[1].op, '=');
    assert.strictEqual(q.filters[1].val, 'Title');

    assert.equal(q.filters[2].name, 'count');
    assert.equal(q.filters[2].op, '>');
    assert.strictEqual(q.filters[2].val, 20);
    done();
  });

  it('should support ordering asc and desc', function(done) {
    var q = ds.createQuery(['kind1']).order('+name').order('-count');
    assert.equal(q.orders[0].name, 'name');
    assert.equal(q.orders[0].sign, '+');
    assert.equal(q.orders[1].name, 'count');
    assert.equal(q.orders[1].sign, '-');
    done();
  });

  it('should throw error is invalid sort sign is provided', function(done) {
    assert.throws(function() {
      ds.createQuery(['kind1']).order('*name');
    }, /Invalid order pattern/);
    done();
  });

  it('should provide pagination with offset and limit', function(done) {
    var q = ds.createQuery(['kind1']).offset(20).limit(100);
    assert.strictEqual(q.offsetVal, 20);
    assert.strictEqual(q.limitVal, 100);
    done();
  });

  it('should allow page start and end tokens', function(done) {
    var q = ds.createQuery(['kind1']).start('abc123').end('def987');
    assert.strictEqual(q.startVal, 'abc123');
    assert.strictEqual(q.endVal, 'def987');
    done();
  });

  it('should be converted to a query proto successfully', function(done) {
    var q = ds.createQuery(['Kind'])
        .select(['name', 'count'])
        .filter('count >=', datastore.int(5))
        .filter('name =', 'Burcu')
        .order('-count')
        .groupBy(['count'])
        .start('start-cursor')
        .end('end-cursor')
        .offset(5)
        .limit(10);
    assert.deepEqual(entity.queryToQueryProto(q), queryProto);
    done();
  });
});
