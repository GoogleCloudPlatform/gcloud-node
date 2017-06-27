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
 * @module pubsub/topic
 */

'use strict';

var common = require('@google-cloud/common');
var extend = require('extend');
var is = require('is');

/**
 * @type {module:pubsub/iam}
 * @private
 */
var IAM = require('./iam.js');

/**
 * @type {module:pubsub/publisher}
 * @private
 */
var Publisher = require('./publisher.js');

/*! Developer Documentation
 *
 * @param {module:pubsub} pubsub - PubSub object.
 * @param {string} name - Name of the topic.
 */
/**
 * A Topic object allows you to interact with a Cloud Pub/Sub topic.
 *
 * @constructor
 * @alias module:pubsub/topic
 *
 * @example
 * var topic = pubsub.topic('my-topic');
 */
function Topic(pubsub, name, options) {
  this.name = Topic.formatName_(pubsub.projectId, name);
  this.pubsub = pubsub;
  this.projectId = pubsub.projectId;
  this.request = pubsub.request.bind(pubsub);

  /**
   * [IAM (Identity and Access Management)](https://cloud.google.com/pubsub/access_control)
   * allows you to set permissions on individual resources and offers a wider
   * range of roles: editor, owner, publisher, subscriber, and viewer. This
   * gives you greater flexibility and allows you to set more fine-grained
   * access control.
   *
   * *The IAM access control features described in this document are Beta,
   * including the API methods to get and set IAM policies, and to test IAM
   * permissions. Cloud Pub/Sub's use of IAM features is not covered by
   * any SLA or deprecation policy, and may be subject to backward-incompatible
   * changes.*
   *
   * @mixes module:pubsub/iam
   *
   * @resource [Access Control Overview]{@link https://cloud.google.com/pubsub/access_control}
   * @resource [What is Cloud IAM?]{@link https://cloud.google.com/iam/}
   *
   * @example
   * //-
   * // Get the IAM policy for your topic.
   * //-
   * topic.iam.getPolicy(function(err, policy) {
   *   console.log(policy);
   * });
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * topic.iam.getPolicy().then(function(data) {
   *   var policy = data[0];
   *   var apiResponse = data[1];
   * });
   */
  this.iam = new IAM(pubsub, this.name);
}

/**
 * Format the name of a topic. A Topic's full name is in the format of
 * 'projects/{projectId}/topics/{topicName}'.
 *
 * @private
 *
 * @return {string}
 */
Topic.formatName_ = function(projectId, name) {
  // Simple check if the name is already formatted.
  if (name.indexOf('/') > -1) {
    return name;
  }
  return 'projects/' + projectId + '/topics/' + name;
};

/**
 * Create a topic.
 *
 * @param {object=} config - See {module:pubsub#createTopic}.
 *
 * @example
 * topic.create(function(err, topic, apiResponse) {
 *   if (!err) {
 *     // The topic was created successfully.
 *   }
 * });
 *
 * //-
 * // If the callback is omitted, we'll return a Promise.
 * //-
 * topic.create().then(function(data) {
 *   var topic = data[0];
 *   var apiResponse = data[1];
 * });
 */
Topic.prototype.create = function(callback) {
  this.pubsub.createTopic(this.name, callback);
};

