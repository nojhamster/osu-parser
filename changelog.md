## last changes (not published on npm)
- [major] the beatmap is now divided into sections with timing properties and hitobjects
- map length now starts from the very beginning and not from the first timingpoint
- timingSignature, sampleSetId and sampleVolume now parsed into Integers
- beatLength now parsed into float

## 0.1.1
- bpm (string or integer) replaced by bpmMin and bpmMax (integers)

## 0.1.0
- fix number of slider edge sounds that could be wrong
- parse object additions
- parse sounds and additions on the edges of sliders
- parse integer strings
- get bezier endpoint coordinates
- points coordinates are now arrays of type [x,y]
- replace hitobject.x and hitobject.y by hitobject.position ([x,y])
- split tags into beatmap.tagsArray

## 0.0.5
- removed objectType and soundType properties from hitobjects as it's useless for the final user
- add velocity to timingPoints if beatLength is negative
- removed booleans whistle, finish and clap and add soundTypes array instead
- add repeatCount, pixelLength, curveType and pointsList to slider objects
- add edgeSounds to slider objects which contain a list of soundTypes arrays

## 0.0.4
- objectType bitwise flag enum is used to identify hitobjects
- add booleans whistle, finish, clap and newCombo to hitobjects

## 0.0.3
- add fileFormat property containing the osu file version (v7, v12...)
- parsing of timing points
- basic parsing of hit objects

## 0.0.2
- add parsing tests involving osu files from v7 to v12
- fix circles not recognized in v11 files

## 0.0.1
- first stable version with basic parsing
