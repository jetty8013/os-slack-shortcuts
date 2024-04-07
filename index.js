const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const axios = require('axios');

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

function parseMessagesToArray(messages) {
  let parsedArray = [];

  let currentSite = '';
  let currentScenarioId = '';
  let currentRobotName = '';
  let currentDestination = '';
  let count = 0;

  messages.forEach((message, index) => {
    const regexSite = /^\[(.*?)\]/;
    const regexScenarioId = /#(\d+)/;
    const regexRobotName = /\[(.*?)\]/;
    const regexDestination = /목적지:\s(.*?)(,|$)/;

    const matchesSite = message.match(regexSite);
    const matchesScenarioId = message.match(regexScenarioId);
    const matchesRobotName = message.match(regexRobotName);
    const matchesDestination = message.match(regexDestination);

    if (matchesSite && matchesSite[1]) {
      currentSite = matchesSite[1];
    }

    if (matchesScenarioId && matchesScenarioId[1]) {
      currentScenarioId = matchesScenarioId[1];
    }

    if (matchesRobotName && matchesRobotName[1]) {
      currentRobotName = matchesRobotName[1];
    }

    if (matchesDestination && matchesDestination[1]) {
      const destination = matchesDestination[1].trim();

      if (message.includes('순회 시작')) {
        count++;
      }

      // Only add to the array if "순회 시작" message is found
      if (count > 0) {
        // Append count to scenario_id if count > 1
        const scenarioIdWithCount = count > 1 ? `${currentScenarioId}_${count}` : currentScenarioId;

        parsedArray.push([
          new Date().toISOString().slice(0, 10), // Current date
          new Date().toISOString().slice(11, 19), // Current time
          currentSite || '',
          scenarioIdWithCount || '',
          currentRobotName || '',
          destination || '',
          '관제사', // Placeholder for operator
        ]);
      }
    }
  });

  return parsedArray;
}

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
          console.log(koreanReplyTime + +reply.text);
        });

        const apiKey = process.env.SHEET_API_KEY;

        const data = [['test1', 'test2', 'test3']];

        try {
          const response = await axios.post(`https://port-0-os-tool-server-17xco2nlss79qxq.sel5.cloudtype.app/api/add-row-mission-log?api_key=${apiKey}`, data, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          console.log('New row added successfully.');
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
          console.error('Failed to add new row:', error.message);
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
