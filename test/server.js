const express = require("express")
const range = require("../lib/index.js")

function main(options) {

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


module.exports = main


if (require.main === module) {
  const app = main()
  app.listen(3000, "127.0.0.1", () => console.log("localhost:3000"))
}