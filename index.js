const
fs = require("fs"),
{ pipeline } = require("stream/promises"),
{ contentType } = require("mime-types"),
optionsChecker = require("@ceicc/options-checker"),
{ URL } = require("url"),
{ ClientRequest, ServerResponse } = require("http")

module.exports = range

const nextTick = () => new Promise(r => process.nextTick(r))

/**
 * @typedef {object} options
 * @property {object} [headers] the request headers object `req.headers`
 * 
 * if `range` and/or `conditionalRequest` are true,
 * then the headers object is required.
 * 
 * you can pass the whole headers object, or only the conditional and range headers
 * 
 * @property {boolean} [conditional] whether to respect conditional requests or not - default false
 * 
 * if true, the headers object is required
 * @property {boolean} [range] accept range request - default false
 * 
 * if true, the headers object is required
 * @property {number} [maxAge] max age of caching in seconds - default 0
 * @property {boolean} [etag] add Etag header - default true
 * @property {boolean} [lastModified] add last-modified header - default true
 * @property {string|boolean} [notFound] a handler for non existing files
 * 
 * `notFound: false` a rejection will be thrown (default).
 * 
 * `notFound: true` empty body with response code '404' will be sent.
 * 
 * `notFound: <string>` send a file with response code '404', the given string is the path to file.  
 *    if the path doesn't led to a file, a rejection will be thrown
 * @property {boolean|Array<string>} [implicitIndex=false] Check for index files if the request path is a directory. default: `false`
 * 
 * Pass an array of extensions to check against. e.g. _`["html", "css"]`_
 * 
 * Or simply pass `true` to check for html extension only
 */


/**
 * 
 * @param {string} path path to file, `req.url`
 * @param {object} res http.ServerResponse object `res`
 * @param {options} options optional 
 * @returns {Promise<number>} A Promise with the response status code
 */
function range (options) {

  optionsChecker(options, {
    conditional:    { default: true,  type: "boolean" },
    range:          { default: true,  type: "boolean" },
    maxAge:         { default: 10800, type: "number"  },
    etag:           { default: true,  type: "boolean" },
    lastModified:   { default: true,  type: "boolean" },
    notFound:       { default: true,  type: "boolean|string" },
    implicitIndex:  { default: true,  type: "array|boolean"  },
  })


  return async function rangeMiddleware(req, res) {

    if (!(req instanceof ClientRequest)) {
      await nextTick()
      throw new TypeError("Request object is not instance of ClientRequest")
    }
    if (!(res instanceof ServerResponse)) {
      await nextTick()
      throw new TypeError("Response object is not instance of ServerResponse")
    }

    req.pathname = new URL(`https://example.com${req.url}`).pathname

    try {
  
      var stat = await fs.promises.stat(req.pathname)
  
    } catch (error) {
      
      if (error.code === "ENOENT") {
  
        if (options.notFound) {
          res.statusCode = 404
          res.end()
          return 404
        }
  
        if (typeof options.notFound === "string") {

          req.url = options.notFound

          options.notFound = false

          return await rangeMiddleware(req, res)
        }
  
        const e = new Error("File Not Found")
        e.code = 404
        e.path = path
        throw e

      }

      throw error
    }

    if (stat.isDirectory()) {
  
      if (!options.implicitIndex)
        return forgetAboutIt(res, 404)
  
      const extensions = new Set()
  
      if (Array.isArray(options.implicitIndex))
        options.implicitIndex.forEach(v => extensions.add(v))
      else if (options.implicitIndex === true)
        extensions.add("html")
  
      const directory = await fs.promises.readdir(req.pathname)
  
      for (const extension of extensions) {
        if (!directory.includes(`index.${extension}`))
          continue

        req.url = `${req.pathname}/index.${extension}`
  
        return await rangeMiddleware(req, res)
      }
  
      return forgetAboutIt(res, 404)
    }

  }
  
  
  const
  etag = options.etag && getEtag(stat.mtime, stat.size),
  lastMod = options.lastModified && new Date(stat.mtime).toUTCString()


  etag && res.setHeader("etag", etag)
  lastMod && res.setHeader("last-modified", lastMod)
  options.maxAge && res.setHeader("cache-control", `max-age=${options.maxAge}`)
  options.range && res.setHeader("accept-ranges", "bytes") // Hint to the browser range is supported

  res.setHeader("content-type", contentType(req.pathname.split(".").pop()))
  res.setHeader("content-length", stat.size)

  // check conditional request, calclute a diff up to 2 sec because browsers sends seconds and javascript uses milliseconds
  if ( options.conditional && (
    req.headers["if-none-match"] === etag ||
    ( Date.parse(req.headers["if-modified-since"]) - stat.mtime.getTime() ) >= -2000 )
  )
    return forgetAboutIt(res, 304)

  if (options.range && req.headers["range"]) {
    
    if (req.headers["if-range"] && req.headers["if-range"] !== etag) {
      res.statusCode = 200;
      streamIt(path, res, resolve, rejects)
      return;
    }

    if (headers["if-match"] && headers["if-match"] !== etag || (Date.parse(headers["if-unmodified-since"]) - stat.mtime.getTime()) < -2000)
      return resolve(forgetAboutIt(res, 412));

    return rangeReq(path, res, resolve, rejects, headers["range"], stat.size);
  }

  res.statusCode = 200;
  streamIt(path, res, resolve, rejects);
  return;

}


function streamIt(path, res, resolve, rejects, opts) {
  pipeline(
    fs.createReadStream(path, opts ? { start: opts.start, end: opts.end} : null),
    res,
    err => {
      if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") // Stream closed (normal)
        return rejects(err);
      resolve(res.statusCode);
    }
  );
}

function getEtag(mtime, size) {
  return `W/"${size.toString(16)}-${mtime.getTime().toString(16)}"`;
}

function forgetAboutIt(res, status) {
  res.removeHeader("content-type");
  res.removeHeader("content-length");
  res.removeHeader("cache-control");
  res.statusCode = status;
  res.end();
  return status;
}

function rangeReq(path, res, resolve, rejects, Range, size) {

  res.removeHeader("content-length");
  Range = Range.match(/bytes=([0-9]+)?-([0-9]+)?/i);

  if (!Range) { // Incorrect pattren
    res.setHeader("content-range", `bytes */${size}`);
    return resolve(forgetAboutIt(res, 416));
  }

  let [start, end] = [Range[1], Range[2]];

  switch (true) {

    case !!start && !end:   // Range: <unit>=<range-start>-
      start = Number(start);
      end = size - 1;
      break;

    case !start && !!end:   // Range: <unit>=-<suffix-length>
      start = size - end;
      end = size - 1;
      break;

    case !start && !end:    // Range: <unit>=-
      start = 0;
      end = size - 1;
      break;

    default:                // Range: <unit>=<range-start>-<range-end>
      [start, end] = [Number(start), Number(end)];
  }

  if (start < 0 || start > end || end >= size) { // Range out of order or bigger than file size
    res.setHeader("content-range", `bytes */${size}`);
    return resolve(forgetAboutIt(res, 416));
  }

  res.statusCode = 206; // partial content
  res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
  streamIt(path, res, resolve, rejects, { start, end });
}