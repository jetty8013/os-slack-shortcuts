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

// Function to get all messages in a thread including replies
const getAllThreadMessages = async (channel, threadTs) => {
  try {
    let allMessages = [];

    let cursor;
    while (true) {
      const history = await app.client.conversations.replies({
        channel,
        ts: threadTs,
        cursor,
      });

      if (history.ok) {
        allMessages = allMessages.concat(history.messages);

        if (!history.has_more) {
          break;
        }

        cursor = history.response_metadata.next_cursor;
      } else {
        console.error('Error fetching thread messages:', history.error);
        return null;
      }
    }

    return allMessages;
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return null;
  }
};

// Handle MessageShortcut
app.shortcut('slackShortcuts', async ({ shortcut, ack }) => {
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

      const threadMessages = await getAllThreadMessages(shortcut.channel.id, shortcut.thread_ts);

      if (threadMessages) {
        // Iterate through all messages in the thread
        for (const message of threadMessages) {
          const koreanReplyTime = convertToKoreanTime(message.ts); // Convert reply time to Korean time
          console.log('Reply Time:', koreanReplyTime);
          console.log('Reply Text:', message.text);

          // Check if this is the last message in the thread
          if (message.reply_count && message.subscribed) {
            console.log('--- Last Reply in Thread ---');
            break; // Stop iterating if this is the last message in the thread
          }
        }
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
