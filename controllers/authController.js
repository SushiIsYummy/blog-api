const passport = require('passport');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const utils = require('../utils/utils');

exports.loginUser = [
  body('username')
    .isLength({ min: 1 })
    .withMessage('Username must be specified')
    .escape(),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password must be specified')
    .escape(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'fail',
        data: {
          errors: errors.array(),
        },
      });
    }

    const existingUser = await User.findOne({
      username: req.body.username,
    }).exec();
    if (!existingUser) {
      return res.status(400).json({
        status: 'fail',
        data: {
          errors: 'Incorrect username or password',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      existingUser.password
    );

    if (!isPasswordValid) {
      return res.status(400).json({
        status: 'fail',
        data: {
          errors: 'Incorrect username or password',
        },
      });
    }

    const payload = {
      userId: existingUser._id,
    };

    const token = utils.generateJwtToken(payload);

    return res.status(200).json({
      status: 'success',
      data: {
        message: 'You have logged in successfully',
        token: token,
      },
    });
  }),
];

exports.logoutUser = asyncHandler(async (req, res, next) => {
  return res.send('logout user not implemented');
});
