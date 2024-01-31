const Blog = require('../models/blog');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

// Get all blog on GET.
exports.getAllBlogs = asyncHandler(async (req, res, next) => {
  const allBlogs = await Blog.find().exec();
  res.status(200).json({
    status: 'success',
    data: {
      blogs: allBlogs,
    },
  });
});

// Get single blog on GET
exports.getBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.find(req.params.blogId).exec();
  if (!blog) {
    res.status(404).json({ status: 'fail', message: 'Blog not found' });
  }
  res.status(200).json({
    status: 'success',
    data: {
      blog: blog,
    },
  });
});

// Create blog on POST.
exports.createBlog = [
  body('title')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Title must be specified.'),
  body('content')
    .isLength({ min: 1 })
    .escape()
    .withMessage('Content must be specified.'),
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

    const blog = new Blog({
      title: req.body.title,
      content: req.body.content,
    });

    const result = await blog.save();
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

// Delete blog on DELETE.
exports.deleteBlog = asyncHandler(async (req, res, next) => {
  res.send('NOT IMPLEMENTED: delete blog DELETE');
});

// Update blog on PUT.
exports.updateBlog = asyncHandler(async (req, res, next) => {
  res.send('NOT IMPLEMENTED: blog update PUT');
});
