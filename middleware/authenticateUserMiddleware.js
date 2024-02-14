const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../config/roles');

const authenticateUser = async (req, res, next) => {
  // check for authorization in header
  // const authHeader = req?.headers?.authorization;
  // if (!authHeader) {
  //   // no user authenticated
  //   req.user = { role: ROLES.GUEST };
  //   return next();
  //   // res.status(401).json({
  //   //   status: 'fail',
  //   //   data: { error: 'Authorization header missing' },
  //   // });
  // }

  // const tokenParts = authHeader.split(' ');

  // check if token is in valid format: Bearer <token>
  // if (
  //   tokenParts.length !== 2 ||
  //   tokenParts[0] !== 'Bearer' ||
  //   tokenParts[1].match(/\S+\.\S+\.\S+/) === null
  // ) {
  //   return res.status(401).json({
  //     status: 'fail',
  //     data: { error: 'Invalid authorization format' },
  //   });
  // }
  const token = req.cookies.jwt;
  if (!token) {
    req.user = { role: ROLES.GUEST };
    return next();
  }
  const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
  try {
    // const decoded = jwt.verify(tokenParts[1], JWT_PUBLIC_KEY, {
    //   algorithms: ['RS256'],
    // });
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    });
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: ROLES.USER,
      profile_photo: decoded.profile_photo,
    };
    return next();
  } catch (err) {
    console.error(err.response);
    req.user = { role: ROLES.GUEST };
    return next();
  }
};

module.exports = authenticateUser;
