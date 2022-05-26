import { createBrotliCompress, createGzip, createDeflate } from "zlib"
import compressible from "compressible"
import Negotiator from "negotiator"

import type { IncomingHttpHeaders, ServerResponse } from "http"
import type { BrotliCompress, Gzip, Deflate } from "zlib"

const ENCODINGS_MAP = new Map([
  ["br", createBrotliCompress],
  ["gzip", createGzip],
  ["deflate", createDeflate]
])

export function getEtag(mtime: Date, size: number) {
  return `W/"${size.toString(16)}-${mtime.getTime().toString(16)}"`
}

export function forgetAboutIt(res: ServerResponse, status: number) {
  res.removeHeader("content-type")
  res.removeHeader("content-length")
  res.removeHeader("cache-control")
  res.statusCode = status
  res.end()
}

function getCompressionStream(encoding: string): BrotliCompress | Gzip | Deflate | undefined {
  return ENCODINGS_MAP.get(encoding)?.()
}

interface getPossibleEncodingParam {
  headers: IncomingHttpHeaders,
  availableEncodings: string[],
  contentType: string,
}

export function getPossibleEncoding({ headers, availableEncodings, contentType }: getPossibleEncodingParam) {

  const encoding = new Negotiator({ headers }).encoding(availableEncodings)
  const isComressible = compressible(contentType)

  if (!encoding || !isComressible)
    return { encoding, stream: null }

  const stream = getCompressionStream(encoding)

  return { encoding, stream }
}

export function hasTrailingSlash(url: string): boolean {
  return url[url.length - 1] === "/"
}

export function hush(res: ServerResponse) {
  if (!res.headersSent) {
    res.statusCode = 500
    res.end()
  }
}