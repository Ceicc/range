const
fs = require("fs"),
{ pipeline } = require("stream"),
{ contentType } = require("mime-types");

/**
 * 
 * @param {string} path path to file.
 * 
 * you can get from the url using `req.url.split("?")[0]`.
 * 
 * Or simply `req.path` in Express.js
 * @param {string|void} range the requested range, `req.headers.range`
 * @param {object} res http.ServerResponse object `res`
 * @param {function} cb callback function with error parameter
 * @returns {void}
 */
async function range(path, range, res, cb) {

  const size = await fs.promises.stat(path)
    .then(f => f.size)
    .catch(err => {
      if (err.code === "ENOENT") {
        const e = new Error("File Not Found");
        e.code = 404;
        cb(e);
        return false;
      }
      cb(err);
      return false;
    });
  
  if (!size) return;

  res.setHeader("Content-Type", contentType(path.split(".").pop()));

  res.setHeader("Accept-Ranges", "Bytes"); // Hint to the browser range is supported

  if (!range) {
    // No range specified, stream from the beginning
    res.setHeader("Content-Length", size);
    pipeline(
      fs.createReadStream(path),
      res,
      err => streamFinish(err, cb)
    );
    return;
  }

  let [start, end] = range.split("=")[1].split(",")[0].split("-");

  switch (true) {

    case Boolean(start) && !end: // Range: <unit>=<range-start>-
      end = size - 1;
      start = Number(start);
      break;

    case !start && Boolean(end): // Range: <unit>=-<suffix-length>
      start = size - end;
      end = size - 1;
      break;

    case !start && !end: // Range: <unit>=-
      start = 0;
      end = size - 1;
      break;

    default: // Range: <unit>=<range-start>-<range-end>
      start = Number(start);
      end = Number(end);
  }

  if (start > end || end >= size) {
    // Range out of order or bigger than file size
    const e = new Error("Range Not Satisfiable");
    e.code = 416;
    cb(e);
    return;
  }

  res.statusCode = 206; // partial content

  res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);

  pipeline(
    fs.createReadStream(path, { start, end }), // With the start & end specified
    res,
    err => streamFinish(err, cb)
  );
}

/**
 * 
 * @param {object} err an error object
 * @param {function} cb callback
 * @returns {void}
 */
function streamFinish(err, cb) {
  // Report all errors except "Stram close" because it's normal
  if (err && err?.code !== "ERR_STREAM_PREMATURE_CLOSE") {
    cb(err);
    return;
  }
  cb();
}

module.exports = range;