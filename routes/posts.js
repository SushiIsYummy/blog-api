const express = require('express');
const PostController = require('../controllers/postController');
const router = express.Router();

router.get('/', PostController.getPosts);
router.get('/:postId', PostController.getPostById);
router.get('/:postId/votes', PostController.getVotesByPost);
router.put('/:postId/votes/vote', PostController.updateVoteOnPost);
router.delete('/:postId/votes/vote', PostController.deleteVoteOnPost);

module.exports = router;
