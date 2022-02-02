const
fs = require("fs"),
{ pipeline } = require("stream"),
{ contentType } = require("mime-types");


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
const range = async (path, res, options) => new Promise(async (resolve, rejects) => {

  if (typeof path !== "string") return rejects(new Error("path argument is required!"));
  if (typeof res !== "object") return rejects(new Error("res object is required!"));
  if ((options?.conditional || options?.range) && !options?.headers) return rejects(new Error("headers object is required!"));

  const stat = await fs.promises.stat(path).catch(err => {
    
    if (err.code === "ENOENT") {

      if (options?.notFound === true) {
        res.statusCode = 404;
        res.end();
        resolve(404);
        return false;
      }

      if (typeof options?.notFound === "string") {
        range(options.notFound, res, {
          ...options,
          notFound: false
        }).then(resolve).catch(rejects);
        return false;
      }

      const e = new Error("File Not Found");
      e.code = 404;
      e.path = path;
      rejects(e);
      return false;

    }

    rejects(err);
    return false;
  });
  
  if (!stat) return;

  if (stat.isDirectory()) {

    if (!options?.implicitIndex)
      return resolve(forgetAboutIt(res, 404))

    const extensions = new Set()

    if (Array.isArray(options.implicitIndex))
      options.implicitIndex.forEach(v => extensions.add(v))
    else if (options.implicitIndex === true)
      extensions.add("html")

    let resolved = false

    const directory = await fs.promises.readdir(path)

    for (const extension of extensions) {
      if (!directory.includes(`index.${extension}`))
        continue

      await range(`${path}/index.${extension}`, res, { ...options }).then(resolve).catch(rejects)
      resolved = true
      break
    }

    return resolved ? null : resolve(forgetAboutIt(res, 404))
  }
  
  const
  headers = options?.headers,
  accRange = options?.range === true,
  conditional = options?.conditional ===  true,
  maxAge = typeof options?.maxAge === 'number' ? options?.maxAge : 0,
  etag = options?.etag === false ? false : getEtag(stat.mtime, stat.size),
  lastMod = options?.lastModified === false ? false : new Date(stat.mtime).toUTCString();


  etag && res.setHeader("etag", etag);
  lastMod && res.setHeader("last-modified", lastMod);
  maxAge && res.setHeader("cache-control", `max-age=${maxAge}`);
  accRange && res.setHeader("accept-ranges", "bytes"); // Hint to the browser range is supported

  res.setHeader("content-type", contentType(path.split(".").pop()));
  res.setHeader("content-length", stat.size);

  // check conditional request, calclute a diff up to 2 sec because browsers sends seconds and javascript uses milliseconds
  if (conditional && (headers["if-none-match"] === etag || (Date.parse(headers["if-modified-since"]) - stat.mtime.getTime()) >= -2000))
    return resolve(forgetAboutIt(res, 304));

  if (accRange && headers["range"]) {
    
    if (headers["if-range"] && headers["if-range"] !== etag) {
      res.statusCode = 200;
      streamIt(path, res, resolve, rejects);
      return;
    }

    if (headers["if-match"] && headers["if-match"] !== etag || (Date.parse(headers["if-unmodified-since"]) - stat.mtime.getTime()) < -2000)
      return resolve(forgetAboutIt(res, 412));

    return rangeReq(path, res, resolve, rejects, headers["range"], stat.size);
  }

  res.statusCode = 200;
  streamIt(path, res, resolve, rejects);
  return;

});

module.exports = range;


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