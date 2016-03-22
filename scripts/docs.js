/**
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var globby = require('globby');
var async = require('async');
var ent = require('ent');
var fs = require('fs');
var dox = require('dox');
var path = require('path');
var prop = require('propprop');
var spellchecker = require('spellchecker');
var striptags = require('striptags');

require('./dictionary.json').forEach(spellchecker.add);

var OUTPUT_FOLDER = './docs/json/master';
var IGNORE = [
  './lib/common/*',
  './lib/datastore/entity.js',
  './lib/datastore/pb.js',
  './lib/datastore/request.js',
  './lib/pubsub/iam.js',
  './lib/storage/acl.js'
];

function isPublic(block) {
  return !block.isPrivate && !block.ignore;
}

function detectLinks(str) {
  var reg = /\[([^\]]*)]{@link ([^}]*)}/g;

  return str.replace(reg, function(match, title, link) {
    return '<a href="' + link.trim() + '">' + title.trim() + '</a>';
  });
}

function formatHtml(html) {
  var formatted = (html || '')
    .replace(/\s+/g, ' ')
    .replace(/<br *\/*>/g, ' ')
    .replace(/`([^`]*)`/g, '<code>$1</code>');

  return detectLinks(detectCustomType(formatted));
}

function detectCustomType(str) {
  var rCustomType = /\{*module\:([^\}|\>]*)\}*/g;
  var rArray = /Array\.<(.+)>/g;

  return str
    .replace(rArray, function(match, module) {
      return module + '[]';
    })
    .replace(rCustomType, function(match, module) {
      return '<a data-custom-type="' + module + '"></a>';
    });
}

function getTagsByType(block, type) {
  return block.tags.filter(function(tag) {
    return tag.type === type;
  });
}

function createUniqueMethodList(list, method) {
  var matches = list.filter(function(item) {
    return item.name === method.name;
  });

  if (!matches.length) {
    list.push(method);
  }

  return list;
}

function getId(fileName) {
  var hooks = {
    'index': 'gcloud',
    'search/index-class': 'search/index'
  };

  var id = fileName
    .replace(/^(\.\/)?lib\//, '')
    .replace('/index.js', '')
    .replace('.js', '');

  return hooks[id] || id;
}

function getName(block) {
  if (!block) {
    return;
  }

  var alias = getTagsByType(block, 'alias')[0];

  if (alias && !/^module/.test(alias.string)) {
    return alias.string;
  }

  return block.ctx.name;
}

function getClassDesc(block) {
  if (!block) {
    return;
  }

  var classdesc = getTagsByType(block, 'classdesc')[0] || {};

  return formatHtml(classdesc.html);
}

function getParent(id) {
  var parent = id.replace(/\/.+/, '');

  return parent === id ? null : parent;
}

function getChildren(id) {
  var childrenGlob = './lib/' + id + '/*';

  return globby
    .sync(childrenGlob, { ignore: IGNORE })
    .map(getId)
    .filter(function(child) {
      return child !== id;
    });
}

function getMethodType(block) {
  if (block.isConstructor) {
    return 'constructor';
  }

  if (getTagsByType(block, 'static').length > 0) {
    return 'static';
  }

  return 'instance';
}

function createResource(tag) {
  var reg = /\[([^\]]*)]{@link ([^}]*)}/g;
  var resource = {};

  (tag.string || tag).replace(reg, function(match, title, link) {
    resource.title = title.trim();
    resource.link = link.trim();
  });

  return resource;
}

function createCaption(comment) {
  var caption = formatHtml(comment)
    .replace(/\/\/-*\s*/g, '\n')
    .replace(/(https*:)\W*/g, '$1//')
    .replace(/\n\n/g, '\n')
    .replace(/(\w)\n(\w)/g, '$1 $2')
    .replace(/\n\n/g, '</p><p>')
    .trim();

  return '<p>' + caption + '</p>';
}

function createExamples(block) {
  var examples = getTagsByType(block, 'example')[0];

  if (!examples) {
    return [];
  }

  var paragraphComments = /\/\/-+((\n|\r|.)*?(\/\/-))/g;

  if (!paragraphComments.test(examples.string)) {
    return [{ code: examples.string }];
  }

  var exampleBreak = /\n\n(?=\/\/-)/g;
  var codeBreak = /\/\/\-\n(?!\/\/)/;

  return examples.string
    .split(exampleBreak)
    .map(function(exampleBlock) {
      var example = {};
      var parts = exampleBlock.split(codeBreak);

      parts.forEach(function(part) {
        if (/^\/\/\-/.test(part)) {
          example.caption = createCaption(part);
          return;
        }

        example.code = part.trim();
      });

      return example;
    });
}

function createParam(tag) {
  return {
    name: tag.name,
    description: formatHtml(tag.description),
    types: tag.types.map(detectCustomType),
    optional: tag.optional,
    nullable: tag.nullable
  };
}

function createException(tag) {
  return {
    type: detectCustomType(tag.types[0]),
    description: formatHtml(tag.description)
  };
}

function createReturn(tag) {
  return {
    types: tag.types.map(detectCustomType),
    description: formatHtml(tag.description)
  };
}

