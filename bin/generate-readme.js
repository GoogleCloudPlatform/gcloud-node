#!/usr/bin/env node
// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const chalk = require('chalk');
const fetch = require('node-fetch');
const figures = require('figures');
const { readFileSync, writeFileSync } = require('fs');

let argv = null;
const apiUrl = 'https://api.github.com';

function checkpoint (message, success = true) {
  const prefix = success ? chalk.green(figures.tick) : chalk.red(figures.cross);
  console.info(`${prefix} ${message}`);
}

// grab files using GitHub API.
async function getContent (owner, repo, path) {
  const headers = {};
  const token = argv.token || process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `token ${token}`;
  const res = await fetch(`${apiUrl}/repos/${owner}/${repo}/contents/${path}`, {
    headers: headers
  });
  if (res.status !== 200) {
    const err = Error(`unexpected status = ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const content = (await res.json()).content;
  return JSON.parse(
    Buffer.from(content, 'base64').toString('utf8')
  );
}

// for each repo listed in sloth/repos.json pull down .repo-metadata.json.
async function collectRepoMetadata (repos) {
  const repoMetadata = {};
  for (let i = 0, repo; (repo = repos[i]) !== undefined; i++) {
    if (repo.language === 'nodejs') {
      try {
        const [o, r] = repo.repo.split('/');
        repoMetadata[r] = await getContent(o, r, '.repo-metadata.json');
        checkpoint(`${repo.repo} found .repo-metadata.json`);
      } catch (err) {
        if (err.status === 404) checkpoint(`${repo.repo} had no .repo-metadata.json`, false);
        else throw err;
      }
    }
  }
  return repoMetadata;
}

// Fills in README.mustache with contents loaded from sloth/repos.json.
// Given the simplicity of the template, we do not actually use a templating
// engine, instead calling string.replace.
async function generateReadme (repoMetadata) {
  const template = readFileSync('./bin/README.mustache', 'utf8');
  const libraries = [];

  // filter libraries to only contain those with Google Cloud api_id,
  // standardizing naming along the way.
  for (const repoMetadataKey in repoMetadata) {
    const metadata = repoMetadata[repoMetadataKey];

    if (!metadata.api_id) {
      continue;
    }

    // making naming more consistent, sometimes we've appended Cloud,
    // sometimes Google Cloud.
    metadata.name_pretty = metadata.name_pretty.replace(/^(Google )?Cloud /, '');

    if (metadata.product_documentation) {
      // add a link to the "Getting Support" page on the docs
      // examples:
      //     input: https://cloud.google.com/container-registry/docs/container-analysis
      //     output: https://cloud.google.com/container-registry/docs/getting-support
      //     input: https://cloud.google.com/natural-language/docs/
      //     output: https://cloud.google.com/natural-language/docs/getting-support
      let supportDocsUrl = metadata.product_documentation
        // guarantee trailing /
        .replace(/\/*$/, '/')
        // append "docs/getting-support" path, if not already there
        // this also strips anything else found after "docs/"
        .replace(/(docs\/(.+)*)*$/, 'docs/getting-support');

      // multiple product docs point to the same docs page
      if (metadata.name_pretty.toLowerCase().trim().startsWith('stackdriver')) {
        supportDocsUrl = 'https://cloud.google.com/stackdriver/docs/getting-support';
      }

      // if URL doesn't exist, fall back to the generic docs page
      const remoteUrlExists = (await fetch(supportDocsUrl, {method: 'HEAD'})).status !== 404;
      if (!remoteUrlExists) {
        supportDocsUrl = metadata.product_documentation;
      }
      metadata.support_documentation = supportDocsUrl;
    }

    libraries.push(metadata);
  }

  libraries.sort((a, b) => {
    return a.name_pretty.localeCompare(b.name_pretty);
  });
  writeFileSync('./libraries.json', JSON.stringify(libraries, null, 2), 'utf8');

  let partial = '';
  libraries.forEach((lib) => {
    partial += `| [${lib.name_pretty}](https://github.com/${lib.repo}) | [:notebook:](${lib.client_documentation}) | \`npm i ${lib.distribution_name}\` | [enable](https://console.cloud.google.com/flows/enableapi?apiid=${lib.api_id}) | ${lib.requires_billing ? figures.cross : figures.tick} |\n`;
  });

  writeFileSync('./README.md', template.replace('{{libraries}}', partial), 'utf8');
}

require('yargs')
  .command('$0', 'generate README from sloth list of repos', () => {}, async (_argv) => {
    argv = _argv;
    const repos = (await getContent('googleapis', 'sloth', 'repos.json')).repos;
    checkpoint('loaded list of repos from sloth');
    const repoMetadata = await collectRepoMetadata(repos);
    await generateReadme(repoMetadata);
  })
  .option('token', {
    describe: 'GitHub authorization token'
  })
  .parse();