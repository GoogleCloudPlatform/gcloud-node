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
 * @module pubsub/message
 */

'use strict';

/**
 *
 */
function Message(subscription, resp) {
  this.subscription = subscription;
  this.api = subscription.api;

  this.ackId = resp.ackId;

  this.id = resp.message.messageId;
  this.data = resp.message.data;
  this.attrs = resp.message.attributes;

  var pt = resp.message.publishTime;
  var milliseconds = parseInt(pt.nanos, 10) / 1e6;

  this.publishTime = new Date(parseInt(pt.seconds, 10) * 1000 + milliseconds);
}

/**
 *
 */
Message.prototype.ack = function() {
  this.subscription.ackQueue_.add([this.ackId]);
};

/**
 *
 */
Message.prototype.modifyAckDeadline = function(milliseconds) {
  this.subscription.modifyQueue_.add({
    ackId: this.ackId,
    deadline: milliseconds / 1000
  });
};

/**
 *
 */
Message.prototype.nack = function() {
  this.modifyAckDeadline(0);
};

module.exports = Message;
