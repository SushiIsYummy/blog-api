const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

exports.loginUser = asyncHandler(async (req, res, next) => {
  res.send('login user not implemented');
});
exports.logoutUser = asyncHandler(async (req, res, next) => {
  res.send('logout user not implemented');
});
