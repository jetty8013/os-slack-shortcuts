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

    if (shortcut.message.thread_ts) {
      // Check if there is a thread_ts
      console.log('--- Thread Replies ---');
      const replies = await app.client.conversations.replies({
        channel: shortcut.channel.id,
        ts: shortcut.message.thread_ts, // Use message.thread_ts for the thread
      });

      const lastReply = replies.messages[replies.messages.length - 1]; // Get the last reply

      if (lastReply) {
        const koreanReplyTime = convertToKoreanTime(lastReply.ts); // Convert reply time to Korean time
        console.log('Last Reply Time:', koreanReplyTime);
        console.log('Last Reply Text:', lastReply.text);
      }

      // Fetch nested replies only if there are any
      if (lastReply && lastReply.thread_ts) {
        console.log('--- Nested Thread Replies ---');
        await fetchNestedReplies(lastReply.thread_ts, shortcut.channel.id);
      }
    }
  } catch (error) {
    console.error(error);
  }
});

// Function to fetch nested thread replies
const fetchNestedReplies = async (threadTs, channel, stop = true) => {
  const nestedReplies = await app.client.conversations.replies({
    channel,
    ts: threadTs,
  });

  nestedReplies.messages.forEach((nestedReply) => {
    const koreanNestedReplyTime = convertToKoreanTime(nestedReply.ts);
    console.log('Nested Reply Time:', koreanNestedReplyTime);
    console.log('Nested Reply Text:', nestedReply.text);

    // If there are further nested replies and stop is true, fetch them recursively
    if (nestedReply.thread_ts && stop) {
      fetchNestedReplies(nestedReply.thread_ts, channel, false);
    }
  });
};

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
