# range
static files request handler

# Installation
```
npm i @ceicc/range
```

# Usage
start by importing `http` and `range`
```js
const
http = require("http"),
range = require("@ceicc/range");
```

Then make a simple server that responds with a file based on the requested path
 ```js
 http.createServer((req, res) => {

  range(__dirname + req.url, res).catch(console.error)

}).listen(2000);
 ```
 
 # Parameters
 1. file path.
 2. the response object.
 3. optional object

 # Options Object
 1. `maxAge` max age of caching in seconds - default 0
 
 2. `etag` add Etag header - default true
 
 3. `lastModified` add last-modified header - default true
 
 4. `conditional` whether to respect conditional requests or not - default false  
   if true, the headers object is required
 
 5. `range` accept range request - default false  
   if true, the headers object is required
 
 6. `headers` the request headers object `req.headers`  
   if `range` and/or `conditionalRequest` are true, then the headers object is required.  
   you can pass the whole headers object, or only the conditional and range headers.

 7. `notFound` handler for non existing files  
   `notFound: false` - a rejection will be thrown (default).  
   `notFound: true` - empty body with response code '404' will be sent.  
   `notFound: <string>` - send a file with response code '404', the given string is the path to file.  
      if the path doesn't led to a file, a rejection will be thrown

 # Resolves
 the response status code
 
 # Rejects
 'File Not Found' error.
 
 Any other unexpected error
 
 # Real World Example
 ```js
const
express = require("express"),
range = require("@ceicc/range"),
app = express();

app.get('/', (req, res, next) => range('./public/index.html', res).catch(next));

app.get('/public/*', (req, res, next) => {
  range('.' + req.path, res, {
    headers: req.headers,
    range: true,
    conditional: true,
    maxAge: 2592000, // 30 Days
    notFound: './test/public/404.html',
  }).catch(next);
});

app.use((err, req, res, next) => {
  console.dir(err);
  if (!res.headersSent)
    res.sendStatus(500);
});

app.listen(2000);
 ```
