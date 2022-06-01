const test = require("node:test")
const assert = require("node:assert/strict")
const supertest = require("supertest")
const { contentType } = require("mime-types")

const createServer = require("./server.js")

test("no options (default)", async (t) => {

  const app = createServer()


  await t.test("GET /", (t) => (
    supertest(app)
      .get('/')
      .expect(404)
  ))

})

test("baseDir option", async (t) => {

  const app = createServer({
    baseDir: "./test/static"
  })


  await t.test("GET /", (t) => (
    supertest(app)
      .get('/')
      .expect("content-type", contentType("html"))
      .expect(200)
  ))

  await t.test("GET /data.json", (t) => (
    supertest(app)
      .get('/data.json')
      .expect("content-type", contentType("json"))
      .expect(200)
  ))

})