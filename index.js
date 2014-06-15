'use strict';

var fs         = require('fs');
var Lazy       = require('lazy');
var slidercalc = require('./lib/slidercalc.js');

function beatmapParser() {
  var beatmap = {
    nbCircles: 0,
    nbSliders: 0,
    nbSpinners: 0,
    sections: []
  };

  var osuSection;
  var bpmMin;
  var bpmMax;
  var members;

  var timingLines    = [];
  var objectLines    = [];
  var eventsLines    = [];
  var sectionReg     = /^\[([a-zA-Z0-9]+)\]$/;
  var keyValReg      = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
  var totalBreakTime = 0;
  var curveTypes     = {
    C: "catmull",
    B: "bezier",
    L: "linear",
    P: "pass-through"
  };

  /**
   * Get the section an offset belongs to
   * @param  {Integer} offset
   * @return {Object}  section
   */
  var getSection = function (offset) {
    var section;
    for (var i = 0, l = beatmap.sections.length; i < l; i++) {
      if (beatmap.sections[i].offset > offset) { return beatmap.sections[Math.max(--i, 0)]; }
    }
    return beatmap.sections[beatmap.sections.length - 1];
  };

  /**
   * Parse additions member
   * @param  {String} str         additions member (sample:add:customSampleIndex:Volume:hitsound)
   * @return {Object} additions   a list of additions
   */
  var parseAdditions = function (str) {
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
  };

  /**
   * Parse a timing line
   * @param  {String} line
   */
  var parseTimingPoint = function (line) {
    members = line.split(',');

    var section = {
      offset:           parseInt(members[0]),
      beatLength:       parseFloat(members[1]),
      velocity:         1,
      timingSignature:  parseInt(members[2]),
      sampleSetId:      parseInt(members[3]),
      useCustomSamples: (members[4] == 1),
      sampleVolume:     parseInt(members[5]),
      timingChange:     (members[6] == 1),
      kiaiTimeActive:   (members[7] == 1),
      hitObjects: []
    };

    if (!isNaN(section.beatLength) && section.beatLength !== 0) {
      if (section.beatLength > 0) {
        // If positive, beatLength is the length of a beat in milliseconds
        var bpm        = Math.round(60000 / section.beatLength);
        beatmap.bpmMin = beatmap.bpmMin ? Math.min(beatmap.bpmMin, bpm) : bpm;
        beatmap.bpmMax = beatmap.bpmMax ? Math.max(beatmap.bpmMax, bpm) : bpm;
        section.bpm    = bpm;
      } else {
        // If negative, beatLength is a velocity factor
        section.velocity = Math.abs(100 / section.beatLength);
      }
    }

    beatmap.sections.push(section);
    beatmap.sections.sort(function (s1, s2) {
      return (s1.offset < s2.offset ? -1 : 1);
    });
  };

  /**
   * Parse an object line
   * @param  {String} line
   */
  var parseHitObject = function (line) {
    members = line.split(',');

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
    };

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
      beatmap.nbCircles++;
      hitobject.objectName = 'circle';
      hitobject.additions  = parseAdditions(members[5]);
    } else if ((objectType & 8) == 8) {
      // Spinner
      beatmap.nbSpinners++;
      hitobject.objectName = 'spinner';
      hitobject.endTime    = parseInt(members[5]);
      hitobject.additions  = parseAdditions(members[6]);
    } else if ((objectType & 2) == 2) {
      // Slider
      beatmap.nbSliders++;
      hitobject.objectName  = 'slider';
      hitobject.repeatCount = parseInt(members[6]);
      hitobject.pixelLength = parseInt(members[7]);
      hitobject.additions   = parseAdditions(members[10]);
      hitobject.edges       = [];
      hitobject.points      = [
        [hitobject.position[0], hitobject.position[1]]
      ];

      /**
       * Parse slider points
       */
      var points = (members[5] || '').split('|');
      if (points.length) {
        hitobject.curveType = curveTypes[points[0]] || 'unknown';

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
      for (var j = 0, lgt = hitobject.repeatCount + 1; j < lgt; j++) {
        var edge = {
          soundTypes: [],
          additions: parseAdditions(edgeAdditions[j])
        };

        if (edgeSounds[j]) {
          var sound = edgeSounds[j];
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

    var matchingSection = getSection(hitobject.startTime);
    matchingSection.hitObjects.push(hitobject);
  };

  /**
   * Parse an event line
   * @param  {String} line
   */
  var parseEvent = function (line) {
    /**
     * Background line : 0,0,"bg.jpg"
     * TODO: confirm that the second member is always zero
     *
     * Breaktimes lines : 2,1000,2000
     * second integer is start offset
     * third integer is end offset
     */
    members = line.split(',');

    if (members[0] == '0' && members[1] == '0' && /^".*"$/.test(members[2])) {
      beatmap.bgFilename = members[2].substring(1, members[2].length - 1);
    } else if (members[0] == '2' && /^[0-9]+$/.test(members[1]) && /^[0-9]+$/.test(members[2])) {
      totalBreakTime += (members[2] - members[1]);
    }
  };

  /**
   * Browse objects and compute max combo
   */
  var computeMaxCombo = function () {
    var maxCombo         = 0;
    var sliderMultiplier = parseFloat(beatmap.SliderMultiplier);
    var sliderTickRate   = parseInt(beatmap.SliderTickRate, 10);

    beatmap.sections.forEach(function (section) {
      var osupxPerBeat = sliderMultiplier * 100 * section.velocity;
      var tickLength   = osupxPerBeat / sliderTickRate;

      section.hitObjects.forEach(function (hitObject) {
        switch (hitObject.objectName) {
          case 'spinner':
          case 'circle':
            maxCombo++;
            break;
          case 'slider':
            var tickPerSide = Math.ceil((Math.floor(hitObject.pixelLength / tickLength * 100) / 100) - 1);
            maxCombo += (hitObject.edges.length - 1) * (tickPerSide + 1) + 1;  // 1 combo for each tick and endpoint
        }
      });
    });

    beatmap.maxCombo = maxCombo;
  };

  /**
   * Read a single line, parse when key/value, store when needed further parsing
   * @param  {String|Buffer} line
   */
  var readLine = function (line) {
    line = line.toString().trim();
    if (!line) { return; }

    var match = sectionReg.exec(line);
    if (match) {
      osuSection = match[1].toLowerCase();
      return;
    }

    switch (osuSection) {
    case 'timingpoints':
      timingLines.push(line);
      break;
    case 'hitobjects':
      objectLines.push(line);
      break;
    case 'events':
      eventsLines.push(line);
      break;
    default:
      if (!osuSection) {
        match = /^osu file format (v[0-9]+)$/.exec(line);
        if (match) {
          beatmap.fileFormat = match[1];
          return;
        }
      }

      /**
       * Exluding in events, timingpoints and hitobjects sections, lines are "key: value"
       */
      match = keyValReg.exec(line);
      if (match) { beatmap[match[1]] = match[2]; }
    }
  };

  /**
   * Compute everything that require the file to be completely parsed and return the beatmap
   * @return {Object} beatmap
   */
  var buildBeatmap = function () {
    if (beatmap.Tags) {
      beatmap.tagsArray = beatmap.Tags.split(' ');
    }

    eventsLines.forEach(parseEvent);
    timingLines.forEach(parseTimingPoint);
    objectLines.forEach(parseHitObject);
    computeMaxCombo();

    var sections = beatmap.sections;
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
    }

    //Get last object offset
    for (var j = sections.length - 1; j >= 0; j--) {
      lgt = sections[j].hitObjects.length;
      if (lgt > 0) {
        lastObjectOffset = sections[j].hitObjects[lgt - 1].startTime;
        break;
      }
    }

    if (firstObjectOffset && lastObjectOffset) {
      beatmap.totalTime    = Math.floor(lastObjectOffset / 1000);
      beatmap.drainingTime = Math.floor((lastObjectOffset - firstObjectOffset - totalBreakTime) / 1000);
    } else {
      beatmap.totalTime    = 0;
      beatmap.drainingTime = 0;
    }

    return beatmap;
  };

  return {
    readLine: readLine,
    buildBeatmap: buildBeatmap
  };
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

    var parser = beatmapParser();

    var lazy = new Lazy(fs.createReadStream(file));
    lazy
    .map(String)
    .lines
    .forEach(function (line) { parser.readLine(line); });

    lazy.on('error', function (err) {
      callback(err);
    });

    lazy.on('end', function () {
      var beatmap = parser.buildBeatmap();
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
  var parser = beatmapParser();
  var lazy   = new Lazy(stream);
  lazy
  .map(String)
  .lines
  .forEach(function (line) { parser.readLine(line); });

  lazy.on('error', function (err) {
    callback(err);
  });

  lazy.on('end', function () {
    var beatmap = parser.buildBeatmap();
    callback(null, beatmap);
  });
};

/**
 * Parse the content of a .osu
 * @param  {String|Buffer} content
 * @return {Object} beatmap
 */
exports.parseContent = function (content) {
  var parser = beatmapParser();
  content.toString().split(/[\n\r]+/).forEach(function (line) {
    parser.readLine(line);
  });

  return parser.buildBeatmap();
};