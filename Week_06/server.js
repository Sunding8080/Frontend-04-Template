const http = require('http');

http.createServer((request, response) => {
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk.toString());
  }).on('end', () => {
    body = (Buffer.concat([Buffer.from(body.toString())])).toString();
    console.log('body:', body.toString());
    response.writeHead(200, {
      'Content-Type': 'text/html'
    });
    response.end('Hello, world');
  })
}).listen(8080);

console.log('server started');