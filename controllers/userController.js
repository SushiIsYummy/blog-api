const User = require('../models/user');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const utils = require('../utils/utils');
const ROLES = require('../config/roles');

// Get all users on GET.
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find().exec();
  if (users.length <= 0) {
    res
      .status(404)
      .json({ status: 'fail', data: { message: 'No users found.' } });
  }
  return res.json({ users: users });
});

// Get single user on GET.
exports.getUser = [
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.userId)
      .select('-password -_id')
      .populate('blogs')
      .exec();
    if (!user) {
      res
        .status(404)
        .json({ status: 'fail', data: { message: 'User not found' } });
    }
    return res.status(200).json({ user: user });
  }),
];

// Handle user creation on POST.
exports.createUser = [
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('First name must be specified.'),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Last name must be specified.'),
  body('username')
    .custom((username) => !/\s/.test(username))
    .withMessage('No spaces are allowed in the username')
    .custom(async (username) => {
      const existingUser = await User.findOne({ username: username }).exec();
      if (existingUser) {
        throw new Error('The username is already taken.');
      }
      return true;
    })
    .withMessage('The username is already taken.')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Username must be specified.'),
  // TODO: Password input currently has no strict requirements.
  // Consider adding password strength validation rules in the future if needed.
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password must be specified.'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  }),
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

    try {
      bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
        if (err) {
          throw new Error();
        }
        // store hashedPassword in DB
        const user = new User({
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          username: req.body.username,
          password: hashedPassword,
        });
        const savedUser = await user.save();

        const payload = {
          userId: savedUser._id,
          username: savedUser.username,
          role: ROLES.USER,
          profile_photo: savedUser.profile_photo,
        };

        const token = utils.generateJwtToken(payload);

        res.cookie('jwt', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000,
        });
        return res.status(201).json({
          status: 'success',
          data: {
            user: {
              first_name: req.body.first_name,
              last_name: req.body.last_name,
              username: req.body.username,
            },
            token: token,
          },
        });
      });
    } catch (err) {
      return next(err);
    }
  }),
];

// Delete user on POST.
exports.deleteUser = asyncHandler(async (req, res, next) => {
  return res.send('NOT IMPLEMENTED: delete user');
});

// Update user on POST.
exports.updateUserProfile = [
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('First name must be specified.')
    .optional(),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Last name must be specified.')
    .optional(),
  body('username')
    .custom((username) => !/\s/.test(username))
    .withMessage('No spaces are allowed in the username')
    .custom(async (username) => {
      const existingUser = await User.findOne({ username: username });
      if (existingUser) {
        throw new Error('The username is already taken.');
      }
      return true;
    })
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Username must be specified.')
    .optional(),
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

    const updateData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      username: req.body.username,
    };

    // update user
    let updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: updateData,
      },
      { new: true }
    )
      .select('first_name last_name username -_id')
      .exec();

    return res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  }),
];

const validateOldPassword = async (value, { req }) => {
  const user = await User.findById(req.params.userId).exec();
  if (!user) {
    throw new Error('User not found');
  }

  // Compare old password with hashed password in the database
  const isPasswordValid = await bcrypt.compare(value, user.password);

  if (!isPasswordValid) {
    throw new Error('Old password is incorrect');
  }
  return true;
};

exports.updateUserPassword = [
  body('old_password')
    .isLength({ min: 1 })
    .withMessage('Old password must be specified')
    .custom(validateOldPassword),
  body('new_password')
    .isLength({ min: 1 })
    .withMessage('New password must be specified')
    .custom((value, { req }) => {
      if (value === req.body.old_password) {
        throw new Error('New password is the same as old password');
      }
      return true;
    }),
  body('confirm_new_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
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

    // update password if inputs are valid
    try {
      bcrypt.hash(req.body.new_password, 10, async (err, hashedPassword) => {
        if (err) {
          throw new Error();
        }

        const result = await User.findByIdAndUpdate(req.params.userId, {
          $set: { password: hashedPassword },
        });

        return res.status(200).json({
          status: 'success',
          data: {
            message: 'Password updated',
          },
        });
      });
    } catch (err) {
      return next(err);
    }
  }),
];

exports.updateUserAbout = [
  asyncHandler(async (req, res, next) => {
    // forbid users from updating other user's about
    // if (!(req.user?.id?.toString() === req.params.userId)) {
    //   return res.status(403).json({
    //     status: 'fail',
    //     data: {
    //       message: "You are unauthorized to update this User's about",
    //     },
    //   });
    // }
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, {
      $set: {
        about: req.body.about,
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        message: "User's about updated",
      },
    });
  }),
];
