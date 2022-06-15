import { jest, describe, test } from "@jest/globals"

import supertest from "supertest"
import { contentType } from "mime-types"

import { createServer } from "./server.js"
import { parser } from "./parser.js"

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

  test("GET /data.json, testing content-type and content-length", (done) => {
    supertest(app)
      .get('/data.json')
      .expect("content-type", contentType("json"))
      .expect("content-length", '218')
      .expect(200, done)
  })

  test("GET /data.json, testing content-range and content-length", (done) => {
    supertest(app)
      .get('/data.json')
      .parse(parser)
      .set("range", "bytes=23-195")
      .expect("content-range", 'bytes 23-195/218')
      .expect("content-length", (195 - 23 + 1).toString())
      .expect(206, done)
  })

  test("GET /data.json, testing content-range and content-length", (done) => {
    supertest(app)
      .get('/data.json')
      .set("range", "bytes=31-53")
      .expect("content-range", 'bytes 31-53/218')
      .expect("content-length", (53 - 31 + 1).toString())
      .expect(206, done)
  })

})
