'use strict';

var fs         = require('fs');
var slidercalc = require('./lib/slidercalc.js');

function beatmapParser() {
  var beatmap = {
    nbCircles: 0,
    nbSliders: 0,
    nbSpinners: 0,
    timingPoints: [],
    breakTimes: [],
    hitObjects: [],
    storyboard: {}
  };

  var osuSection;
  var currentSprite;
  var currentLoop;
  var bpmMin;
  var bpmMax;
  var members;

  var timingLines    = [];
  var objectLines    = [];
  var eventsLines    = [];
  var sectionReg     = /^\[([a-zA-Z0-9]+)\]$/;
  var keyValReg      = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
  var curveTypes     = {
    C: "catmull",
    B: "bezier",
    L: "linear",
    P: "pass-through"
  };

  var eventTypes = {
    'f':  'fade',
    'm':  'move',
    'mx': 'move-x',
    'my': 'move-y',
    's':  'scale',
    'v':  'vector-scale',
    'r':  'rotate',
    'c':  'colour',
    'l':  'loop',
    't':  'trigger',
    'p':  'parameters'
  };

  var easings = {
    '0':  'linear',
    '1':  'easing-out',
    '2':  'easing-in',
    '3':  'quad-in',
    '4':  'quad-out',
    '5':  'quad-in/out',
    '6':  'cubic-in',
    '7':  'cubic-out',
    '8':  'cubic-in/out',
    '9':  'quart-in',
    '10': 'quart-out',
    '11': 'quart-in/out',
    '12': 'quint-in',
    '13': 'quint-out',
    '14': 'quint-in/out',
    '15': 'sine-in',
    '16': 'sine-out',
    '17': 'sine-in/out',
    '18': 'expo-in',
    '19': 'expo-out',
    '20': 'expo-in/out',
    '21': 'circ-in',
    '22': 'circ-out',
    '23': 'circ-in/out',
    '24': 'elastic-in',
    '25': 'elastic-out',
    '26': 'elastic-half-out',
    '27': 'elastic-quarter-out',
    '28': 'elastic-in/out',
    '29': 'back-in',
    '30': 'back-out',
    '31': 'back-in/out',
    '32': 'bounce-in',
    '33': 'bounce-out',
    '34': 'bounce-in/out'
  };

  /**
   * Get the timing point affecting a specific offset
   * @param  {Integer} offset
   * @return {Object} timingPoint
   */
  var getTimingPoint = function (offset) {
    for (var i = 0, l = beatmap.timingPoints.length; i < l; i++) {
      if (beatmap.timingPoints[i].offset <= offset) { return beatmap.timingPoints[i]; }
    }
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

    var timingPoint = {
      offset:           parseInt(members[0]),
      beatLength:       parseFloat(members[1]),
      velocity:         1,
      timingSignature:  parseInt(members[2]),
      sampleSetId:      parseInt(members[3]),
      useCustomSamples: (members[4] == 1),
      sampleVolume:     parseInt(members[5]),
      timingChange:     (members[6] == 1),
      kiaiTimeActive:   (members[7] == 1)
    };

    if (!isNaN(timingPoint.beatLength) && timingPoint.beatLength !== 0) {
      if (timingPoint.beatLength > 0) {
        // If positive, beatLength is the length of a beat in milliseconds
        var bpm        = Math.round(60000 / timingPoint.beatLength);
        beatmap.bpmMin = beatmap.bpmMin ? Math.min(beatmap.bpmMin, bpm) : bpm;
        beatmap.bpmMax = beatmap.bpmMax ? Math.max(beatmap.bpmMax, bpm) : bpm;
        timingPoint.bpm    = bpm;
      } else {
        // If negative, beatLength is a velocity factor
        timingPoint.velocity = Math.abs(100 / timingPoint.beatLength);
      }
    }

    beatmap.timingPoints.push(timingPoint);
  };

  /**
   * Parse an object line
   * @param  {String} line
   */
  var parseHitObject = function (line) {
    members = line.split(',');

    var soundType  = members[4];
    var objectType = members[3];

    var hitObject = {
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
    if ((soundType & 2) == 2)              { hitObject.soundTypes.push('whistle'); }
    if ((soundType & 4) == 4)              { hitObject.soundTypes.push('finish');  }
    if ((soundType & 8) == 8)              { hitObject.soundTypes.push('clap');    }
    if (hitObject.soundTypes.length === 0) { hitObject.soundTypes.push('normal'); }

    /**
     * object type is a bitwise flag enum
     * 1: circle
     * 2: slider
     * 8: spinner
     */
    if ((objectType & 1) == 1) {
      // Circle
      beatmap.nbCircles++;
      hitObject.objectName = 'circle';
      hitObject.additions  = parseAdditions(members[5]);
    } else if ((objectType & 8) == 8) {
      // Spinner
      beatmap.nbSpinners++;
      hitObject.objectName = 'spinner';
      hitObject.endTime    = parseInt(members[5]);
      hitObject.additions  = parseAdditions(members[6]);
    } else if ((objectType & 2) == 2) {
      // Slider
      beatmap.nbSliders++;
      hitObject.objectName  = 'slider';
      hitObject.repeatCount = parseInt(members[6]);
      hitObject.pixelLength = parseInt(members[7]);
      hitObject.additions   = parseAdditions(members[10]);
      hitObject.edges       = [];
      hitObject.points      = [
        [hitObject.position[0], hitObject.position[1]]
      ];

      /**
       * Calculate slider duration
       */
      var timing = getTimingPoint(hitObject.startTime);

      if (timing) {
        var pxPerBeat      = beatmap.SliderMultiplier * 100 * timing.velocity;
        var beatsNumber    = (hitObject.pixelLength * hitObject.repeatCount) / pxPerBeat;
        hitObject.duration = Math.ceil(beatsNumber * timing.beatLength);
        hitObject.endTime  = hitObject.startTime + hitObject.duration;
      }

      /**
       * Parse slider points
       */
      var points = (members[5] || '').split('|');
      if (points.length) {
        hitObject.curveType = curveTypes[points[0]] || 'unknown';

        for (var i = 1, l = points.length; i < l; i++) {
          var coordinates = points[i].split(':');
          hitObject.points.push([
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
       * Get soundTypes and additions for each slider edge
       */
      for (var j = 0, lgt = hitObject.repeatCount + 1; j < lgt; j++) {
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

        hitObject.edges.push(edge);
      }

      // get coordinates of the slider endpoint
      var endPoint = slidercalc.getEndPoint(hitObject.curveType, hitObject.pixelLength, hitObject.points);
      if (endPoint && endPoint[0] && endPoint[1]) {
        hitObject.endPosition = [
          Math.round(endPoint[0]),
          Math.round(endPoint[1])
        ];
      } else {
        // If endPosition could not be calculated, approximate it by setting it to the last point
        hitObject.endPosition = hitObject.points[hitObject.points.length - 1];
      }
    } else {
      // Unknown
      hitObject.objectName = 'unknown';
    }

    beatmap.hitObjects.push(hitObject);
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

    if (members.length < 1) { return; }

    var firstMember = members[0].toLowerCase().trim();

    /**
     * Background
     */
    if (firstMember == '0') {
      if (members.length < 3) { return; }

      var bgName = members[2].trim();

      if (bgName.charAt(0) == '"' && bgName.charAt(bgName.length - 1) == '"') {
        beatmap.bgFilename = bgName.substring(1, bgName.length - 1);
      } else {
        beatmap.bgFilename = bgName;
      }
      return;
    }

    /**
     * Breaktime
     */
    if (firstMember == '2') {
      var startTime = parseInt(members[1]);
      var endTime = parseInt(members[2]);
      if (!isNaN(startTime) && !isNaN(endTime)) {
        beatmap.breakTimes.push({
          startTime: startTime,
          endTime: endTime
        });
      }
      return;
    }

    /**
     * Storyboard layer
     * Animation|Sprite,"layer","origin","filepath",x,y,frameCount,frameDelay,looptype
     */
    if (firstMember == 'sprite' || firstMember == 'animation') {
      if (members.length < 6) { return; }

      var layerName = members[1].toLowerCase();
      if (!beatmap.storyboard.hasOwnProperty([layerName])) { beatmap.storyboard[layerName] = []; }

      var spriteObject = {
        type: firstMember,
        origin: members[2].toLowerCase(),
        x: parseInt(members[4]),
        y: parseInt(members[5]),
        events: []
      };

      if (members[6]) { spriteObject.frameCount = parseInt(members[6]); }
      if (members[7]) { spriteObject.frameDelay = parseInt(members[7]); }
      if (members[8]) { spriteObject.loopType   = members[8].toLowerCase(); }

      var filePath = members[3].trim();
      if (filePath.charAt(0) == '"' && filePath.charAt(filePath.length - 1) == '"') {
        spriteObject.filePath = filePath.substring(1, filePath.length - 1);
      } else {
        spriteObject.filePath = filePath;
      }

      currentSprite = spriteObject;
      beatmap.storyboard[layerName].push(spriteObject);
      return;
    }

    /**
     * Storyboard event
     * _event,easing,starttime,endtime,[params]
     *
     * TODO: handle shorthands
     */
    if (/^_*[a-z]{1,2}$/.test(firstMember)) {
      if (!currentSprite) { return; }

      /**
       * Loop
       */
      if (firstMember == 'l') {
        currentLoop = {
          type: 'loop',
          startTime: parseInt(members[1]),
          loopCount: parseInt(members[2]),
          events: []
        };
        currentSprite.events.push(currentLoop);
        return;
      }

      /**
       * Trigger
       */
      if (firstMember == 't') {
        currentLoop = {
          type: 'trigger',
          startTime: parseInt(members[2]),
          loopCount: parseInt(members[3]),
          events: []
        };
        currentSprite.events.push(currentLoop);
        return;
      }

      /**
       * Parameters
       */
      // if (firstMember == 'p') {
      // }

      var osuEvent = {
        type: eventTypes[firstMember],
        startTime: parseInt(members[2]),
        endTime: parseInt(members[3]),
        easing: easings[members[1]]
      };


      switch (osuEvent.type) {
        case 'move':
        case 'vector-scale': // (width and height separately)
          osuEvent.from = [parseFloat(members[4]), parseFloat(members[5])];
          osuEvent.to   = [parseFloat(members[6]), parseFloat(members[7])];
          break;
        case 'scale':
        case 'fade':
        case 'rotate': // (values in radians)
        case 'move-x':
        case 'move-y':
          osuEvent.from = parseFloat(members[4]);
          osuEvent.to   = parseFloat(members[5]);
          break;
        case 'colour':
          osuEvent.from = {
            r: parseFloat(members[4]),
            g: parseFloat(members[5]),
            b: parseFloat(members[6])
          };
          osuEvent.to = {
            r: parseFloat(members[7]),
            g: parseFloat(members[8]),
            b: parseFloat(members[9])
          };
          break;
      }

      var inLoop = (members[0].substr(0,2).replace('__', '  ') === '  ');

      if (inLoop) {
        if (currentLoop) { currentLoop.events.push(osuEvent); }
      } else {
        currentSprite.events.push(osuEvent);
      }
    }
  };

  /**
   * Compute the total time and the draining time of the beatmap
   */
  var computeDuration = function () {
    var firstObject = beatmap.hitObjects[0];
    var lastObject  = beatmap.hitObjects[beatmap.hitObjects.length - 1];

    var totalBreakTime = 0;

    beatmap.breakTimes.forEach(function (breakTime) {
      totalBreakTime += (breakTime.endTime - breakTime.startTime);
    });

    if (firstObject && lastObject) {
      beatmap.totalTime    = Math.floor(lastObject.startTime / 1000);
      beatmap.drainingTime = Math.floor((lastObject.startTime - firstObject.startTime - totalBreakTime) / 1000);
    } else {
      beatmap.totalTime    = 0;
      beatmap.drainingTime = 0;
    }
  };

  /**
   * Browse objects and compute max combo
   */
  var computeMaxCombo = function () {
    if (beatmap.timingPoints.length === 0) { return; }

    var maxCombo         = 0;
    var sliderMultiplier = parseFloat(beatmap.SliderMultiplier);
    var sliderTickRate   = parseInt(beatmap.SliderTickRate, 10);

    var timingPoints  = beatmap.timingPoints;
    var currentTiming = timingPoints[0];
    var nextOffset    = timingPoints[1] ? timingPoints[1].offset : Infinity;
    var i = 1;

    beatmap.hitObjects.forEach(function (hitObject) {
      if (hitObject.startTime >= nextOffset) {
        currentTiming = timingPoints[i++];
        nextOffset = timingPoints[i] ? timingPoints[i].offset : Infinity;
      }

      var osupxPerBeat = sliderMultiplier * 100 * currentTiming.velocity;
      var tickLength   = osupxPerBeat / sliderTickRate;

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

    beatmap.maxCombo = maxCombo;
  };

  /**
   * Read a single line, parse when key/value, store when further parsing needed
   * @param  {String|Buffer} line
   */
  var readLine = function (line) {
    line = line.toString();
    if (!line.trim()) { return; }

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
       * Apart from events, timingpoints and hitobjects sections, lines are "key: value"
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
    beatmap.breakTimes.sort(function (a, b) { return (a.startTime > b.startTime ? 1 : -1); });

    timingLines.forEach(parseTimingPoint);
    beatmap.timingPoints.sort(function (a, b) { return (a.offset > b.offset ? 1 : -1); });

    var timingPoints = beatmap.timingPoints;

    for (var i = 1, l = timingPoints.length; i < l; i++) {
      if (!timingPoints[i].hasOwnProperty('bpm')) {
        timingPoints[i].bpm = timingPoints[i - 1].bpm;
      }
    }

    objectLines.forEach(parseHitObject);
    beatmap.hitObjects.sort(function (a, b) { return (a.startTime > b.startTime ? 1 : -1); });

    computeMaxCombo();
    computeDuration();

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
    var stream = fs.createReadStream(file);
    var buffer = '';


    stream.on('data', function (chunk) {
      buffer   += chunk;
      var lines = buffer.split(/\r?\n/);
      buffer    = lines.pop() || '';
      lines.forEach(parser.readLine);
    });

    stream.on('error', function (err) {
      callback(err);
    });

    stream.on('end', function () {
      buffer.split(/\r?\n/).forEach(parser.readLine);
      callback(null, parser.buildBeatmap());
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
  var buffer = '';

  stream.on('data', function (chunk) {
    buffer   += chunk.toString();
    var lines = buffer.split(/\r?\n/);
    buffer    = lines.pop() || '';
    lines.forEach(parser.readLine);
  });

  stream.on('error', function (err) {
    callback(err);
  });

  stream.on('end', function () {
    buffer.split(/\r?\n/).forEach(parser.readLine);
    callback(null, parser.buildBeatmap());
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