const { isAuthenticated } = require("./_auth");
const { json } = require("./_response");

exports.handler = async (event) => {
  return json(200, {
    authenticated: isAuthenticated(event.headers),
  });
};
