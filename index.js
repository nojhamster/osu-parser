'use strict';

var fs         = require('fs');
var Lazy       = require('lazy');
var slidercalc = require('./lib/slidercalc.js');

function Parser() {
  this.beatmap = {
    nbCircles: 0,
    nbSliders: 0,
    nbSpinners: 0,
    sections: []
  };

  this.sectionReg     = /^\[([a-zA-Z0-9]+)\]$/;
  this.keyValReg      = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
  this.totalBreakTime = 0;
  this.curveTypes     = {
    C: "catmull",
    B: "bezier",
    L: "linear",
    P: "pass-through"
  };
}

/**
 * Get the section an offset belongs to
 * @param  {Integer} offset
 * @return {Object}  section
 */
Parser.prototype.getSection = function (offset) {
  var section;
  for (var i = 0, l = this.beatmap.sections.length; i < l; i++) {
    if (this.beatmap.sections[i].offset > offset) { return this.beatmap.sections[i]; }
  };
  return this.beatmap.sections[this.beatmap.sections.length - 1];
};

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
    var members = line.split(',');

    var section = {
      offset:           parseInt(members[0]),
      beatLength:       members[1],
      timingSignature:  members[2],
      sampleSetId:      members[3],
      useCustomSamples: (members[4] == 1),
      sampleVolume:     members[5],
      timingChange:     (members[6] == 1),
      kiaiTimeActive:   (members[7] == 1),
      hitObjects: []
    };

    var beatLength = parseFloat(section.beatLength);
    if (!isNaN(beatLength) && beatLength != 0) {
      if (beatLength > 0) {
        // If positive, beatLength is the length of a beat in milliseconds
        var bpm = Math.round(60000 / beatLength);
        this.beatmap.bpmMin = this.beatmap.bpmMin ? Math.min(this.bpmMin || null, bpm) : bpm;
        this.beatmap.bpmMax = this.beatmap.bpmMax ? Math.min(this.bpmMax || null, bpm) : bpm;
        section.bpm = bpm;
      } else {
        // If negative, beatLength is a velocity factor
        section.velocity = Math.abs(100 / beatLength);
      }
    }

    this.beatmap.sections.push(section)
    this.beatmap.sections.sort(function (s1, s2) {
      return (s1.offset < s2.offset ? -1 : 1);
    });
    break;
  case 'hitobjects':
    var members = line.split(',');

    var soundType  = members[4];
    var objectType = members[3];

    var hitobject = {
      startTime:  parseInt(members[2]),
      newCombo:   ((objectType & 4) == 4),
      soundTypes: [],
      position: [
        parseInt(members[0]),
        parseInt(members[1])
      ]
    }

    /**
     * sound type is a bitwise flag enum
     * 0 : normal
     * 2 : whistle
     * 4 : finish
     * 8 : clap
     */
    if ((soundType & 2) == 2)              { hitobject.soundTypes.push('whistle'); }
    if ((soundType & 4) == 4)              { hitobject.soundTypes.push('finish');  }
    if ((soundType & 8) == 8)              { hitobject.soundTypes.push('clap');    }
    if (hitobject.soundTypes.length === 0) { hitobject.soundTypes.push('normal'); }

    /**
     * object type is a bitwise flag enum
     * 1: circle
     * 2: slider
     * 8: spinner
     */
    if ((objectType & 1) == 1) {
      // Circle
      this.beatmap.nbCircles++;
      hitobject.objectName = 'circle';
      hitobject.additions  = this.parseAdditions(members[5]);
    } else if ((objectType & 8) == 8) {
      // Spinner
      this.beatmap.nbSpinners++;
      hitobject.objectName = 'spinner';
      hitobject.endTime    = parseInt(members[5]);
      hitobject.additions  = this.parseAdditions(members[6]);
    } else if ((objectType & 2) == 2) {
      // Slider
      this.beatmap.nbSliders++;
      hitobject.objectName  = 'slider';
      hitobject.repeatCount = parseInt(members[6]);
      hitobject.pixelLength = parseInt(members[7]);
      hitobject.additions   = this.parseAdditions(members[10]);
      hitobject.edges       = [];
      hitobject.points      = [
        [hitobject.position[0], hitobject.position[1]]
      ];

      /**
       * Parse slider points
       */
      var points = (members[5] || '').split('|');
      if (points.length) {
        hitobject.curveType = this.curveTypes[points[0]] || 'unknown';

        for (var i = 1, l = points.length; i < l; i++) {
          var coordinates = points[i].split(':');
          hitobject.points.push([
            parseInt(coordinates[0]),
            parseInt(coordinates[1])
          ]);
        }
      }

      var edgeSounds    = [];
      var edgeAdditions = [];
      if (members[8]) { edgeSounds    = members[8].split('|'); }
      if (members[9]) { edgeAdditions = members[9].split('|'); }

      /**
       Get soundTypes and additions for each slider edge
       */
      for (var i = 0, l = hitobject.repeatCount + 1; i < l; i++) {
        var edge = {
          soundTypes: [],
          additions: this.parseAdditions(edgeAdditions[i])
        };

        if (edgeSounds[i]) {
          var sound = edgeSounds[i];
          if ((sound & 2) == 2)             { edge.soundTypes.push('whistle'); }
          if ((sound & 4) == 4)             { edge.soundTypes.push('finish');  }
          if ((sound & 8) == 8)             { edge.soundTypes.push('clap');    }
          if (edge.soundTypes.length === 0) { edge.soundTypes.push('normal');  }
        } else {
          edge.soundTypes.push('normal');
        }

        hitobject.edges.push(edge);
      }

      // get coordinates of the slider endpoint
      var endPoint = slidercalc.getEndPoint(hitobject.curveType, hitobject.pixelLength, hitobject.points);
      if (endPoint && endPoint[0] && endPoint[1]) {
        hitobject.endPosition = [
          Math.round(endPoint[0]),
          Math.round(endPoint[1])
        ];
      }
    } else {
      // Unknown
      hitobject.objectName = 'unknown';
    }

    var section = this.getSection(hitobject.startTime);
    section.hitObjects.push(hitobject);
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
      if (match) {
        this.beatmap.fileFormat = match[1];
        return;
      }
    }
    /**
     * Exluding in events, timingpoints and hitobjects sections, lines are "key: value"
     */
    match = this.keyValReg.exec(line);
    if (match) { this.beatmap[match[1]] = match[2]; }
  }
}

