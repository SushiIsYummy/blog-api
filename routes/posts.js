const express = require('express');
const PostController = require('../controllers/postController');
const PostVoteController = require('../controllers/postVoteController');
const PostCommentController = require('../controllers/postCommentController');
const PostCommentVoteController = require('../controllers/postCommentVoteController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');
const authorizePostOwner = require('../middleware/authorizePostOwner');
const router = express.Router();

const validateObjectIdBlog = validateObjectIdMiddleware('blogId', 'Blog');
const validateObjectIdPost = validateObjectIdMiddleware('postId', 'Post');
const validateObjectIdComment = validateObjectIdMiddleware(
  'commentId',
  'PostComment'
);

router.get('/', PostController.getPosts);
router.get('/:postId', PostController.getPostById);
router.put('/:postId', authorizePostOwner, PostController.updatePostContent);
router.put(
  '/:postId/publish-status',
  authorizePostOwner,
  PostController.updatePostPublishStatus
);
router.delete('/:postId', authorizePostOwner, PostController.deletePost);
router.get('/:postId/votes', PostVoteController.getVotesByPost);
router.put('/:postId/votes/vote', PostVoteController.updateVoteOnPost);
router.delete('/:postId/votes/vote', PostVoteController.deleteVoteOnPost);
router.get('/:postId/comments', PostCommentController.getCommentsOnPost);
router.get(
  '/:postId/comments/:commentId',
  validateObjectIdPost,
  validateObjectIdComment,
  PostCommentController.getSingleCommentOnPost
);
router.post('/:postId/comments', PostCommentController.createCommentOnPost);
router.delete(
  ':postId/comments',
  PostCommentController.deleteAllCommentsOnPost
);
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

router.put(
  '/:postId/trash',
  authorizePostOwner,
  PostController.movePostToTrash
);
router.put(
  '/:postId/restore',
  authorizePostOwner,
  PostController.restorePostFromTrash
);

module.exports = router;