function createMethod(fileName, parent, block) {
  var name = getName(block);

  return {
    id: [parent, name].join('#'),
    name: name,
    type: getMethodType(block),
    description: formatHtml(block.description.full),
    source: path.normalize(fileName) + '#L' + block.codeStart,
    resources: getTagsByType(block, 'resource').map(createResource),
    examples: createExamples(block),
    params: getTagsByType(block, 'param').map(createParam),
    exceptions: getTagsByType(block, 'throws').map(createException),
    returns: getTagsByType(block, 'return').map(createReturn)
  };
}

function getMixinMethods(comments) {
  return comments.filter(function(block) {
    return getTagsByType(block, 'mixes').length;
  }).map(function(block) {
    var mixin = getTagsByType(block, 'mixes')[0];
    var mixinFile = path.join('./lib', mixin.string.replace('module:', '') + '.js');
    var mixinContents = fs.readFileSync(mixinFile, 'utf8', true);
    var docs = parseFile(mixinFile, mixinContents);
    var methods = docs.methods.filter(function(method) {
      return method.type === 'instance';
    });
    var name;

    if (block.ctx.type === 'property') {
      name = block.ctx.string.replace(/^\w+\./, '');
      methods.forEach(function(method) {
        method.name = [name, method.name].join('.');
      });
    }

    return methods;
  }).reduce(function(methods, mixinMethods) {
    return methods.concat(mixinMethods);
  }, []);
}

function parseFile(fileName, contents) {
  var comments = dox.parseComments(contents).filter(isPublic);
  var constructor = comments.filter(prop('isConstructor'))[0];
  var id = getId(fileName);

  return {
    id: id,
    type: 'class',
    name: getName(constructor),
    description: getClassDesc(constructor),
    source: path.normalize(fileName),
    parent: getParent(id),
    children: getChildren(id),
    methods: comments
      .map(createMethod.bind(null, fileName, id))
      .concat(getMixinMethods(comments))
      .reduce(createUniqueMethodList, [])
  };
}

function createTypesDictionary(docs) {
  var types = [];

  docs.forEach(function(service) {
    service.methods.forEach(function(method) {
      var id = method.type === 'constructor' ? service.id : method.id;
      var contents = service.path.replace('docs/json/master/', '');
      var title = [id === 'gcloud' ? 'Node.js' : service.name];

      if (service.parent) {
        for (var i = 0, l = docs.length; i < l; i++) {
          if (docs[i].id === service.parent) {
            title.unshift(docs[i].name);
          }
        }
      }

      types.push({
        id: id,
        title: title.join(' » '),
        contents: contents
      });
    });
  });

  return types;
}

globby('./lib/*{,/*}.js', { ignore: IGNORE }).then(function(files) {
  async.map(files, function(file, callback) {
    fs.readFile(file, 'utf8', function(err, contents) {
      if (err) {
        callback(err);
        return;
      }

      var docs = parseFile(file, contents);

      var outputFile = path.join(
        OUTPUT_FOLDER,
        file.replace('/lib', '').replace('.js', '.json')
      );

      function writeFile() {
        fs.writeFile(outputFile, JSON.stringify(docs), function(err) {
          docs.path = outputFile;
          callback(err, docs);
        });
      }

      if (!spellchecker) {
        writeFile();
        return;
      }

      var descriptions = [];
      var misspellings = [];

      function findDescription(obj, parentMetadata) {
        // Remove code snippets.
        var description = obj.description.replace(/<code>.*<\/code>/g, '');

        if (obj.name) {
          spellchecker.add(obj.name);
        }

        if (obj.description) {
          descriptions.push({
            source: (parentMetadata || obj).source,
            text: ent.decode(striptags(description)).trim()
          });
        }
      }

      findDescription(docs);

      docs.methods.forEach(function(method) {
        findDescription(method);

        method.params.forEach(function(param) {
          findDescription(param, method);
        });
      });

      function lintDescription(description, callback) {
        var text = description.text
          .toLowerCase()
          .replace(/(\w)[.](\w)/g, '$1 $2') // "key.value" => "key value"
          .replace(/(\w*):(\w*)/g, '$1 $2') // "key:value" => "key value"
          .replace(/{(\w*)}/g, '$1 ') // "{key}" => "key "
          .replace(/(\w*)\/(\w*)/g, '$1 $2') // "key/value" => "key value"
          .replace(/-/g, ' ') // "hyphenated-word" => "hyphenated word"
          .replace(/[^\w\s-']/g, ' ')
          .split(' ');

        text.forEach(function(word) {
          if (word.indexOf('.') > -1) {
            return;
          }

          if (spellchecker.isMisspelled(word)) {
            misspellings.push('"' + word + '" (' + description.source + ')');
          }
        });

        callback();
      }

      async.each(descriptions, lintDescription, function(err) {
        if (!err && misspellings.length > 0) {
          err = new Error([
            'Misspellings found. Please correct them before pushing, or if the',
            'word caught is not actually misspelled, please add it to',
            'scripts/dictionary.json.',
            '\n\n' + misspellings[0] + '\n'
          ].join(' '));
        }

        if (err) {
          callback(err);
          return;
        }

        writeFile();
      });
    });
  }, function(err, docs) {
    if (err) {
      throw err;
    }

    var types = createTypesDictionary(docs);
    var outputFile = path.join(OUTPUT_FOLDER, 'types.json');

    fs.writeFile(outputFile, JSON.stringify(types), function(err) {
      if (err) {
        throw err;
      }
    });
  });
});
