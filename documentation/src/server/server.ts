import express from "express";

const app = express();
const port = process.env.port || process.env.PORT || 3333;

// A default route should exist (even if not functional) to make application gateway probes working (i.e. HTTP 200) (in the case of the site doesn't have any authentication). 
// With EasyAuth, the probe will hit the authentication endpoint first with a HTTP 401.
app.use('/', express.static(__dirname + '/build'));

// Allow the Easy Auth redirect to work. If not set, it will result to a endless redirect loop
app.use(`/${process.env.ENV_BaseUrl}`, express.static(__dirname + '/build'));

app.listen(port, () => {
  console.log(`Server started on Azure on port ${port}`)
});