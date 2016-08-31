/*!
 * Copyright 2016 Google Inc. All Rights Reserved.
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

var publisherApi = require('./publisher_api');
var subscriberApi = require('./subscriber_api');
var extend = require('extend');
var gax = require('google-gax');
var lodash = require('lodash');

function v1(options) {
  options = extend({
    scopes: v1.ALL_SCOPES
  }, options);
  var gaxGrpc = gax.grpc(options);
  var result = {};
  extend(result, publisherApi(gaxGrpc));
  extend(result, subscriberApi(gaxGrpc));
  return result;
}

v1.SERVICE_ADDRESS = publisherApi.SERVICE_ADDRESS;
v1.ALL_SCOPES = lodash.union(
  publisherApi.ALL_SCOPES,
  subscriberApi.ALL_SCOPES);
module.exports = v1;
