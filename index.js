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
      //match = reply.text.match(/\[(.*?)\]\[#(\d+)\][^:]+:\s*(.*?)\s*\((코스명:)?\s*(.*?),\s*(.*?)\)/);
      match = reply.text.match(/\[([^\]]*?)\]\[#(\d+)\]\[<[^>]*\|([^\]]*?)>\]\s*:(.*?)\((?:코스명:)?\s*([^,]*?),\s*(.*?)\)/);
      if (match) {
        [, site, currentScenarioId, robotName, , courseName, rounds] = match;
        // robotName = getRobotName(robotDetails); // Get robot name from robotDetails
        // scenarioId = currentScenarioId.trim();
        // courseName = currentCourse.trim();
        scenarioId = currentScenarioId;

        // Extracting Korean date and time
        //const [koreanDate, koreanTime] = convertToKoreanDateTime(reply.ts);

        // Format the data as an array for the second condition
        //const rowData = [koreanDate, koreanTime, site.trim(), scenarioId, robotName.trim(), courseName, username];
        //data.push(rowData);
      } else {
        // Additional check for '순회 시작' in a thread with course information
        if (courseName && reply.text.includes('순회 시작')) {
          [, site, robotDetails, roundsInfo] = reply.text.match(/\[(.*?)\]\s*(.*?)\s*(\d+\/\d+)\s*(순회 시작)/);
          [roundNumber, totalRounds] = roundsInfo.split('/');

          // Extracting Korean date and time
          const [koreanDate, koreanTime] = convertToKoreanDateTime(reply.ts);

          // Format the data as an array for the additional condition
          const rowData = [koreanDate, koreanTime, site.trim(), `${scenarioId.trim()}_${roundNumber}`, robotName, courseName, username];
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

const isSOLog = (reply) => {
  return reply.text.includes('배차 기록 전송 완료') && reply.bot_profile && reply.bot_profile.name === '운영일지(SO)';
};

const isScenarioEnd = (reply) => {
  return !reply.text.includes('시나리오가 마무리 되었습니다.');
};


app.shortcut('setupShortcuts', async ({ shortcut, ack, client }) => {
  // Acknowledge the shortcut request
  await ack();

  try {
    // Call views.open with the built-in client
    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        submit: {
          type: 'plain_text',
          text: '다음 단계',
          emoji: true,
        },
        close: {
          type: 'plain_text',
          text: '취소',
          emoji: true,
        },
        title: {
          type: 'plain_text',
          text: '셋업 요청',
          emoji: true,
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: ':wave: 사용자 이름!\n\n설명',
              emoji: true,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              action_id: 'plain_text_input-action',
            },
            label: {
              type: 'plain_text',
              text: '고객사',
              emoji: true,
            },
          },
          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              action_id: 'plain_text_input-action',
            },
            label: {
              type: 'plain_text',
              text: '사이트 지역',
              emoji: true,
            },
          },
          {
            type: 'input',
            element: {
              type: 'datepicker',
              initial_date: '1990-04-28',
              placeholder: {
                type: 'plain_text',
                text: 'Select a date',
                emoji: true,
              },
              action_id: 'datepicker-action',
            },
            label: {
              type: 'plain_text',
              text: '셋업 완료 희망일',
              emoji: true,
            },
          },
          {
            type: 'input',
            element: {
              type: 'radio_buttons',
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: '캠핑',
                    emoji: true,
                  },
                  value: 'value-0',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '순찰',
                    emoji: true,
                  },
                  value: 'value-1',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '시연',
                    emoji: true,
                  },
                  value: 'value-2',
                },
              ],
              action_id: 'radio_buttons-action',
            },
            label: {
              type: 'plain_text',
              text: '요청 타입',
              emoji: true,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error(error);
  }
});

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
        let scenarioNotEnded = true; // Flag to track if scenario has not ended
        for (let i = 0; i < threadReplies.length; i++) {
          const reply = threadReplies[i];
          if (isSOLog(reply)) {
            await app.client.chat.postMessage({
              token: process.env.SLACK_BOT_TOKEN,
              channel: shortcut.channel.id,
              thread_ts: shortcut.message.thread_ts, // Reply to the main thread
              text: `이미 전송된 기록입니다. 요청자 : ${real_name}`, // Customize your reply text here
            });
            return null; // Return null if no SO log reply is found;
          }

          if (!isScenarioEnd(reply)) {
            scenarioNotEnded = false; // Scenario has ended
          }
        }

        if (scenarioNotEnded) {
          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: shortcut.channel.id,
            thread_ts: shortcut.message.thread_ts, // Reply to the main thread
            text: `완료되지 않은 시나리오 입니다. 요청자: ${real_name}`, // Customize your reply text here
          });
          return null; // Return null if the scenario has not ended
        }

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
            text: `배차 기록 전송 완료. 요청자 : ${real_name}`, // Customize your reply text here
          });
        } catch (error) {
          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: shortcut.channel.id,
            thread_ts: shortcut.message.thread_ts, // Reply to the main thread
            text: `전송에 실패했습니다. 요청자 : ${real_name}`, // Customize your reply text here
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
