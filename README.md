# mediarename 📹

A command line app to let you rename video files based on metadata.

Pulls metadata out of video files including time, recorder, and geodata to let
you rename your media how best makes sense. Super helpful for unifying video
from multiple sources.

NOTE: Depends on the system ffmpeg in your path. Install ffmpeg before running
this app. On Mac use `brew install ffmpeg`. On Linux or Windows you'll need to
work this out yourself.

## Usage

List available metadata on a video file:

```
npx mediarename --meta myfile.mp4
```

Batch rename video files:

```
npx mediarename --format '{date} - {location} - {recorder}' *.mp4
```