/**
 * Create a subscription to this topic.
 *
 * All generated subscription names share a common prefix, `autogenerated-`.
 *
 * @resource [Subscriptions: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/create}
 *
 * @param {string=} subName - The name of the subscription. If a name is not
 *     provided, a random subscription name will be generated and created.
 * @param {object=} options - See a
 *     [Subscription resource](https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions)
 * @param {number} options.ackDeadlineSeconds - The maximum time after
 *     receiving a message that you must ack a message before it is redelivered.
 * @param {boolean=} options.autoAck - Automatically acknowledge the message
 *     once it's pulled. (default: false)
 * @param {string} options.encoding - When pulling for messages, this type is
 *     used when converting a message's data to a string. (default: 'utf-8')
 * @param {number} options.interval - Interval in milliseconds to check for new
 *     messages. (default: 10)
 * @param {number} options.maxInProgress - Maximum messages to consume
 *     simultaneously.
 * @param {number|date} options.messageRetentionDuration - Set this to override
 *     the default duration of 7 days. This value is expected in seconds.
 *     Acceptable values are in the range of 10 minutes and 7 days.
 * @param {string} options.pushEndpoint - A URL to a custom endpoint that
 *     messages should be pushed to.
 * @param {boolean} options.retainAckedMessages - If set, acked messages are
 *     retained in the subscription's backlog for 7 days (unless overriden by
 *     `options.messageRetentionDuration`). Default: `false`
 * @param {number} options.timeout - Set a maximum amount of time in
 *     milliseconds on an HTTP request to pull new messages to wait for a
 *     response before the connection is broken.
 * @param {function} callback - The callback function.
 *
 * @example
 * var callback = function(err, subscription, apiResponse) {};
 *
 * // Without specifying any options.
 * topic.createSubscription('newMessages', callback);
 *
 * //-
 * // Omit the name to have one generated automatically. All generated names
 * // share a common prefix, `autogenerated-`.
 * //-
 * topic.createSubscription(function(err, subscription, apiResponse) {
 *   // subscription.name = The generated name.
 * });
 *
 * // With options.
 * topic.createSubscription('newMessages', {
 *   ackDeadlineSeconds: 90
 * }, callback);
 *
 * //-
 * // If the callback is omitted, we'll return a Promise.
 * //-
 * topic.createSubscription('newMessages').then(function(data) {
 *   var subscription = data[0];
 *   var apiResponse = data[1];
 * });
 */
Topic.prototype.createSubscription = function(name, options, callback) {
  this.pubsub.createSubscription(this, name, options, callback);
};

/**
 * Delete the topic. This will not delete subscriptions to this topic.
 *
 * @resource [Topics: delete API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/delete}
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * topic.delete(function(err, apiResponse) {});
 *
 * //-
 * // If the callback is omitted, we'll return a Promise.
 * //-
 * topic.delete().then(function(data) {
 *   var apiResponse = data[0];
 * });
 */
Topic.prototype.delete = function(gaxOpts, callback) {
  if (is.fn(gaxOpts)) {
    callback = gaxOpts;
    gaxOpts = {};
  }

  var reqOpts = {
    topic: this.name
  };

  this.request({
    client: 'publisherClient',
    method: 'deleteTopic',
    reqOpts: reqOpts,
    gaxOpts: gaxOpts
  }, callback);
};

/**
 * Get the official representation of this topic from the API.
 *
 * @resource [Topics: get API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/get}
 *
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this
 *     request.
 * @param {object} callback.metadata - The metadata of the Topic.
 * @param {object} callback.apiResponse - The full API response.
 *
 * @example
 * topic.getMetadata(function(err, metadata, apiResponse) {});
 *
 * //-
 * // If the callback is omitted, we'll return a Promise.
 * //-
 * topic.getMetadata().then(function(data) {
 *   var metadata = data[0];
 *   var apiResponse = data[1];
 * });
 */
Topic.prototype.getMetadata = function(gaxOpts, callback) {
  if (is.fn(gaxOpts)) {
    callback = gaxOpts;
    gaxOpts = {};
  }

  var reqOpts = {
    topic: this.name
  };

  this.request({
    client: 'publisherClient',
    method: 'getTopic',
    reqOpts: reqOpts,
    gaxOpts: gaxOpts
  }, callback);
};

