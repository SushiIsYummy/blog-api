const express = require('express');
const UserController = require('../controllers/userController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');
const router = express.Router();

const validateObjectIdUser = validateObjectIdMiddleware('userId', 'User');

router.get('/', UserController.getAllUsers);
router.get('/:userId', validateObjectIdUser, UserController.getUser);
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

module.exports = router;
