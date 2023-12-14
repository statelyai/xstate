# Welcome to the world's most niche Media Scanner!

## What?

It's a small project that crawls a directory full of movies and separates out the 4K content. (well, specifically, content over 1080p). **This project is not intended for production use. Just a script I wrote out of laziness.**

## Why?

I have a lot of media files in my personal library, and I'm learning about the best ways to encode, host, and serve these files. As time has gone by, I realized that when transcoding media, different settings should be used for 4K content than should be used for 1080p content. And it's difficult to run a batch job over all the files and dynamically change settings, so here we are, with the need to have 2 movie locations, 1 for 4K content and 1 for everything else

## Really? Is that it?

Well, no. See I work at [Stately](https://stately.ai/) an awesome company centered around building deterministic flows. This was a great excuse to build one of those flows and dogfood our own product. So you're welcome.

## How to use?

This project requires `ffprobe`, a binary that ships alongside `ffmpeg`, which is the golden standard for media file manipulation.

- [Install ffmpeg here](https://ffmpeg.org/download.html)
- Clone this repo and run `yarn` (or use your package manager of choice) in a terminal at the project's root.
- Update the `basePath` and `destinationPath` in the `mediaScannerMachine.ts` file with your own paths.
- Run the project with `yarn start` in the terminal
