'use strict';

var fs     = require('fs');
var path   = require('path');
var assert = require('assert');
var parser = require('..');

var versions = [7, 8, 9, 10, 11, 12];

function areSame(obj1, obj2) {
  if (Object.keys(obj1).length != Object.keys(obj2).length) return false;

  for (var p in obj1) {
    if (obj1[p] != obj2[p]) return false;
  }
  return true;
}

versions.forEach(function (version) {
  var file   = path.join(__dirname, 'datasets', 'v' + version + '.osu');
  var result = JSON.parse(fs.readFileSync(path.join(__dirname, 'datasets', 'v' + version + '.json')));

  describe('Given a v' + version + ' osu file', function () {
    describe('the parser', function () {
      it('should correctly parse it from its path', function (done) {
        parser.parseFile(file, function (err, beatmap) {
          assert.equal(err, undefined, 'an unexpected error occured');
          assert(areSame(beatmap, result), 'the resulting beatmap is faulty');
          done();
        });
      });
      it('should correctly parse its content as a buffer', function (done) {
        var beatmap = parser.parseContent(fs.readFileSync(file));
        assert(areSame(beatmap, result), 'the resulting beatmap is faulty');
        done();
      });
      it('should correctly parse its content as a stream', function (done) {
        parser.parseStream(fs.createReadStream(file), function (err, beatmap) {
          assert.equal(err, undefined, 'an unexpected error occured');
          assert(areSame(beatmap, result), 'the resulting beatmap is faulty');
          done();
        });
      });
    });
  });
});