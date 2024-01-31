const express = require('express');
const router = express.Router();
const BlogController = require('../controllers/blogController');
const PostController = require('../controllers/postController');
const CommentController = require('../controllers/commentController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');

const validateObjectIdBlog = validateObjectIdMiddleware('blogId', 'Blog');
const validateObjectIdPost = validateObjectIdMiddleware('postId', 'Post');
const validateObjectIdComment = validateObjectIdMiddleware(
  'commentId',
  'Comment'
);

// Blog-related routes
router.get('/', BlogController.getAllBlogs);
router.get('/:blogId', validateObjectIdBlog, BlogController.getBlog);
router.post('/', BlogController.createBlog);
router.put('/:blogId', validateObjectIdBlog, BlogController.updateBlog);
router.delete('/:blogId', validateObjectIdBlog, BlogController.deleteBlog);

// // Post-related routes
router.get('/:blogId/posts', PostController.getAllPosts);
router.get(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  PostController.getPost
);
router.post('/:blogId/posts', validateObjectIdBlog, PostController.createPost);
router.put(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  PostController.updatePost
);
router.delete(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  PostController.deletePost
);

// Comment-related routes
router.get(
  '/:blogId/posts/:postId/comments',
  validateObjectIdBlog,
  validateObjectIdPost,
  CommentController.getAllCommentsByPost
);
router.get(
  '/:blogId/posts/:postId/comments',
  validateObjectIdBlog,
  validateObjectIdPost,
  CommentController.getComment
);
router.post(
  '/:blogId/posts/:postId/comments',
  validateObjectIdBlog,
  validateObjectIdPost,
  CommentController.createComment
);
router.put(
  '/:blogId/posts/:postId/comments/:commentId',
  validateObjectIdBlog,
  validateObjectIdPost,
  validateObjectIdComment,
  CommentController.updateComment
);
router.delete(
  '/:blogId/posts/:postId/comments/:commentId',
  validateObjectIdBlog,
  validateObjectIdPost,
  validateObjectIdComment,
  CommentController.deleteComment
);

module.exports = router;
