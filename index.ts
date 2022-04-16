import { createReadStream, promises } from "fs"
import { pipeline } from "stream"
import { promisify } from "util"
import { contentType } from "mime-types"
import optionsChecker from "@ceicc/options-checker"
import { URL } from "url"
import type { IncomingMessage, ServerResponse } from "http"
import type { NextFunction } from "express"

// Im not going to use `stream/promises` liberary because it was added in
// version 15.0, Not all hosting providers support that version (including mine)
const pipelinePromised = promisify(pipeline)


export default range


type options = {
  baseDir?: string,
  hushErrors?: boolean,
  conditional?: boolean,
  range?: boolean,
  maxAge?: number,
  etag?: boolean,
  lastModified?: boolean,
  notFound?: boolean|string,
  implicitIndex?: boolean|Array<string>,
  trailingSlash?: boolean,
}

function range(options: options = {}) {

  optionsChecker(options, {
    baseDir:        { default: '.',   type: "string"  },
    hushErrors:     { default: false, type: "boolean" },
    conditional:    { default: true,  type: "boolean" },
    range:          { default: true,  type: "boolean" },
    maxAge:         { default: 10800, type: "number"  },
    etag:           { default: true,  type: "boolean" },
    lastModified:   { default: true,  type: "boolean" },
    notFound:       { default: true,  type: "boolean|string" },
    implicitIndex:  { default: true,  type: "boolean|array"  },
    trailingSlash:  { default: true,  type: "boolean" },
  })


  return async function rangeMiddleware(req: IncomingMessage, res: ServerResponse, next: NextFunction): Promise<void> {


    const { pathname } = new URL(`https://example.com${req.url}`)

    try {

      // Using `var` to get function scope
      var stat = await promises.stat(options.baseDir + pathname)

    } catch (error: any) {

      if (error?.code === "ENOENT") {

        if (options.notFound === true)
          return forgetAboutIt(res, 404)

        if (typeof options.notFound === "string") {

          req.url = `/${options.notFound}`

          options.notFound = false

          return rangeMiddleware(req, res, next)
        }

        return options.hushErrors ? forgetAboutIt(res, 404) : next(error)
      }

      return options.hushErrors ? forgetAboutIt(res, 500) : next(error)
    }


    if (stat.isDirectory()) {

      if (!options.implicitIndex)
        return forgetAboutIt(res, 404)

      if (options.trailingSlash && !hasTrailingSlash(pathname)) {
        res.statusCode = 301
        res.setHeader("Location", pathname + "/")
        res.end()
        return
      }

      const extensions = new Set()

      if (Array.isArray(options.implicitIndex))
        options.implicitIndex.forEach(v => extensions.add(v))

      else if (options.implicitIndex === true)
        extensions.add("html")

      const directory = await promises.readdir(options.baseDir + pathname)

      for (const extension of extensions) {
        if (!directory.includes(`index.${extension}`))
          continue

        req.url = `${pathname}/index.${extension}`

        return rangeMiddleware(req, res, next)
      }

      return forgetAboutIt(res, 404)
    }


    const etag = options.etag && getEtag(stat.mtime, stat.size)

    etag                  && res.setHeader("etag", etag)
    options.lastModified  && res.setHeader("last-modified", stat.mtime.toUTCString())
    options.maxAge        && res.setHeader("cache-control", `max-age=${options.maxAge}`)
    options.range         && res.setHeader("accept-ranges", "bytes") // Hint to the browser range is supported

    const extension = pathname.split(".").pop()

    if (extension) {
      const contentTypeHeader = contentType(extension)
      typeof contentTypeHeader === "string" && res.setHeader("content-type", contentTypeHeader)
    }


    res.setHeader("content-length", stat.size)

    // check conditional requests
    if ( options.conditional) {

      const ifNoneMatch = req.headers["if-none-match"]

      const ifModifiedSince = req.headers["if-modified-since"]

      if (
        ifNoneMatch === etag ||
        ifModifiedSince && ( Date.parse(ifModifiedSince) - stat.mtime.getTime() ) >= -2000
      )
        return forgetAboutIt(res, 304)

    }

    if (options.range && req.headers["range"]) {

      if (req.headers["if-range"] && req.headers["if-range"] !== etag) {

        res.statusCode = 200

        try {

          await streamIt(options.baseDir + pathname, res)

        } catch (error) {

          options.hushErrors ? hush(res) : next(error)

        }

        return
      }

      {
        const ifMatch = req.headers["if-match"]

        const ifUnmodifiedSince = req.headers["if-unmodified-since"]

        if (
          ifMatch && ifMatch !== etag ||
          ifUnmodifiedSince && ( Date.parse(ifUnmodifiedSince) - stat.mtime.getTime() ) < -2000
        )
          return forgetAboutIt(res, 412)
      }

      try {

        await rangeRequest(options.baseDir + pathname, res, req.headers["range"], stat.size)

      } catch (error) {

        options.hushErrors ? hush(res) : next(error)

      }

      return
    }

    res.statusCode = 200

    try {

      await streamIt(options.baseDir + pathname, res)

    } catch (error) {

      options.hushErrors ? hush(res) : next(error)

    }

  }
}


function hush(res: ServerResponse) {
  if (!res.headersSent) {
    res.statusCode = 500
    res.end()
  }
}

async function streamIt(path: string, res: ServerResponse, opts?: { start: number, end: number }) {
  return pipelinePromised(
    createReadStream(path, opts ? { start: opts.start, end: opts.end} : undefined),
    res,
  ).catch(err => {
      if (!err || err.code === "ERR_STREAM_PREMATURE_CLOSE") // Stream closed (normal)
        return
      else
        throw err
    })
}

function getEtag(mtime: Date, size: number) {
  return `W/"${size.toString(16)}-${mtime.getTime().toString(16)}"`;
}

function forgetAboutIt(res: ServerResponse, status: number) {
  res.removeHeader("content-type");
  res.removeHeader("content-length");
  res.removeHeader("cache-control");
  res.statusCode = status;
  res.end();
}

function rangeRequest(path: string, res: ServerResponse, rangeHeader: string, size: number) {

  res.removeHeader("content-length")

  const rangeRegex = rangeHeader.match(/bytes=([0-9]+)?-([0-9]+)?/i)

  if (!rangeRegex) { // Incorrect pattren
    res.setHeader("content-range", `bytes */${size}`)
    return forgetAboutIt(res, 416)
  }

  let [ , start, end] = rangeRegex.map(n => Number(n))

  switch (true) {

    case !isNaN(start) && isNaN(end):   // Range: <unit>=<range-start>-
      end = size - 1
      break

    case isNaN(start) && !isNaN(end):   // Range: <unit>=-<suffix-length>
      start = size - end
      end = size - 1
      break

    case isNaN(start) && isNaN(end):    // Range: <unit>=-
      start = 0
      end = size - 1
      break

    // Default is Range: <unit>=<range-start>-<range-end>
  }

  if (start < 0 || start > end || end >= size) { // Range out of order or bigger than file size
    res.setHeader("content-range", `bytes */${size}`)
    return forgetAboutIt(res, 416)
  }

  res.statusCode = 206 // partial content
  res.setHeader("content-range", `bytes ${start}-${end}/${size}`)
  return streamIt(path, res, { start, end })
}

function hasTrailingSlash(url: string): boolean {
  return url[url.length - 1] === "/"
}