export function parser(res, cb) {
  const data = []
  res.on("data", chunk => {
    data.push(chunk)
  })
  res.on("end", () => {
    cb(null, Buffer.concat(data))
  })
}