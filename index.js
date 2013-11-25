'use strict';

var fs   = require('fs');
var Lazy = require('lazy');

function Parser() {
  this.beatmap = {
    nbcircles: 0,
    nbsliders: 0,
    nbspinners: 0
  };

  this.sectionReg     = /^\[([a-zA-Z0-9]+)\]$/;
  this.keyValReg      = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
  this.lastOffset     = 0;
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
      if (this.firstTimingOffset === undefined) { this.firstTimingOffset = members[0]; }

      var msPerBeat = parseFloat(members[1]);
      if (!isNaN(msPerBeat) && msPerBeat > 0) {
        var bpm = Math.round((60 / msPerBeat) * 1000);
        if (!this.bpmMin || this.bpmMin > bpm) { this.bpmMin = bpm; }
        if (!this.bpmMax || this.bpmMax < bpm) { this.bpmMax = bpm; }
      }
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

    var sixth = members[5];
    if (!sixth || /^(?:[0-9]+:)+?/.test(sixth)) { this.beatmap.nbcircles++; }
    else if (/^[a-zA-Z]\|/.test(sixth))          { this.beatmap.nbsliders++; }
    else if (/^[0-9]+$/.test(sixth))             { this.beatmap.nbspinners++; }
    else return;

    this.lastOffset = members[2];
    if (this.firstObjectOffset === undefined) { this.firstObjectOffset = members[2]; }
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
      this.beatmap.bgfilename = members[2].substring(1, members[2].length - 1);
    } else if (members[0] == '2' && /^[0-9]+$/.test(members[1]) && /^[0-9]+$/.test(members[2])) {
      this.totalBreakTime += (members[2] - members[1]);
    }
    break;
  default:
    /**
     * Exluding in events, timingpoints and hitobjects sections, lines are "key: value"
     */
    match = this.keyValReg.exec(line);
    if (match) { this.beatmap[match[1].toLowerCase()] = match[2]; }
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

  this.firstTimingOffset = this.firstTimingOffset || 0;
  this.firstObjectOffset = this.firstObjectOffset || 0;

  this.beatmap.totaltime    = Math.ceil((this.lastOffset - this.firstTimingOffset) / 1000);
  this.beatmap.drainingtime = Math.ceil((this.lastOffset - this.firstObjectOffset - this.totalBreakTime) / 1000);

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