/**
 * Get a list of the subscriptions registered to this topic. You may optionally
 * provide a query object as the first argument to customize the response.
 *
 * Your provided callback will be invoked with an error object if an API error
 * occurred or an array of {module:pubsub/subscription} objects.
 *
 * @resource [Subscriptions: list API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics.subscriptions/list}
 *
 * @param {object=} options - Configuration object.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {number} options.maxApiCalls - Maximum number of API calls to make.
 * @param {number} options.maxResults - Maximum number of results to return.
 * @param {number} options.pageSize - Maximum number of results to return.
 * @param {string} options.pageToken - Page token.
 * @param {function} callback - The callback function.
 *
 * @example
 * topic.getSubscriptions(function(err, subscriptions) {
 *   // subscriptions is an array of `Subscription` objects.
 * });
 *
 * // Customize the query.
 * topic.getSubscriptions({
 *   pageSize: 3
 * }, callback);
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, subscriptions, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     topic.getSubscriptions(nextQuery, callback);
 *   }
 * }
 *
 * topic.getSubscriptions({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // If the callback is omitted, we'll return a Promise.
 * //-
 * topic.getSubscriptions().then(function(data) {
 *   var subscriptions = data[0];
 * });
 */
Topic.prototype.getSubscriptions = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  var reqOpts = extend({
    topic: this.name
  }, options);

  delete reqOpts.gaxOpts;

  this.request({
    client: 'publisherClient',
    method: 'listTopicSubscriptions',
    reqOpts: reqOpts,
    gaxOpts: options.gaxOpts
  }, function() {
    var subscriptions = arguments[1];

    if (subscriptions) {
      arguments[1] = subscriptions.map(function(sub) {
        // Depending on if we're using a subscriptions.list or
        // topics.subscriptions.list API endpoint, we will get back a
        // Subscription resource or just the name of the subscription.
        var subscriptionInstance = self.subscription(sub.name || sub);

        if (sub.name) {
          subscriptionInstance.metadata = sub;
        }

        return subscriptionInstance;
      });
    }

    callback.apply(null, arguments);
  });
};

/**
 * Get a list of the {module:pubsub/subscription} objects registered to this
 * topic as a readable object stream.
 *
 * @param {object=} query - Configuration object. See
 *     {module:pubsub/topic#getSubscriptions} for a complete list of options.
 * @return {stream}
 *
 * @example
 * topic.getSubscriptionsStream()
 *   .on('error', console.error)
 *   .on('data', function(subscription) {
 *     // subscription is a Subscription object.
 *   })
 *   .on('end', function() {
 *     // All subscriptions retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * topic.getSubscriptionsStream()
 *   .on('data', function(subscription) {
 *     this.end();
 *   });
 */
Topic.prototype.getSubscriptionsStream =
  common.paginator.streamify('getSubscriptions');

/**
 *
 */
Topic.prototype.publisher = function(options) {
  return new Publisher(this, options);
};

/**
 * Create a Subscription object. This command by itself will not run any API
 * requests. You will receive a {module:pubsub/subscription} object,
 * which will allow you to interact with a subscription.
 *
 * @param {string} name - Name of the subscription.
 * @param {object=} options - Configuration object.
 * @return {module:pubsub/subscription}
 *
 * @example
 * var subscription = topic.subscription('my-subscription');
 *
 * // Register a listener for `message` events.
 * subscription.on('message', function(message) {
 *   // Called every time a message is received.
 *   // message.id = ID of the message.
 *   // message.ackId = ID used to acknowledge the message receival.
 *   // message.data = Contents of the message.
 *   // message.attrs = Attributes of the message.
 *   // message.publishTime = Timestamp when Pub/Sub received the message.
 * });
 */
Topic.prototype.subscription = function(name, options) {
  options = options || {};
  options.topic = this;

  return this.pubsub.subscription(name, options);
};

/*! Developer Documentation
 *
 * All async methods (except for streams) will return a Promise in the event
 * that a callback is omitted.
 */
common.util.promisifyAll(Topic, {
  exclude: [
    'publisher',
    'subscription'
  ]
});

module.exports = Topic;
