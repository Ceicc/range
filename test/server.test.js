const supertest = require("supertest")
const { contentType } = require("mime-types")

const createServer = require("./server.js")

describe("no options (default)", () => {

  const app = createServer()


  test("GET /", (done) => {
    supertest(app)
      .get('/')
      .expect(404, done)
  })

})

describe("baseDir option", () => {

  const app = createServer({
    baseDir: "./test/static"
  })


  test("GET /", (done) => {
    supertest(app)
      .get('/')
      .expect("content-type", contentType("html"))
      .expect(200, done)
  })

  test("GET /data.json", (done) => {
    supertest(app)
      .get('/data.json')
      .expect("content-type", contentType("json"))
      .expect(200, done)
  })

})
