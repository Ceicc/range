# range
http range request handler

# Installation
```
npm i @ceicc/range
```

# Usage
start by requiring `http` and `range`
```js
const
http = require("http"),
range = require("@ceicc/range");
```

Then make a simple server that responds with a file based on the requested path
 ```js
 http.createServer((req, res) => {

  range(__dirname + req.url, req.headers.range, res, err => {
    if (err?.code === 404) return res.writeHead(404).end("Page Not Found");
    if (err?.code === 416) return res.writeHead(416).end("Range Not Satisfiable");
    if (err) {
      console.error(err);
      res.writeHead(500).end("Internal Server Error");
    }
  });

}).listen(2000);
 ```
 
 # Parameters
 1. file path, starting from the current directory.
 
 2. the requested range. `null` and `undefined` treatet as there is no range.
 
 3. the response object.
 
 4. an error checking function.
 
 # Errors
 possible errors are:
 
 1. `File Not Found` with error code: `404`
 
 2. `Range Not Satisfiable` with error code: `416`
