osu-parser
==========

converts osu files into javascript objects

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

## What it returns

All key/value pairs are added to the resulting object with a lowercased key :
```
PreviewTime: 42860
```
```
beatmap: { previewtime: 42860 }
```

Additionnal infos are computed :  
`nbcircles` : number of circles.  
`nbsliders` : number of sliders.  
`nbspinners` : number of spinners.  
`bpm` : a single number if constant (ex `150`), or min~max (ex `140~180`).  
`totaltime` : total time in seconds between first timing line and last object offset.  
`drainingtime` : song draining time in seconds.  


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
