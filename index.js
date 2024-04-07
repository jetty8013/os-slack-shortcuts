const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const axios = require('axios');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Function to convert Unix Epoch time to Korean date and time
const convertToKoreanDateTime = (timestamp) => {
  const unixEpochTime = parseFloat(timestamp);
  const koreanDateTime = moment.unix(unixEpochTime).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
  const [koreanDate, koreanTime] = koreanDateTime.split(' ');
  return [koreanDate, koreanTime];
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

// Function to parse thread replies and extract required information
const parseThreadReplies = (replies, username) => {
  if (!replies || replies.length === 0) {
    return [];
  }

  const data = [];

  replies.forEach((reply) => {
    if (!reply.text) {
      return; // Skip this iteration if reply text is empty
    }

    // Check if the message matches the expected format
    const match = reply.text.match(/\[(.*?)\]\[(.*?)\][^:]+:\s*(.*?)\s*\(\s*#(\d+)\s*(.*?)\s*\)\s*:\s*white_check_mark:기체가 배정되었습니다.\s*\(\s*출발지:\s*(.*?)\s*,\s*목적지:\s*(.*?)\s*\)/);
    if (!match) {
      return; // Skip this iteration if the regex doesn't match
    }

    const [, date, time, site, scenarioId, robotName, departure, destination] = match;

    // Format the data as an array
    const rowData = [date.trim(), time.trim(), site.trim(), scenarioId.trim(), robotName.trim(), destination.trim(), username.trim()];

    // Pushing formatted data to the array
    data.push(rowData);
  });

  return data;
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
        const parsedData = parseThreadReplies(threadReplies, shortcut.user.username);

        const apiKey = process.env.SHEET_API_KEY;

        try {
          const response = await axios.post(`https://port-0-os-tool-server-17xco2nlss79qxq.sel5.cloudtype.app/api/add-row-mission-log?api_key=${apiKey}`, parsedData, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          console.log('New rows added successfully.');
          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: shortcut.channel.id,
            thread_ts: shortcut.message.thread_ts, // Reply to the main thread
            text: `운영일지 전송 완료`, // Customize your reply text here
          });
        } catch (error) {
          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: shortcut.channel.id,
            thread_ts: shortcut.message.thread_ts, // Reply to the main thread
            text: `전송에 실패했습니다.`, // Customize your reply text here
          });
          console.error('Failed to add new rows:', error.message);
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
