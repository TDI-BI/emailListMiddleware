const axios = require('axios');
const { getAccessTokenLists } = require('./getTokens');

const getGroups = async () => {
  const token = await getAccessTokenLists();
  const res = await axios.get(`${process.env.GRAPH_API_URL}/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.value;
};

const getGroupMembers = async groupId => {
  const token = await getAccessTokenLists();
  const res = await axios.get(
    `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.value;
};

const getGroupByName = async name => {
  const token = await getAccessTokenLists();

  const groupRes = await axios.get(
    `${process.env.GRAPH_API_URL}/groups?$filter=mail eq '${name}@tdi-bi.com'`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const groupId = groupRes.data.value[0]?.id;
  if (!groupId) return null;

  return getGroupMembers(groupId);
};

module.exports = {
  getGroups,
  getGroupMembers,
  getGroupByName,
};
