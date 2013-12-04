## last changes (not published on npm)
- removed objectType and soundType properties from hitobjects as it's useless for the final user
- add velocity to timingPoints if beatLength is negative

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
