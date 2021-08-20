# @drovp/ffmpeg

Provides `ffmpeg`, `ffprobe`, and `ffplay` static binaries as a [Drovp](https://drovp.app) processor dependencies.

Pre-built binaries are downloaded from:
- Windows: https://www.gyan.dev/ffmpeg/builds/
- MacOS: https://evermeet.cx/ffmpeg/
- Linux: https://johnvansickle.com/ffmpeg/ (**! missing `ffplay`**)

**IMPORTANT!**

`ffplay` is not available on linux systems! We're using [https://johnvansickle.com/ffmpeg/](https://johnvansickle.com/ffmpeg/) as a source of static binaries for linux, and it doesn't include `ffplay`.

If you know about a better or a separate source with `ffplay` in it, share it in [#1](https://github.com/drovp/ffmpeg/issues/1).

## Usage

Require in your processor config:

```js
plugin.registerProcessor('name', {
	// ...config...
	dependencies: ['@drovp/ffmpeg:ffmpeg']
});
```

Consume in your processor:

```js
function processor(operation, utils) {
	const ffmpegPath = utils.dependencies.ffmpeg;
	// or a no conflict risking version (unnecessary in 99.999% cases)
	const ffmpegPath = utils.dependencies['@drovp/ffmpeg:ffmpeg'];
}
```

## API

Dependency IDs and their values inside processor's `utils.dependencies` object.

### `ffmpeg`

**ID**: `@drovp/ffmpeg:ffmpeg`

**Shorthand**: `ffmpeg`

**Value**: path to ffmpeg binary

### `ffprobe`

**ID**: `@drovp/ffmpeg:ffprobe`

**Shorthand**: `ffprobe`

**Value**: path to ffprobe binary

### `ffplay`

**ID**: `@drovp/ffmpeg:ffplay`

**Shorthand**: `ffplay`

**Value**: path to ffplay binary

**Not available on Linux atm!**


## Dev environment

When developing, run:

```
npm start
```

and start working.

When releasing, run:

```
npm version [<newversion> | major | minor | patch]
npm publish
```

### npm start

Cleans up, and continuously builds on file changes.

### npm run build

Builds dist files.

### npm version [&lt;newversion&gt; | major | minor | patch]

1. Cleans up.
1. Build for production.
1. Bumps the version.
1. Commits into git (if present).
1. Pushes to the repository (if not private).
