const Post = require('../models/post');
const Blog = require('../models/blog');
const asyncHandler = require('express-async-handler');
const { body, query, validationResult } = require('express-validator');
const validator = require('validator');
const ROLES = require('../config/roles');

// Get all published posts on GET.
exports.getPosts = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
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
    const posts = await Post.find({ published: true })
      .limit(req.query.limit)
      .populate('author', 'first_name last_name profile_photo')
      .exec();
    if (!posts) {
      return res
        .status(404)
        .json({ status: 'fail', data: { message: 'Posts not found' } });
    }

    const unescapedPosts = posts.map((post) => {
      post.title = validator.unescape(post.title);
      post.content = validator.unescape(post.content);
      return post;
    });
    return res.status(200).json({
      status: 'success',
      data: {
        posts: unescapedPosts,
      },
    });
  }),
];

exports.getPostsByBlog = asyncHandler(async (req, res, next) => {
  const posts = await Post.find({}).exec();
  if (!posts) {
    return res.status(404).json({ status: 'fail', message: 'Posts not found' });
  }
  return res.status(200).json({
    status: 'success',
    data: {
      posts: posts,
    },
  });
});

// Get post by id on GET.
exports.getPost = asyncHandler(async (req, res, next) => {
  const post = await Post.find(req.params.postId).populate('comments').exec();
  if (!post) {
    return res.status(404).json({ status: 'fail', message: 'Post not found' });
  }
  return res.status(200).json({
    status: 'success',
    data: {
      post: post,
    },
  });
});

// Create post on POST
exports.createPost = [
  body('title')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Title of post must be specified.'),
  body('content')
    .isLength({ min: 1 })
    .escape()
    .withMessage('Post content must be specified'),
  body('published').isBoolean(),
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

    // prevent logged in users from creating a post
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to create a post',
        },
      });
    }

    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      published: req.body.published,
      blog: req.params.blogId,
      author: req.user.id,
    });

    const createdPost = await post.save();

    await Blog.findByIdAndUpdate(req.params.blogId, {
      $push: { posts: createdPost._id },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        user: {
          title: req.body.title,
          content: req.body.content,
          published: req.body.published,
        },
      },
    });
  }),
];

// Update post on PUT.
exports.updatePost = [
  body('title')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Title of post must be specified.')
    .optional(),
  body('content')
    .isLength({ min: 1 })
    .escape()
    .withMessage('Post content must be specified')
    .optional(),
  body('published').isBoolean(),
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

    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      published: req.body.published,
    });

    const updatedPost = await Post.findByIdAndUpdate(req.params.postId, post);

    return res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
      },
    });
  }),
];

// Delete post by id on DELETE
exports.deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.postId).exec();
  if (!post) {
    return res.status(404).json({ status: 'fail', message: 'Post not found' });
  }

  // only allow author of post to delete the post
  if (req.user.id !== post.author._id.toString()) {
    return res.status(403).json({
      status: 'fail',
      data: {
        message: 'You are unauthorized to delete this post',
      },
    });
  }

  const deletedPost = await Post.findByIdAndDelete(req.params.postId);
  return res.status(200).json({
    status: 'success',
    data: {
      post: deletedPost,
    },
  });
});
