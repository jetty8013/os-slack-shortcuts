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
  let scenarioId = '';
  let courseName = '';
  let robotName = '';
  let site = '';

  replies.forEach((reply) => {
    if (!reply.text) {
      return; // Skip this iteration if reply text is empty
    }

    // Check if the message matches the expected format for the first condition
    let match = reply.text.match(/\[(.*?)\]\[#(\d+)\][^:]+:\s*(.*?)\s*\(([^,]+),\s*목적지:\s*(.*?)\)/);
    if (match) {
      [, site, currentScenarioId, robotDetails, departure, destination] = match;
      robotName = getRobotName(robotDetails); // Get robot name from robotDetails
      scenarioId = currentScenarioId.trim();

      // Extracting Korean date and time
      const [koreanDate, koreanTime] = convertToKoreanDateTime(reply.ts);

      // Format the data as an array for the first condition
      const rowData = [koreanDate, koreanTime, site.trim(), scenarioId, robotName.trim(), destination.trim(), username];
      data.push(rowData);

      // Reset courseName
      courseName = '';
    } else {
      // Check if the message matches the expected format for the second condition
      match = reply.text.match(/\[(.*?)\]\[#(\d+)\][^:]+:\s*(.*?)\s*\((코스명:)?\s*(.*?),\s*(.*?)\)/);
      if (match) {
        [, site, currentScenarioId, robotDetails, , currentCourse, rounds] = match;
        robotName = getRobotName(robotDetails); // Get robot name from robotDetails
        scenarioId = currentScenarioId.trim();
        courseName = currentCourse.trim();

        // Extracting Korean date and time
        const [koreanDate, koreanTime] = convertToKoreanDateTime(reply.ts);

        // Format the data as an array for the second condition
        const rowData = [koreanDate, koreanTime, site.trim(), scenarioId, robotName.trim(), courseName, username];
        data.push(rowData);
      } else {
        // Additional check for '순회 시작' in a thread with course information
        if (courseName && reply.text.includes('순회 시작')) {
          [, site, robotDetails, roundsInfo] = reply.text.match(/\[(.*?)\]\s*(.*?)\s*(\d+\/\d+)\s*(순회 시작)/);
          [roundNumber, totalRounds] = roundsInfo.split('/');
          robotName = getRobotName(robotDetails); // Get robot name from robotDetails

          // Extracting Korean date and time
          const [koreanDate, koreanTime] = convertToKoreanDateTime(reply.ts);

          // Format the data as an array for the additional condition
          const rowData = [koreanDate, koreanTime, site.trim(), scenarioId.trim(), robotName.trim(), `순회 중 (${roundNumber}/${totalRounds})`, username];
          data.push(rowData);
        }
      }
    }
  });

  return data;
};

// Function to extract robot name from robotDetails
const getRobotName = (robotDetails) => {
  const robotMatch = robotDetails.match(/\|([^>]*)>/);
  return robotMatch ? robotMatch[1] : '';
};

// Handle MessageShortcut
app.shortcut('slackShortcuts', async ({ shortcut, ack, client }) => {
  // Acknowledge the shortcut request
  await ack();

  try {
    if (shortcut.message.thread_ts) {
      // Check if there is a thread_ts
      console.log('--- Thread Replies ---');

      const userInfo = await client.users.info({
        user: shortcut.user.id,
      });
      const { real_name } = userInfo.user;

      const threadReplies = await fetchAllReplies(shortcut.message.thread_ts, shortcut.channel.id);
      if (threadReplies.length > 0) {
        const parsedData = parseThreadReplies(threadReplies, real_name);

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
