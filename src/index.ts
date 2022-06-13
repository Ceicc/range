import { createReadStream, promises } from "fs"
import { pipeline } from "stream"
import { promisify } from "util"
import { contentType } from "mime-types"
import optionsChecker from "@ceicc/options-checker"
import { URL } from "url"
import { extname } from "path"
import * as utils from "./utils.js"

import type { IncomingMessage, ServerResponse } from "http"
import type { NextFunction } from "express"
import type { Transform } from "stream"

// Im not going to use `stream/promises` library because it was added in
// version 15.0, Not all hosting providers support that version (including mine)
const pipelinePromised = promisify(pipeline)


export { range }
export default range


type options = {
  baseDir?: string,
  hushErrors?: boolean,
  conditional?: boolean,
  range?: boolean,
  maxAge?: number | false,
  etag?: boolean,
  lastModified?: boolean,
  notFound?: boolean | string,
  implicitIndex?: boolean | Array<string>,
  trailingSlash?: boolean,
  compression?: string[] | false,
  dateHeader?: boolean,
}

function range(options: options = {}) {

  optionsChecker(options, {
    baseDir:        { default: '.',   type: "string"  },
    hushErrors:     { default: false, type: "boolean" },
    conditional:    { default: true,  type: "boolean" },
    range:          { default: true,  type: "boolean" },
    etag:           { default: true,  type: "boolean" },
    lastModified:   { default: true,  type: "boolean" },
    maxAge:         { default: 10800, type: "number|boolean" },
    notFound:       { default: true,  type: "boolean|string" },
    implicitIndex:  { default: true,  type: "boolean|array"  },
    trailingSlash:  { default: true,  type: "boolean" },
    compression:    { default: false, type: "boolean|array"  },
    dateHeader:     { default: true,  type: "boolean" },
  })


  return async function rangeMiddleware(req: IncomingMessage, res: ServerResponse, next: NextFunction): Promise<void> {


    const { pathname } = new URL(`https://example.com${req.url}`)

    try {

      // Using `var` to get function scope
      var stat = await promises.stat(options.baseDir + pathname)

    } catch (error: any) {

      if (error?.code === "ENOENT") {

        if (options.notFound === true)
          return utils.forgetAboutIt(res, 404)

        if (typeof options.notFound === "string") {

          req.url = `/${options.notFound}`

          options.notFound = false

          return rangeMiddleware(req, res, next)
        }

        return options.hushErrors ? utils.forgetAboutIt(res, 404) : next(error)
      }

      return options.hushErrors ? utils.forgetAboutIt(res, 500) : next(error)
    }


    if (stat.isDirectory()) {

      if (!options.implicitIndex)
        return utils.forgetAboutIt(res, 404)

      if (options.trailingSlash && !utils.hasTrailingSlash(pathname)) {
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

      return utils.forgetAboutIt(res, 404)
    }


    const etag = options.etag && utils.getEtag(stat.mtime, stat.size)
    const extension = extname(pathname)
    const fileContentType = contentType(extension)

    etag                  && res.setHeader("etag", etag)
    options.lastModified  && res.setHeader("last-modified", stat.mtime.toUTCString())
    options.range         && res.setHeader("accept-ranges", "bytes") // Hint to the browser range is supported
    typeof options.maxAge === "number" && res.setHeader("cache-control", `max-age=${options.maxAge}`)
    typeof fileContentType === "string" && res.setHeader("content-type", fileContentType)
    res.setHeader("content-length", stat.size)
    options.dateHeader    && res.setHeader("date", new Date().toUTCString())

    // check conditional requests
    if ( options.conditional) {

      const ifNoneMatch = req.headers["if-none-match"]

      const ifModifiedSince = req.headers["if-modified-since"]

      if (
        ifNoneMatch === etag ||
        ifModifiedSince && ( Date.parse(ifModifiedSince) - stat.mtime.getTime() ) >= -2000
      )
        return utils.forgetAboutIt(res, 304)

    }

    if (options.range && req.headers["range"]) {

      if (req.headers["if-range"] && req.headers["if-range"] !== etag) {

        res.statusCode = 200

        try {

          if (options.compression && fileContentType && stat.size > 1024) {

            const { encoding, stream } = utils.getPossibleEncoding({
              headers: req.headers,
              availableEncodings: options.compression,
              contentType: fileContentType
            })

            if (stream) {
              res.removeHeader("content-length")
              res.setHeader("content-encoding", encoding)

              return await streamIt({ path: options.baseDir + pathname, res, transformStream: stream })
            }
          }

          return await streamIt({ path: options.baseDir + pathname, res })

        } catch (error) {

          options.hushErrors ? utils.hush(res) : next(error)

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
          return utils.forgetAboutIt(res, 412)
      }

      try {

        await rangeRequest(options.baseDir + pathname, res, req.headers["range"], stat.size)

      } catch (error) {

        options.hushErrors ? utils.hush(res) : next(error)

      }

      return
    }

    res.statusCode = 200

    try {

      if (options.compression && fileContentType && stat.size > 1024) {

        const { encoding, stream } = utils.getPossibleEncoding({
          headers: req.headers,
          availableEncodings: options.compression,
          contentType: fileContentType || ""
        })

        if (stream) {
          res.removeHeader("content-length")
          res.setHeader("content-encoding", encoding)

          return await streamIt({ path: options.baseDir + pathname, res, transformStream: stream })
        }
      }

      return await streamIt({ path: options.baseDir + pathname, res })

    } catch (error) {

      options.hushErrors ? utils.hush(res) : next(error)

    }

  }
}


interface streamItParams {
  path: string,
  res: ServerResponse,
  range?: { start: number, end: number },
  transformStream?: Transform
}

async function streamIt({ path, res, range, transformStream }: streamItParams) {

  const readableFile = createReadStream(path, range ? { start: range.start, end: range.end } : undefined)

  if (transformStream) {
    return pipelinePromised(
      readableFile,
      transformStream,
      res
    ).catch(catchError)
  }

  return pipelinePromised(
    readableFile,
    res
  ).catch(catchError)

  function catchError (err: any) {
    if (!err || err.code === "ERR_STREAM_PREMATURE_CLOSE") // Stream closed (normal)
      return
    else
      throw err
  }
}

function rangeRequest(path: string, res: ServerResponse, rangeHeader: string, size: number) {

  res.removeHeader("content-length")

  const rangeRegex = rangeHeader.match(/bytes=([0-9]+)?-([0-9]+)?/i)

  if (!rangeRegex) { // Incorrect pattren
    res.setHeader("content-range", `bytes */${size}`)
    return utils.forgetAboutIt(res, 416)
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
    return utils.forgetAboutIt(res, 416)
  }

  res.statusCode = 206 // partial content
  res.setHeader("content-range", `bytes ${start}-${end}/${size}`)
  res.setHeader("content-length", end - start + 1)
  return streamIt({ path, res, range: { start, end } })
}