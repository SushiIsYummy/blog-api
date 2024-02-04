const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../config/roles');

const authenticateUser = async (req, res, next) => {
  // check for authorization in header
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    // no user authenticated
    req.user = { role: ROLES.GUEST };
    return next();
    // res.status(401).json({
    //   status: 'fail',
    //   data: { error: 'Authorization header missing' },
    // });
  }

  const tokenParts = authHeader.split(' ');

  // check if token is in valid format: Bearer <token>
  if (
    tokenParts.length !== 2 ||
    tokenParts[0] !== 'Bearer' ||
    tokenParts[1].match(/\S+\.\S+\.\S+/) === null
  ) {
    return res.status(401).json({
      status: 'fail',
      data: { error: 'Invalid authorization format' },
    });
  }
  const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
  try {
    const decoded = jwt.verify(tokenParts[1], JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    });
    req.user = { id: decoded.userId, role: ROLES.USER };
    return next();
  } catch (err) {
    // console.error(err);
    req.user = { role: ROLES.GUEST };
    return next();
  }
};

module.exports = authenticateUser;
