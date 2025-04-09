import { createServer } from 'mcp-server-stdio';
import axios from 'axios';

const clientId = 'your_client_id';
const clientSecret = 'your_client_secret';

async function getBearerToken() {
  const response = await axios.post('https://connect.patsnap.com/oauth/token', null, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    auth: {
      username: clientId,
      password: clientSecret
    },
    params: {
      grant_type: 'client_credentials'
    }
  });
  return response.data.token;
}

async function fetchPatentInfo(patentNumber: string) {
  const token = await getBearerToken();
  const response = await axios.get(`https://api.patsnap.com/patents/${patentNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
}

const server = createServer({
  fetchPatentInfo
});

server.listen();
