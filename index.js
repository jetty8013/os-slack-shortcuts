const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const credentials = require('./crack-linker-414014-ee89ccc30307.json');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

const client = new google.auth.JWT(credentials.client_email, null, credentials.private_key, ['https://www.googleapis.com/auth/spreadsheets']);

async function addRowsSWToSheet(data) {
  const sheets = google.sheets({ version: 'v4', auth: client });

  const request = {
    spreadsheetId: '1nXJfHhF1kxsXEZJhJlWAgwe1E4acWVMjxuZlSWw3IOQ', // Replace with your spreadsheet ID
    range: '배차', // Replace with your sheet name
    valueInputOption: 'RAW',
    resource: {
      values: data, // data should be an array of arrays, each inner array represents a row
    },
  };

  try {
    const response = await sheets.spreadsheets.values.append(request);
    console.log('Rows added:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error adding rows:', err);
    throw err;
  }
}

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
      console.log(shortcut.user.name);
      if (threadReplies.length > 0) {
        threadReplies.forEach((reply, index) => {
          const koreanReplyTime = convertToKoreanTime(reply.ts); // Convert reply time to Korean time
          console.log(`Reply ${index + 1} Time:`, koreanReplyTime);
          console.log(`Reply ${index + 1} Text:`, reply.text);
        });

        // await app.client.chat.postMessage({
        //   token: process.env.SLACK_BOT_TOKEN,
        //   channel: shortcut.channel.id,
        //   thread_ts: shortcut.message.thread_ts, // Reply to the main thread
        //   text: `운영일지 전송 완료`, // Customize your reply text here
        // });
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
