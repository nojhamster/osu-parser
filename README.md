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
- [Changelog](https://github.com/nojhamster/osu-parser/blob/master/changelog.md)

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

### Additionnal beatmap properties :  
<table>
  <tr>
    <th>name</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr><td>fileFormat</td><td>String</td><td>osu file format (v7, v12...).</td></tr>
  <tr><td>nbCircles</td><td>Integer</td><td>number of circles.</td></tr>
  <tr><td>nbSliders</td><td>Integer</td><td>number of sliders.</td></tr>
  <tr><td>nbSpinners</td><td>Integer</td><td>number of spinners.</td></tr>
  <tr><td>bpm</td><td>Integer or String</td><td>a single number if constant (ex `150`), or min~max (ex `140~180`).<br/>This behaviour might change</td></tr>
  <tr><td>totalTime</td><td>Integer</td><td>total time in seconds (between the first timing point and the last object).</td></tr>
  <tr><td>drainingTime</td><td>Integer</td><td>draining time in seconds.</td></tr>
  <tr><td>hitObjects</td><td>Array</td><td>list of all hit objects. See HitObject below.</td></tr>
  <tr><td>timingPoints</td><td>Array</td><td>list of all timing points. See TimingPoint below.</td></tr>
</table>

#### HitObject properties
<table>
  <tr>
    <th>name</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr><td>objectName</td><td>String</td><td>circle, slider, spinner or unknown.</td></tr>
  <tr><td>position</td><td>Array[Integer]</td><td>object position : [x,y]</td></tr>
  <tr><td>startTime</td><td>Integer</td><td>start offset.</td></tr>
  <tr><td>newCombo</td><td>Boolean</td><td>is it a new combo ?</td></tr>
  <tr><td>soundTypes</td><td>Array</td><td>list of sound effects. Those can be : <code>normal</code>, <code>whistle</code>, <code>finish</code>, <code>clap</code>.</td></tr>
  <tr><td>additions</td><td>Object</td>
    <td>
      hitobject specific additions. It can have those properties :
      <br/>-<code>sample</code>: object specific sample. It can be : <code>soft</code>, <code>normal</code>, <code>drum</code>.
      <br/>-<code>additionalSample</code>: a sample to add along with the current one. It can be : <code>soft</code>, <code>normal</code>, <code>drum</code>.
      <br/>-<code>customSampleIndex</code>: index of the custom sample to use (ex: normal-2).
      <br/>-<code>hitsoundVolume</code>: specific volume for this object (require <code>hitsound</code> to be an existing file).
      <br/>-<code>hitsound</code>: an file to use as hitsound. It disables all other hitsounds.
    </td>
  </tr>
</table>

##### Slider specific properties
<table>
  <tr>
    <th>name</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr><td>repeatCount</td><td>Integer</td><td>number of repeats, starts at <code>1</code> for a single-way slider.</td></tr>
  <tr><td>pixelLength</td><td>Integer</td><td>length in osu-relative pixels.</td></tr>
  <tr><td>curveType</td><td>String</td><td>can be catmull, bezier, linear or pass-through.</td></tr>
  <tr><td>points</td><td>Array</td><td>list of all points including the very first. Each point is an array of coordinates [x,y].</td></tr>
  <tr><td>endPosition</td><td>Array</td><td>coordinates of the slider end ([x,y]).</td></tr>
  <tr><td>edges</td><td>Array</td>
    <td>
      list of edges. The number of edges is <code>repeatCount + 1</code>. It has two properties :
      <br/>-<code>soundTypes</code>: list of sound effects. Those can be : normal, whistle, finish, clap.
      <br/>-<code>additions</code>: edge additions. Same as hitobject additions, but can only have <code>sample</code> and <code>additionalSample</code>.
    </td>
  </tr>
</table>

##### Spinner specific properties
<table>
  <tr>
    <th>name</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr><td>endTime</td><td>Integer</td><td>end offset.</td></tr>
</table>

#### TimingPoint properties
<table>
  <tr>
    <th>name</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr><td>offset</td><td>Integer</td><td>section offset in milliseconds.</td></tr>
  <tr><td>beatLength</td><td>Integer</td><td>length of a single beat in milliseconds (float). If negative, it's a change of velocity.</td></tr>
  <tr><td>bpm</td><td>Float</td><td>number of beats per minute. (only if beatLength is positive)</td></tr>
  <tr><td>velocity</td><td>Float</td><td>velocity multiplicator. (only if beatLength is negative)</td></tr>
  <tr><td>timingSignature</td><td>Integer</td><td>3 = simple triple, 4 = simple quadruple (used in editor).</td></tr>
  <tr><td>sampleSetId</td><td>Integer</td><td>sound samples. None = 0, Normal = 1, Soft = 2.</td></tr>
  <tr><td>useCustomSamples</td><td>Boolean</td><td>use skin localised samples ?</td></tr>
  <tr><td>sampleVolume</td><td>Integer</td><td>volume of the samples.</td></tr>
  <tr><td>timingChange</td><td>Boolean</td><td>is there a beatLength change ?</td></tr>
  <tr><td>kiaiTimeActive</td><td>Boolean</td><td>is it a kiai section ?</td></tr>
</table>

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
- split tags into an array
- translate the samplesetId of timing points
- get the coordinates of the second slider circle
- parse events
- compute max score
- evaluate map difficulty ? (probably too complicated)
- add a synchronous version of parseFile
- support taiko, CTB and osu!mania ? (not sure that would be useful)
- make it usable in a browser ? (not sure that would be useful)
- ...

**Feel free to make suggestions !**
