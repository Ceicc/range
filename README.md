# range
A static files middleware

## Installation
```
npm i @ceicc/range@3.0.0-beta.1
```

## Usage

add `range` to an existence express app

```js
import range from "@ceicc/range"

// CommonJS
// const range = require("@ceicc/range")

app.get('/public/*', range())

app.listen(3000)
```
This will serve every request starts with `/public/` with `range`.

The base directory will be `.` or the current working directory, unless specified in the `options` object.

## Options Object

#### `maxAge`

  - default: `10800`
  - type: `number`

  caching period in seconds.

#### `etag`

  - default: `true`
  - type: `boolean`

  add Etag header.

#### `lastModified`

  - default: `true`
  - type: `boolean`

  add last-modified header.

#### `conditional`

  - default: `true`
  - type: `boolean`

  whether to respect conditional requests or not.

#### `range`

  - default: `true`
  - type: `boolean`

  accept range request.

#### `notFound`

  - default: `true`
  - type: `boolean|string`

  a handler for non existing files

  `notFound: false` `next` will be called.

  `notFound: true` empty body with status code '404' will be sent.

  `notFound: <string>` send a file with status code '404', the given string is the path to file.

  if the path doesn't led to a file, `next` will be called.

  ***Note:*** The path is relative to the `baseDir` path.

#### `implicitIndex`

  - default: `true`
  - type: `boolean|Array<string>`

  Check for index files if the request path is a directory.

  Pass an array of extensions to check against. e.g. _`["html", "css"]`_

  Or simply pass `true` to check for html extension only.

#### `baseDir`

  - default: `'.'`
  - type: `string`

  the base dirctory.

#### `hushErrors`

  - default: `false`
  - type: `boolean`

  Whether to ignore errors and reply with status code `500`, or pass the error to `next` function.


## Real World Example

```js
import express from "express"
import range from "@ceicc/range"

const app = express()

app.get('*', range({ baseDir: './public/' }))

app.use((error, req, res, next) => {
  console.error(error)
  res.sendStatus(500)
})

app.listen(80, () => console.log("server listening on localhost"))
```