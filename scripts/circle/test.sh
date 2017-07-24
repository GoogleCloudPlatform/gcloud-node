#!/bin/bash

# Copyright 2017 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

if [ "${CIRCLE_TAG}" != "" ] ||
   ([ "${CIRCLE_BRANCH}" == "master" ] && [ "${CI_PULL_REQUEST}" == "" ])
then
  # This is a tagged build or a push to master, so system tests will be run.
  echo $GCLOUD_TESTS_KEY | base64 --decode > ${HOME}/key.json
  export GCLOUD_TESTS_KEY="$HOME/key.json"

  echo $GCLOUD_TESTS_KEY_NON_WHITELIST | base64 --decode > ${HOME}/key.non-whitelist.json
  export GCLOUD_TESTS_KEY_NON_WHITELIST="$HOME/key.non-whitelist.json"
fi

git config --global user.name "circle-ci"
git config --global user.email "circle-ci@circleci.com"

export COVERALLS_REPO_TOKEN="vKZ7a3PpW0lRBRWC12dPw2EiZE5ml962J"
export CIRCLE_ARTIFACTS="$(pwd)/.coverage"

declare -a NODE_VERSIONS=(
  "4"
  "6"
  "7"
  "8"
)

for node_version in "${NODE_VERSIONS[@]}"; do
  build $node_version

  if [ "${node_version}" == "4" ]
  then
    npm run coveralls # only run coverage on first build
  fi
done

rebuild () {
  for dir in packages/*; do
    test -d "$dir" || continue
    cd $dir
    npm rebuild --update-binary
    cd ../../
  done
}

build () {
  echo "Testing on ${1}"

  nvm install "v${1}"
  nvm use "v${1}"
  npm install
  rebuild
  npm run lint

  node ./scripts/build.js
}

set +e
