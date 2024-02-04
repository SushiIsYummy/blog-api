const express = require('express');
const UserController = require('../controllers/userController');
const BlogController = require('../controllers/blogController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');
const authenticateUser = require('../middleware/authenticateUserMiddleware');
const router = express.Router();

const validateObjectIdUser = validateObjectIdMiddleware('userId', 'User');

router.get('/', UserController.getAllUsers);
router.get(
  '/:userId',
  validateObjectIdUser,
  authenticateUser,
  UserController.getUser
);
router.post('/', UserController.createUser);
router.put(
  '/:userId/update-profile',
  validateObjectIdUser,
  UserController.updateUserProfile
);
router.put(
  '/:userId/update-password',
  validateObjectIdUser,
  UserController.updateUserPassword
);
router.delete('/:userId', UserController.deleteUser);

// blog relates routes
router.get(
  '/:userId/blogs',
  validateObjectIdUser,
  BlogController.getBlogsByUser
);

module.exports = router;
