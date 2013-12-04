osu-parser
==========
[![Build Status](https://travis-ci.org/nojhamster/osu-parser.png?branch=master)](https://travis-ci.org/nojhamster/osu-parser)

A parser that converts osu files into javascript objects. It's still at **early stage** and might get backward incompatible changes, however you can give it a try and **post issues** to help me improve it ;)

- [Installation](#installation)
- [Usage](#usage)
- [The resulting object](#the-resulting-object)
- [Methods](#methods)
	- [parseFile(filepath, callback)](#parsefilefilepath-callback)
	- [parseStream(stream, callback)](#parsestreamstream-callback)
	- [parseContent(content)](#parsecontentcontent)
- [TODO](#todo)

## Installation

```
npm install osu-parser
```

## Usage

```javascript
  var parser = require('osu-parser');
  
  parser.parseFile('path/to/map.osu', function (err, beatmap) {
    console.log(beatmap);
  });
```

## The resulting object

It contains all key/value pairs :
```
...
PreviewTime: 42860
...
```
```
beatmap: {
  ...
  PreviewTime: 42860,
  ...
}
```

### Additionnal attributes :  
`fileFormat` : osu file format (v7, v12...).  
`nbCircles` : number of circles.  
`nbSliders` : number of sliders.  
`nbSpinners` : number of spinners.  
`bpm` : a single number if constant (ex `150`), or min~max (ex `140~180`).  
`totalTime` : total time in seconds (between the first timing point and the last object).  
`drainingTime` : draining time in seconds.  
`hitObjects` : array of all hit objects. See HitObject below.  
`timingPoints` : array of all timing points. See TimingPoint below.  

### HitObject attributes
`objectName`: circle, slider, spinner or unknown.  
`x`: abscissa.  
`y`: ordinate.  
`startTime`: start offset.  
`newCombo`: is it a new combo ? (boolean)  
`whistle`: does it have a whistle effect ? (boolean)  
`finish`: does it have a finish effect ? (boolean)  
`clap`: does it have a clap effect ? (boolean)  

### TimingPoint attributes
  `offset`: section offset in milliseconds.  
  `beatLength`: length of a single beat in milliseconds (float). If negative, it's a change of velocity.  
  `bpm`: number of beats per minute. (only if beatLength is positive)  
  `velocity`: velocity multiplicator. (only if beatLength is negative)  
  `timingSignature`: 3 = simple triple, 4 = simple quadruple (used in editor).  
  `sampleSetId`: sound samples. None = 0, Normal = 1, Soft = 2.  
  `useCustomSamples`: use skin localised samples? (boolean)  
  `sampleVolume`: volume of the samples.  
  `timingChange`: is there a beatLength change ? (boolean)  
  `kiaiTimeActive`: is it a kiai section ? (boolean)  

## Methods

### parseFile(filepath, callback)
Parse the given file. The callback returns (error, beatmap).
```javascript
  var parser = require('osu-parser');
  
  parser.parseFile('path/to/map.osu', function (err, beatmap) {
    console.log(beatmap);
  });
```

### parseStream(stream, callback)
Parse a stream containing a file content. The callback returns (error, beatmap).
```javascript
  var parser = require('osu-parser');
  var fs     = require('fs');
  var stream = fs.createReadStream('path/to/map.osu');
  
  parser.parseStream(stream, function (err, beatmap) {
    console.log(beatmap);
  });
```

### parseContent(content)
Parse the content of a file as a string or a buffer.
```javascript
  var parser  = require('osu-parser');
  var fs      = require('fs');
  var content = fs.readFileSync('path/to/map.osu');
  
  var beatmap = parser.parseContent(content);
```

## TODO
- parse hitobjects additions
- parse all slider properties
- parse events
- evaluate map difficulty ? (probably too complicated)
- add a synchronous version of parseFile
- support taiko, CTB and osu!mania ? (not sure that would be useful)
- make it usable in a browser ? (not sure that would be useful)
- ...

**Feel free to make suggestions !**
