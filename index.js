const { createServer } = require('http');
const express = require('express');
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const port = process.env.PORT || 3000;
const slackInteractions = createMessageAdapter(slackSigningSecret);

// Create an express application
const app = express();

// Plug the adapter in as a middleware
app.use('/slack/events', slackInteractions.expressMiddleware());

// Listen for Slack events - MessageShortcut
slackInteractions.shortcut({ type: 'message_action', callbackId: 'slackShortcuts' }, (payload, respond) => {
  // This will be called when a user clicks a message action (MessageShortcut)
  console.log('MessageShortcut Clicked:', payload);

  // Respond to the message action
  respond({
    text: 'MessageShortcut clicked!',
  });
});

// Start the express server
const server = createServer(app);
server.listen(port, () => {
  console.log(`Listening for events on port ${port}`);
});
