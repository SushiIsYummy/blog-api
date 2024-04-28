const express = require('express');
const router = express.Router();
const BlogController = require('../controllers/blogController');
const PostController = require('../controllers/postController');
const PostCommentController = require('../controllers/postCommentController');
const validateObjectIdMiddleware = require('../middleware/validateObjectIdMiddleware');
const authorizePostOwner = require('../middleware/authorizePostOwner');

const validateObjectIdBlog = validateObjectIdMiddleware('blogId', 'Blog');
const validateObjectIdPost = validateObjectIdMiddleware('postId', 'Post');
const validateObjectIdComment = validateObjectIdMiddleware(
  'commentId',
  'PostComment'
);

// Blog routes
router.get('/', validateObjectIdBlog, BlogController.getBlogs);
router.get('/:blogId', validateObjectIdBlog, BlogController.getBlog);

router.get(
  '/:blogId/posts/comments',
  PostCommentController.getAllPostCommentsByBlog
);

router.post('/', BlogController.createBlog);
router.put('/:blogId', validateObjectIdBlog, BlogController.updateBlog);
router.delete('/:blogId', validateObjectIdBlog, BlogController.deleteBlog);

// Post routes
router.get('/:blogId/posts', PostController.getPostsByBlog);
router.get(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  PostController.getPostById
);
router.post('/:blogId/posts', validateObjectIdBlog, PostController.createPost);
router.put(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  authorizePostOwner,
  PostController.updatePostContent
);
router.delete(
  '/:blogId/posts/:postId',
  validateObjectIdBlog,
  validateObjectIdPost,
  PostController.deletePost
);

module.exports = router;
