# Google Cloud Node.js Client
> Node.js idiomatic client for [Google Cloud Platform](https://cloud.google.com/) services.

[![NPM Version](https://img.shields.io/npm/v/gcloud.svg)](https://www.npmjs.org/package/gcloud)
[![Travis Build Status](https://travis-ci.org/GoogleCloudPlatform/gcloud-node.svg)](https://travis-ci.org/GoogleCloudPlatform/gcloud-node/)
[![Coverage Status](https://img.shields.io/coveralls/GoogleCloudPlatform/gcloud-node.svg)](https://coveralls.io/r/GoogleCloudPlatform/gcloud-node?branch=master)

* [Homepage][gcloud-homepage]
* [API Documentation][gcloud-docs]

This client supports the following Google Cloud Platform services:

* [Google BigQuery](#google-bigquery)
* [Google Cloud Datastore](#google-cloud-datastore)
* [Google Cloud Storage](#google-cloud-storage)
* [Google Cloud Pub/Sub](#google-cloud-pubsub-beta) (Beta)
* [Google Cloud Search](#google-cloud-search-alpha) (Alpha)

If you need support for other Google APIs, check out the [Google Node.js API Client library][googleapis].

## Quick Start

```sh
$ npm install --save gcloud
```

## Example Applications

- [gcloud-node-todos][gcloud-todos] - A TodoMVC backend using gcloud-node and Datastore.
- [gitnpm][gitnpm] - Easily lookup an npm package's GitHub repo using gcloud-node and Google App Engine.
- [gcloud-kvstore][gcloud-kvstore] - Use Datastore as a simple key-value store.
- [hya-wave][hya-wave] - Cloud-based web sample editor. Part of the [hya-io][hya-io] family of products.

## Authorization

With `gcloud-node` it's incredibly easy to get authorized and start using Google's APIs. You can set your credentials on a global basis as well as on a per-API basis. See each individual API section below to see how you can auth on a per-API-basis. This is useful if you want to use different accounts for different Google Cloud services.

### On Google Compute Engine

If you are running this client on Google Compute Engine, we handle authorization for you with no configuration. You just need to make sure that when you [set up the GCE instance][gce-how-to], you add the correct scopes for the APIs you want to access.

``` js
// Authorizing on a global basis.
var projectId = process.env.GCLOUD_PROJECT_ID; // E.g. 'grape-spaceship-123'
var gcloud = require('gcloud')({
  projectId: projectId
});

// ...you're good to go! See the next section to get started using the APIs.
```

### Elsewhere

If you are not running this client on Google Compute Engine, you need a Google Developers service account. To create a service account:

1. Visit the [Google Developers Console][dev-console].
2. Create a new project or click on an existing project.
3. Navigate to  **APIs & auth** > **APIs section** and turn on the following APIs (you may need to enable billing in order to use these services):
  * Google Cloud Datastore API
  * Google Cloud Storage
  * Google Cloud Storage JSON API
4. Navigate to **APIs & auth** >  **Credentials** and then:
  * If you want to use a new service account, click on **Create new Client ID** and select **Service account**. After the account is created, you will be prompted to download the JSON key file that the library uses to authorize your requests.
  * If you want to generate a new key for an existing service account, click on **Generate new JSON key** and download the JSON key file.

``` js
// Authorizing on a global basis.
var projectId = process.env.GCLOUD_PROJECT_ID; // E.g. 'grape-spaceship-123'

var gcloud = require('gcloud')({
  projectId: projectId,
  keyFilename: '/path/to/keyfile.json'
});

// ...you're good to go! See the next section to get started using the APIs.
```

You can also set auth on a per-API-instance basis. The examples below show you how.


## Google BigQuery

- [API Documentation][gcloud-bigquery-docs]
- [Official Documentation][cloud-bigquery-docs]

#### Preview

```js
var gcloud = require('gcloud');

// Authorizing on a per-API-basis. You don't need to do this if you auth on a
// global basis (see Authorization section above).
var bigquery = gcloud.bigquery({
  projectId: 'my-project',
  keyFilename: '/path/to/keyfile.json'
});

// Access an existing dataset.
var schoolsDataset = bigquery.dataset('schools');

// Import data into a dataset.
schoolsDataset.import('/local/file.json', function(err, job) {});

// Get results from a query job.
var job = bigquery.job('job-id');

// Use a callback.
job.getQueryResults(function(err, rows, nextQuery) {});

// Or get the same results as a readable stream.
job.getQueryResults().on('data', function(row) {});
```


## Google Cloud Datastore

- [API Documentation][gcloud-datastore-docs]
- [Official Documentation][cloud-datastore-docs]

*Follow the [activation instructions][cloud-datastore-activation] to use the Google Cloud Datastore API with your project.*

#### Preview

```js
var gcloud = require('gcloud');

// Authorizing on a per-API-basis. You don't need to do this if you auth on a
// global basis (see Authorization section above).

var dataset = gcloud.datastore.dataset({
  projectId: 'my-project',
  keyFilename: '/path/to/keyfile.json'
});

dataset.get(dataset.key(['Product', 'Computer']), function(err, entity) {
  console.log(err || entity);
});

// Save data to your dataset.
var blogPostData = {
  title: 'How to make the perfect homemade pasta',
  author: 'Andrew Chilton',
  isDraft: true
};

var blogPostKey = dataset.key('BlogPost');

dataset.save({
  key: blogPostKey,
  data: blogPostData
}, function(err) {
  // `blogPostKey` has been updated with an ID so you can do more operations
  // with it, such as an update:
  dataset.save({
    key: blogPostKey,
    data: {
      isDraft: false
    }
  }, function(err) {
    if (!err) {
      // The blog post is now published!
    }
  });
});
```


## Google Cloud Storage

- [API Documentation][gcloud-storage-docs]
- [Official Documentation][cloud-storage-docs]

#### Preview

```js
var fs = require('fs');
var gcloud = require('gcloud');

// Authorizing on a per-API-basis. You don't need to do this if you auth on a
// global basis (see Authorization section above).

var gcs = gcloud.storage({
  keyFilename: '/path/to/keyfile.json',
  projectId: 'my-project'
});

// Create a new bucket.
gcs.createBucket('my-new-bucket', function(err, bucket) {
  if (!err) {
    // "my-new-bucket" was successfully created.
  }
});

// Reference an existing bucket.
var bucket = gcs.bucket('my-existing-bucket');

// Upload a local file to a new file to be created in your bucket.
var fileStream = fs.createReadStream('/local/file.txt');
fileStream.pipe(bucket.file('file.txt').createWriteStream());

// Download a remote file to a new local file.
var fileStream = bucket.file('photo.jpg').createReadStream();
fileStream.pipe(fs.createWriteStream('/local/photo.jpg'));
```


## Google Cloud Pub/Sub (Beta)

> This is a *Beta* release of Google Cloud Pub/Sub. This feature is not covered by any SLA or deprecation policy and may be subject to backward-incompatible changes.

- [API Documentation][gcloud-pubsub-docs]
- [Official Documentation][cloud-pubsub-docs]

#### Preview

```js
var gcloud = require('gcloud');

// Authorizing on a per-API-basis. You don't need to do this if you
// auth on a global basis (see Authorization section above).

var pubsub = gcloud.pubsub({
  projectId: 'my-project',
  keyFilename: '/path/to/keyfile.json'
});

// Reference a topic.
var topic = pubsub.topic('my-topic');

// Publish a message to the topic.
// The topic will be created if it doesn't exist.
topic.publish({
  data: 'New message!'
}, function(err) {});

// Subscribe to the topic.
topic.subscribe('new-subscription', function(err, subscription) {
  // Register listeners to start pulling for messages.
  function onError(err) {}
  function onMessage(message) {}
  subscription.on('error', onError);
  subscription.on('message', onMessage);

  // Remove listeners to stop pulling for messages.
  subscription.removeListener('message', onMessage);
  subscription.removeListener('error', onError);
});
```


## Google Cloud Search (Alpha)

> This is an *Alpha* release of Google Cloud Search. This feature is not covered by any SLA or deprecation policy and may be subject to backward-incompatible changes.

- [API Documentation][gcloud-search-docs]
- [Official Documentation][cloud-search-docs]

#### Preview

```js
var gcloud = require('gcloud');

// Authorizing on a per-API-basis. You don't need to do this if you auth on a
// global basis (see Authorization section above).

var search = gcloud.search({
  keyFilename: '/path/to/keyfile.json',
  projectId: 'my-project'
});

// Create a document in a new index.
var index = search.index('memberData');

var document = index.document('member-id-34211');
document.addField('preferredContactForm').addTextValue('phone');

index.createDocument(document, function(err, document) {
  console.log(err || document);
});

// Search an index and get the results as a readable object stream.
var index = search.index('memberData');

index.search('preferredContactForm:phone')
  .on('error', console.error)
  .on('data', function(document) {
    // document.id = 'member-id-34211';
  })
  .on('end', function() {
    // All results consumed.
  });
```


## Contributing

Contributions to this library are always welcome and highly encouraged.

See [CONTRIBUTING](CONTRIBUTING.md) for more information on how to get started.

## License

Apache 2.0 - See [COPYING](COPYING) for more information.

[gcloud-homepage]: https://googlecloudplatform.github.io/gcloud-node/
[gcloud-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs
[gcloud-bigquery-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs/bigquery
[gcloud-datastore-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs/datastore
[gcloud-pubsub-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs/pubsub
[gcloud-search-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs/search
[gcloud-storage-docs]: https://googlecloudplatform.github.io/gcloud-node/#/docs/storage

[gcloud-todos]: https://github.com/GoogleCloudPlatform/gcloud-node-todos
[gitnpm]: https://github.com/stephenplusplus/gitnpm
[gcloud-kvstore]: https://github.com/stephenplusplus/gcloud-kvstore
[hya-wave]: https://wav.hya.io
[hya-io]: https://hya.io

[dev-console]: https://console.developers.google.com/project
[gce-how-to]: https://cloud.google.com/compute/docs/authentication#using

[googleapis]: https://github.com/google/google-api-nodejs-client

[cloud-bigquery-docs]: https://cloud.google.com/bigquery/what-is-bigquery

[cloud-datastore-docs]: https://cloud.google.com/datastore/docs
[cloud-datastore-activation]: https://cloud.google.com/datastore/docs/activate

[cloud-pubsub-docs]: https://cloud.google.com/pubsub/docs

[cloud-search-docs]: https://cloud.google.com/search/

[cloud-storage-docs]: https://cloud.google.com/storage/docs/overview
