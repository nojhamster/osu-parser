'use strict';

var fs     = require('fs');
var path   = require('path');
var assert = require('assert');
var parser = require('..');

var v12_file   = path.join(__dirname, 'v12.osu');
var v12_result = JSON.parse(fs.readFileSync(path.join(__dirname, 'v12.json')));

function areSame(obj1, obj2) {
  if (Object.keys(obj1).length != Object.keys(obj2).length) return false;

  for (var p in obj1) {
    if (obj1[p] != obj2[p]) return false;
  }
  return true;
}

describe('Given a v12 osu file', function () {
  describe('the parser', function () {
    it('should correctly parse it from its path', function (done) {
      parser.parseFile(v12_file, function (err, beatmap) {
        assert.equal(err, undefined, 'an unexpected error occured');
        assert(areSame(beatmap, v12_result), 'the resulting beatmap is faulty');
        done();
      });
    });
    it('should correctly parse its content as a buffer', function (done) {
      var beatmap = parser.parseContent(fs.readFileSync(v12_file));
      assert(areSame(beatmap, v12_result), 'the resulting beatmap is faulty');
      done();
    });
    it('should correctly parse its content as a stream', function (done) {
      parser.parseStream(fs.createReadStream(v12_file), function (err, beatmap) {
        assert.equal(err, undefined, 'an unexpected error occured');
        assert(areSame(beatmap, v12_result), 'the resulting beatmap is faulty');
        done();
      });
    });
  });
});