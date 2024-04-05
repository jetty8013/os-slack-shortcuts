const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const { google } = require('googleapis');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

const credentials = {
  client_email: 'jetty8013@crack-linker-414014.iam.gserviceaccount.com',
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8tDxEOVhsgavW\nn1zlSRAkcfnNiMP8JGIVqcDLS08xC5WQhgzpMyytgUM6Eo7JhGimeWxV2yqaINCJ\n+hDggP7sSMWmBE32qpp4FIuGF0mA0IKUjp9/tgMaDRp0x+l+jKlW+JYAqVTVAHIU\nMedkuQP0vlJkwOiIjzEALWBM8sKNkdUc0rOOOg6sA5suFEMqzmybuYICI+5Vpcjl\n9xtY5Jdcjd+VN/1YjOFMV+wh2zPuE/dhJoNC2PllASeZ45gLuVV0NsWaXEn3WBjQ\n9HngHlz7uS+rbquilG8QNJ1m4NSce9bfRlDE7LipE84woDKL90/iv6mSO8D/bOFM\nbmraEAuzAgMBAAECggEANl+oze/ILtvea+VXmynGYPoGhNbXwhupt5xGVU3J79Pq\nsM4vgjKguQ36FQ2r3x0sGmv6b3LLf8Xc0SUhH8+LpQIDEadD38Og5uDkoyqqn1d1\niODfzKjhk+wap3PDMBfP46OVdXNVYlrShEcs6bT2EtuUWjvLxS2dbPOmQAXjUW8n\n5lQ6r0I5AXBUY6LMwQRlvcSfg9byOqvr37uCzMY8Epf8mYWZey928j6uBUr7wPsh\nLCg/AYpCdfUuqZUKiIW1rOUBjI0J8o68fbgNCgcJulnMYxKU8CJGfw9kYmzmfcgT\nRNqmmO+bZNeTOdskM4KtNBSnKpnyv669Z5zwb3x8IQKBgQD/U3Nj6Wmc6KA9XoEv\nu/+FAy0LtoqbTWZQsfqN+zRW0BAnxdJm4y7daFOrdIOC4ze9mTvmL5GdLF1FqDZY\npbgUBbH8qrglKJrriC2H8nqj1xfwEpIlMv7Uh4SGjPNGHg/uDjaiysd9GiQu2nZf\nNbVpbk5FCO8ViHkm4g5X3WlPDwKBgQC9M8L24hO8KmYpUhtk78u44Myzx/WkkN4n\naUyAPU05bxmS6oi9U+WoxKbtK3VI4Al5nUaXhSLCAAiEa9n7fI8+QFYQOM+ZWCNM\nBi41Mb8AiiWhdn8KKvH4AEjL8NkZ3zvnxhTkiKzYzpxwaW+IMsE2dGrzNupXETRL\n3xd3FPx5HQKBgE0njor2ka+UrDdfQ3KFQOWU3BvaAXCEpxJjde9JpbtGDFu4b6gf\npp3JVN9Oyh7XQpTMpUkdvsbcDSNrfWC0UzfZsLtFa3fvGUFrWTbnkx/Hc7hcJEWR\nb2gRu35dQXZCx1WMff4bgMTRDXYLFhIXTMabSpOZ64V6RAH39ZWflp8JAoGAEq8x\n6b+Zw1NMk3gQTH+B1tgcXwS4NXA5ABtd+qwTHEDkfaW7qzbFz0zcTz+jbXbyeJgX\niI8VR6NJNAqSlEtQug0QcrmphrM1iSRzG7215w+9d5yEHzTugFdG2R0H045AFDtz\nhL4ak66TtGY1JXYdrosApNQfgEmqqHN3lcL0y+ECgYEA/fS6iz1IM4rjW6ppBQwN\n9EdUzDFnZVBehcdslxuOIHTtgldpCBaS/Qc4w/d7mRpw5TFb/B+3meTiNE93cCTr\ncQB+XW6RNKre+EkTPUjC1FB5yJkbHWr9GL2XNRY9Rs9T8u70meCn79hrlBvVJzGz\nrg32pDN1Wvt98wi4SUCbkck=\n-----END PRIVATE KEY-----\n",
};

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

        // Send a single message after iterating through all replies
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: shortcut.channel.id,
          thread_ts: shortcut.message.thread_ts, // Reply to the main thread
          text: `운영일지 전송 완료`, // Customize your reply text here
        });
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
