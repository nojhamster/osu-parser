'use strict';

var fs     = require('fs');
var path   = require('path');
var util   = require('util');
var assert = require('assert');
var parser = require('..');

var versions = [7, 8, 9, 10, 11, 12];

function compareBeatmaps(obj1, obj2) {
  assert.equal(Object.keys(obj1).length, Object.keys(obj2).length, 'the resulting beatmap does not have the good number of attributes');

  for (var p in obj1) {
    switch (p) {
      case 'hitObjects':
      case 'timingPoints':
      case 'breakTimes':
      case 'tagsArray':
        assert.deepEqual(obj1[p], obj2[p], util.format('%s was not parsed correctly', p));
        break;
      default:
        assert.equal(obj1[p], obj2[p], util.format('Expecting %s to equal %s', p, obj2[p]));
    }
  }
}

versions.forEach(function (version) {
  describe('Given a v' + version + ' osu file', function () {
    var file   = path.join(__dirname, 'datasets', 'v' + version + '.osu');
    var result = JSON.parse(fs.readFileSync(path.join(__dirname, 'datasets', 'v' + version + '.json')));

    describe('the parser', function () {
      it('should correctly parse it from its path', function (done) {
        parser.parseFile(file, function (err, beatmap) {
          assert.equal(err, undefined, util.format('An unexpected error occured : %j', err));
          compareBeatmaps(beatmap, result);
          done();
        });
      });
      it('should correctly parse its content as a buffer', function (done) {
        var beatmap = parser.parseContent(fs.readFileSync(file));
        compareBeatmaps(beatmap, result);
        done();
      });
      it('should correctly parse its content as a stream', function (done) {
        parser.parseStream(fs.createReadStream(file), function (err, beatmap) {
          assert.equal(err, undefined, util.format('An unexpected error occured : %j', err));
          compareBeatmaps(beatmap, result);
          done();
        });
      });
    });
  });
});