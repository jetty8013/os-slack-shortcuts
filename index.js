const { App } = require('@slack/bolt');
const moment = require('moment-timezone');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Function to convert Unix Epoch time to Korean time
const convertToKoreanTime = (timestamp) => {
  const unixEpochTime = parseFloat(timestamp);
  const koreanTime = moment.unix(unixEpochTime).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
  return koreanTime;
};

// Handle MessageShortcut
app.shortcut('slackShortcuts', async ({ shortcut, ack, respond }) => {
  // Acknowledge the shortcut request
  await ack();

  try {
    const messageTs = shortcut.message.ts; // Unix Epoch time
    const koreanMessageTime = convertToKoreanTime(messageTs); // Convert to Korean time

    console.log('Message Shortcut Info:');
    console.log('Timestamp:', koreanMessageTime);
    console.log('Text:', shortcut.message.text);

    if (shortcut.thread_ts) {
      console.log('--- Thread Replies ---');
      const replies = await app.client.conversations.replies({
        channel: shortcut.channel.id,
        ts: shortcut.thread_ts,
      });

      replies.messages.forEach((reply) => {
        const koreanReplyTime = convertToKoreanTime(reply.ts); // Convert reply time to Korean time
        console.log('Reply Time:', koreanReplyTime);
        console.log('Reply Text:', reply.text);
      });
    }
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
