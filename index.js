const { App } = require('@slack/bolt');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Handle MessageShortcut
app.shortcut('slackShortcuts', async ({ shortcut, ack, respond }) => {
  // Acknowledge the shortcut request
  await ack();

  try {
    console.log(shortcut);
    // Send a message when the shortcut is clicked
    await respond({
      text: 'MessageShortcut clicked!',
    });
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
