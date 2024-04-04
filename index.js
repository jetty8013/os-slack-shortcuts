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

      replies.messages.forEach((reply) => {
        const koreanReplyTime = convertToKoreanTime(reply.ts); // Convert reply time to Korean time
        console.log('Reply Time:', koreanReplyTime);
        console.log('Reply Text:', reply.text);

        // If the reply has replies (nested threads), you can fetch them recursively
        if (reply.thread_ts) {
          console.log('--- Nested Thread Replies ---');
          fetchNestedReplies(reply.thread_ts, shortcut.channel.id);
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
});

// Function to fetch nested thread replies
const fetchNestedReplies = async (threadTs, channel) => {
  const nestedReplies = await app.client.conversations.replies({
    channel,
    ts: threadTs,
  });

  nestedReplies.messages.forEach((nestedReply) => {
    const koreanNestedReplyTime = convertToKoreanTime(nestedReply.ts);
    console.log('Nested Reply Time:', koreanNestedReplyTime);
    console.log('Nested Reply Text:', nestedReply.text);

    // If there are further nested replies, fetch them recursively
    if (nestedReply.thread_ts) {
      fetchNestedReplies(nestedReply.thread_ts, channel);
    }
  });
};

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
