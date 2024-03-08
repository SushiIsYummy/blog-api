const express = require('express');
const PostController = require('../controllers/postController');
const PostVoteController = require('../controllers/postVoteController');
const PostCommentController = require('../controllers/postCommentController');
const PostCommentVoteController = require('../controllers/postCommentVoteController');
const router = express.Router();

router.get('/', PostController.getPosts);
router.get('/:postId', PostController.getPostById);
router.get('/:postId/votes', PostVoteController.getVotesByPost);
router.put('/:postId/votes/vote', PostVoteController.updateVoteOnPost);
router.delete('/:postId/votes/vote', PostVoteController.deleteVoteOnPost);
router.get('/:postId/comments', PostCommentController.getCommentsOnPost);
router.post('/:postId/comments', PostCommentController.createCommentOnPost);
router.put(
  '/:postId/comments/:commentId',
  PostCommentController.updatePostComment
);
router.get(
  '/:postId/comments/:commentId/votes',
  PostCommentVoteController.getVotesOnPostComment
);
router.put(
  '/:postId/comments/:commentId/votes/vote',
  PostCommentVoteController.updateVoteOnPostComment
);
router.delete(
  '/:postId/comments/:commentId/votes/vote',
  PostCommentVoteController.deleteVoteOnPostComment
);
router.get(
  '/:postId/comments/:commentId/replies',
  PostCommentController.getRepliesOnPostComment
);

module.exports = router;
