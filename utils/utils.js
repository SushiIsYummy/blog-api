const jwt = require('jsonwebtoken');

const generateJwtToken = (user) => {
  const privateKey = process.env.JWT_PRIVATE_KEY;

  const token = jwt.sign(user, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1d',
  });

  return token;
};

module.exports.generateJwtToken = generateJwtToken;
