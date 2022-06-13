import { fileURLToPath } from "node:url"

import express from "express"

import { range } from "../lib/index.js"

function createServer(options) {

  const app = express()

  app.get('*', range(options))

  app.use((req, res, next) => {
    console.log(req.path)
    next()
  })

  app.use((error, req, res, next) => {
    console.error(error)
    res.sendStatus(500)
  })

  return app
}


export { createServer }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createServer()
  app.listen(3000, "127.0.0.1", () => console.log("localhost:3000"))
}