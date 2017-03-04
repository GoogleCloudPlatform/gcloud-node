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

if [ "${CIRCLE_BRANCH}" != "master" ] && [ "${CI_PULL_REQUEST}" != "" ]
then
  # Not a push to master, so no doc updates required.
  exit 0
fi

set +e # allows `git` commands during prepare-ghpages to fail

npm run prepare-ghpages

cd gh-pages
git push origin gh-pages

cd ..
npm run remove-ghpages

# amend will remove `gh-pages` directory from previous commit
# if it fails, that means the commit would be empty
git commit --amend -C HEAD -n

if [ $? != 0 ]
then
  echo "No changes to master branch."
  exit 0
fi

git push origin master --follow-tags
