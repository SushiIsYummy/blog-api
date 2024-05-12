const passport = require('passport');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const utils = require('../utils/utils');
const ROLES = require('../config/roles');

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
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect username or password.',
        data: null,
      });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      existingUser.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect username or password.',
        data: null,
      });
    }

    const payload = {
      userId: existingUser._id,
      username: existingUser.username,
      role: ROLES.USER,
      profile_photo: existingUser.profile_photo,
    };

    const token = utils.generateJwtToken(payload);
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: 'success',
      message: 'You have logged in successfully.',
      data: {
        user: {
          userId: existingUser._id,
          username: existingUser.username,
          role: ROLES.USER,
          profile_photo: existingUser.profile_photo,
        },
        token: token,
      },
    });
  }),
];

exports.checkStatus = asyncHandler(async (req, res, next) => {
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

exports.logoutUser = asyncHandler(async (req, res, next) => {
  res.clearCookie('jwt');
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});
