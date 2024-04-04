const { createServer } = require('http');
const express = require('express');
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const port = process.env.PORT || 3000;
const slackInteractions = createMessageAdapter(slackSigningSecret);

// Create an express application
const app = express();

// Plug the adapter in as a middleware
app.use('/shortcuts', slackInteractions.requestListener());

// Example: If you're using a body parser, always put it after the message adapter in the middleware stack
app.use(express.json()); // Use express.json() instead of bodyParser
app.use(express.urlencoded({ extended: true })); // Use express.urlencoded() with extended option

// Initialize a server for the express app - you can skip this and the rest if you prefer to use app.listen()
const server = createServer(app);
server.listen(port, () => {
  // Log a message when the server is ready
  console.log(`Listening for events on ${server.address().port}`);
});
