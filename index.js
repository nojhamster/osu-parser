'use strict';

var fs   = require('fs');
var Lazy = require('lazy');

function Parser() {
  this.beatmap = {
    nbCircles: 0,
    nbSliders: 0,
    nbSpinners: 0,
    hitObjects: [],
    timingPoints: []
  };

  this.sectionReg     = /^\[([a-zA-Z0-9]+)\]$/;
  this.keyValReg      = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
  this.totalBreakTime = 0;
}

/**
 * Parse a single line and update the beatmap
 * @param  {String|Buffer} line
 */
Parser.prototype.parseLine = function (line) {
  line = line.toString().trim();
  if (!line) { return; }

  var match = this.sectionReg.exec(line);
  if (match) {
    this.section = match[1].toLowerCase();
    return;
  }

  switch (this.section) {
  case 'timingpoints':
    /**
     * The first member is the offset
     * If the second member is positive, it's a number of milliseconds per beat (bpm change)
     */
    var members = line.split(',');

    if (/^([0-9\.\-]+)$/.test(members[0]) && /^([0-9\.\-]+)$/.test(members[1])) {
      var timingPoint = {
        offset: members[0],
        beatLength: members[1],
        timingSignature: members[2],
        sampleSetId: members[3],
        useCustomSamples: (members[4] == 1),
        sampleVolume: members[5],
        timingChange: (members[6] == 1),
        kiaiTimeActive: (members[7] == 1)
      };

      var msPerBeat = parseFloat(timingPoint.beatLength);
      if (!isNaN(msPerBeat) && msPerBeat > 0) {
        var bpm = Math.round(60000 / msPerBeat);
        if (!this.bpmMin || this.bpmMin > bpm) { this.bpmMin = bpm; }
        if (!this.bpmMax || this.bpmMax < bpm) { this.bpmMax = bpm; }
        timingPoint.bpm = bpm;
      }

      this.beatmap.timingPoints.push(timingPoint);
    }
    break;
  case 'hitobjects':
    /**
     * The sixth member is used to differentiate object types
     * For circles, it can either be absent or be of type "0:0:0:0:" (additions)
     * For sliders, it starts with a letter and a pipe
     * For spinners, it's an integer representing the ending offset
     */
    var members = line.split(',');
    if (members.length < 5) return;

    var hitobject = {
      x: members[0],
      y: members[1],
      startTime: members[2],
      objectType: members[3],
      soundType: members[4]
    }

    // object type is a bitwise flag enum
    // 1: circle
    // 2: slider
    // 8: spinner
    var objectType = members[3];
    if ((objectType & 1) == 1) {
      this.beatmap.nbCircles++;
      hitobject.objectName = 'circle';
    } else if ((objectType & 2) == 2) {
      this.beatmap.nbSliders++;
      hitobject.objectName = 'slider';
    } else if ((objectType & 8) == 8) {
      this.beatmap.nbSpinners++;
      hitobject.objectName = 'spinner';
      hitobject.endTime    = members[5];
    } else {
      hitobject.objectName = 'unknown';
    }

    this.beatmap.hitObjects.push(hitobject);
    break;
  case 'events':
    /**
     * Background line : 0,0,"bg.jpg"
     * TODO: confirm that the second member is always zero
     *
     * Breaktimes lines : 2,1000,2000
     * second integer is start offset
     * third integer is end offset
     */
    var members = line.split(',');

    if (members[0] == '0' && members[1] == '0' && /^".*"$/.test(members[2])) {
      this.beatmap.bgFilename = members[2].substring(1, members[2].length - 1);
    } else if (members[0] == '2' && /^[0-9]+$/.test(members[1]) && /^[0-9]+$/.test(members[2])) {
      this.totalBreakTime += (members[2] - members[1]);
    }
    break;
  default:
    if (!this.section) {
      match = /^osu file format (v[0-9]+)$/.exec(line);
      if (match) { this.beatmap.fileFormat = match[1]; }
    }
    /**
     * Exluding in events, timingpoints and hitobjects sections, lines are "key: value"
     */
    match = this.keyValReg.exec(line);
    if (match) { this.beatmap[match[1]] = match[2]; }
  }
}

/**
 * Compute everything that require the file to be completely parsed and return the beatmap
 * @return {Object} beatmap
 */
Parser.prototype.finalizeBeatmap = function () {
  if (this.bpmMin && this.bpmMax) {
    if (this.bpmMin != this.bpmMax)
      this.beatmap.bpm = this.bpmMin + '~' + this.bpmMax;
    else
      this.beatmap.bpm = this.bpmMax;
  }

  var hitObjects   = this.beatmap.hitObjects;
  var timingPoints = this.beatmap.timingPoints;

  if (hitObjects.length && timingPoints.length) {
    var firstTimingOffset     = timingPoints[0].offset;
    var firstObjectOffset     = hitObjects[0].startTime;
    var lastObjectOffset      = hitObjects[hitObjects.length-1].startTime;

    this.beatmap.totalTime    = Math.ceil((lastObjectOffset - firstTimingOffset) / 1000);
    this.beatmap.drainingTime = Math.ceil((lastObjectOffset - firstObjectOffset - this.totalBreakTime) / 1000);
  } else {
    this.beatmap.totalTime    = 0;
    this.beatmap.drainingTime = 0;
  }

  return this.beatmap;
}

/**
 * Parse a .osu file
 * @param  {String}   file  path to the file
 * @param  {Function} callback(err, beatmap)
 */
exports.parseFile = function (file, callback) {
  fs.exists(file, function (exists) {
    if (!exists) {
      callback(new Error('file does not exist'));
      return;
    }

    var parser = new Parser();

    var lazy = new Lazy(fs.createReadStream(file));
    lazy
    .map(String)
    .lines
    .forEach(function (line) { parser.parseLine(line); });

    lazy.on('end', function () {
      var beatmap = parser.finalizeBeatmap();
      callback(null, beatmap);
    });
  });
};

/**
 * Parse a stream containing .osu content
 * @param  {Stream}   stream
 * @param  {Function} callback(err, beatmap)
 */
exports.parseStream = function (stream, callback) {
  var parser = new Parser();
  var lazy = new Lazy(stream);
  lazy
  .map(String)
  .lines
  .forEach(function (line) { parser.parseLine(line); });

  lazy.on('error', function (err) {
    callback(err);
  });

  lazy.on('end', function () {
    var beatmap = parser.finalizeBeatmap();
    callback(null, beatmap);
  });
};

/**
 * Parse the content of a .osu
 * @param  {String|Buffer} content
 * @return {Object} beatmap
 */
exports.parseContent = function (content) {
  var parser = new Parser();
  content.toString().split(/[\n\r]+/).forEach(function (line) {
    parser.parseLine(line);
  });

  return parser.finalizeBeatmap();
};