/**
 * Parse additions member
 * @param  {String} str         additions member (sample:add:customSampleIndex:Volume:hitsound)
 * @return {Object} additions   a list of additions
 */
Parser.prototype.parseAdditions = function (str) {
  if (!str) return {};

  var additions = {};
  var adds      = str.split(':');

  if (adds[0] && adds[0] !== '0') {
    var sample;
    switch (adds[0]) {
      case '1':
        sample = 'normal';
        break;
      case '2':
        sample = 'soft';
        break;
      case '3':
        sample = 'drum';
        break;
    }
    additions.sample = sample;
  }

  if (adds[1] && adds[1] !== '0') {
    var addSample;
    switch (adds[1]) {
      case '1':
        addSample = 'normal';
        break;
      case '2':
        addSample = 'soft';
        break;
      case '3':
        addSample = 'drum';
        break;
    }
    additions.additionalSample = addSample;
  }

  if (adds[2] && adds[2] !== '0') { additions.customSampleIndex = parseInt(adds[2]); }
  if (adds[3] && adds[3] !== '0') { additions.hitsoundVolume    = parseInt(adds[3]); }
  if (adds[4])                    { additions.hitsound          = adds[4]; }

  return additions;
}
/**
 * Compute everything that require the file to be completely parsed and return the beatmap
 * @return {Object} beatmap
 */
Parser.prototype.finalizeBeatmap = function () {
  if (this.beatmap['Tags']) {
    this.beatmap.tagsArray = this.beatmap['Tags'].split(' ');
  }

  var sections = this.beatmap.sections;
  var firstObjectOffset;
  var lastObjectOffset;
  var lgt;

  //Get first object offset
  for (var i = 0, l = sections.length; i < l; i++) {
    lgt = sections[i].hitObjects.length;
    if (lgt > 0) {
      firstObjectOffset = sections[i].hitObjects[0].startTime;
      break;
    }
  };

  //Get last object offset
  for (var i = sections.length - 1; i >= 0; i--) {
    lgt = sections[i].hitObjects.length;
    if (lgt > 0) {
      lastObjectOffset = sections[i].hitObjects[lgt - 1].startTime;
      break;
    }
  };

  if (firstObjectOffset && lastObjectOffset) {
    this.beatmap.totalTime    = Math.floor(lastObjectOffset / 1000);
    this.beatmap.drainingTime = Math.floor((lastObjectOffset - firstObjectOffset - this.totalBreakTime) / 1000);
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
  var lazy   = new Lazy(stream);
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