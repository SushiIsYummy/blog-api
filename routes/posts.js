const express = require('express');
const PostController = require('../controllers/postController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');
const router = express.Router();

// const validateObjectIdPost = validateObjectIdMiddleware('postId', 'Post');

router.get('/', PostController.getPosts);

module.exports = router;
