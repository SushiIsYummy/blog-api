const Post = require('../models/post');
const { ObjectId } = require('mongoose').Types;
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

// Get all published posts on GET.
exports.getAllPosts = asyncHandler(async (req, res, next) => {
  const posts = await Post.find({ published: true })
    .populate('comments')
    .exec();
  if (!posts) {
    res.status(404).json({ status: 'fail', message: 'Posts not found' });
  }
  res.status(200).json({
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
    res.status(404).json({ status: 'fail', message: 'Post not found' });
  }
  res.status(200).json({
    status: 'success',
    data: {
      post: post,
    },
  });
});

// Delete post by id on DELETE
exports.deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.find(req.params.postId).exec();
  if (!post) {
    res.status(404).json({ status: 'fail', message: 'Post not found' });
  }

  await Post.findByIdAndDelete(req.params.postId);
  res.status(200).json({
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
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        status: 'fail',
        data: {
          errors: errors.array(),
        },
      });
    }

    const post = new Post({
      title: req.body.title,
      content: req.body.content,
    });

    const result = await post.save();

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          title: req.body.title,
          content: req.body.content,
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
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        status: 'fail',
        data: {
          errors: errors.array(),
        },
      });
    }

    const post = new Post({
      title: req.body.title,
      content: req.body.content,
    });

    const updatedPost = await Post.findByIdAndUpdate(req.params.postId, post);

    res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
      },
    });
  }),
];

// Handle post delete on DELETE.
exports.deletePost = asyncHandler(async (req, res, next) => {
  res.send('NOT IMPLEMENTED: delete post DELETE');
});
