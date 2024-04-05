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

// Function to fetch all replies in a thread
const fetchAllReplies = async (threadTs, channel) => {
  const allReplies = [];
  let cursor;

  while (true) {
    const replies = await app.client.conversations.replies({
      channel,
      ts: threadTs,
      cursor,
    });

    if (replies.ok) {
      allReplies.push(...replies.messages);

      if (!replies.has_more) {
        break;
      }

      cursor = replies.response_metadata.next_cursor;
    } else {
      console.error('Error fetching thread replies:', replies.error);
      break;
    }
  }

  return allReplies;
};

// Handle MessageShortcut
app.shortcut('slackShortcuts', async ({ shortcut, ack }) => {
  // Acknowledge the shortcut request
  await ack();

  try {
    if (shortcut.message.thread_ts) {
      // Check if there is a thread_ts
      console.log('--- Thread Replies ---');
      const threadReplies = await fetchAllReplies(shortcut.message.thread_ts, shortcut.channel.id);

      if (threadReplies.length > 0) {
        // Create an array of promises for posting replies to each message
        const replyPromises = threadReplies.map(async (reply, index) => {
          const koreanReplyTime = convertToKoreanTime(reply.ts); // Convert reply time to Korean time
          console.log(`Reply ${index + 1} Time:`, koreanReplyTime);
          console.log(`Reply ${index + 1} Text:`, reply.text);

          // Post a reply to each message
          return app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: shortcut.channel.id,
            thread_ts: reply.ts, // Reply to the specific message
            text: `운영일지 전송 완료`, // Customize your reply text here
          });
        });

        // Execute all reply promises in parallel
        await Promise.all(replyPromises);
      }
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
