const Blog = require('../models/blog');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const ROLES = require('../config/roles');

// Get all blog on GET.
exports.getBlogs = asyncHandler(async (req, res, next) => {
  const userId = req.query.userId;

  let query = {};

  if (userId) {
    query.user = userId;
  }

  const blogs = await Blog.find(query).exec();
  return res.status(200).json({
    status: 'success',
    data: {
      blogs: blogs,
    },
  });
});

exports.getBlogsByUser = asyncHandler(async (req, res, next) => {
  const blogs = await Blog.find({ author: req.params.userId }).exec();
  return res.status(200).json({
    status: 'success',
    data: {
      blogs: blogs,
    },
  });
});

// Get single blog on GET
exports.getBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.blogId)
    .populate('author', 'username first_name last_name')
    .exec();
  if (!blog) {
    return res.status(404).json({ status: 'fail', message: 'Blog not found' });
  }

  return res.status(200).json({
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
  body('description')
    .isLength({ min: 1 })
    .escape()
    .withMessage('Description must be specified.'),
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

    // only allow creating blogs if user is logged in
    const userRole = req?.user?.role;
    if (userRole === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          error: 'You must be logged in to create a blog',
        },
      });
    }

    const blog = new Blog({
      title: req.body.title,
      description: req.body.description,
      author: req.user.userId,
    });

    const result = await blog.save();
    return res.status(201).json({
      status: 'success',
      data: {
        message: 'Blog created successfully',
        blog: {
          _id: blog._id,
          title: req.body.title,
          description: req.body.description,
          author: req.user.userId,
        },
      },
    });
  }),
];

// Delete blog on DELETE.
exports.deleteBlog = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.GUEST) {
    return res.status(403).json({
      status: 'fail',
      data: {
        message: 'You must be logged in to delete a blog',
      },
    });
  }
  const blog = await Blog.findById(req.params.blogId).exec();
  if (!blog) {
    return res.status(404).json({
      status: 'fail',
      data: {
        message: 'Blog not found',
      },
    });
  }

  const existingBlog = await Blog.findById(req.params.blogId).exec();
  if (!existingBlog) {
    return res.status(404).json({
      status: 'fail',
      data: {
        message: 'Blog not found',
      },
    });
  }

  if (req.user.userId.toString() === blog.user.toString()) {
    const deletedBlog = await Blog.findByIdAndDelete(blog._id);
    return res.status(200).json({
      status: 'success',
      data: {
        message: 'Blog deleted successfully',
        blog: deletedBlog,
      },
    });
  } else {
    return res.status(403).json({
      status: 'fail',
      data: {
        message: 'You are unauthorized to delete this blog',
      },
    });
  }
});

// Update blog on PUT.
exports.updateBlog = [
  body('title')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Title must be specified.'),
  body('description')
    .isLength({ min: 1 })
    .escape()
    .withMessage('Description must be specified.'),
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

    // only allow updating blogs if user is logged in
    const userRole = req?.user?.role;
    if (userRole === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          error: 'You must be logged in to update a blog',
        },
      });
    }

    const existingBlog = await Blog.findById(req.params.blogId).exec();
    if (!existingBlog) {
      return res.status(404).json({
        status: 'fail',
        data: {
          message: 'Blog not found',
        },
      });
    }

    const updatedBlog = new Blog({
      title: req.body.title,
      description: req.body.description,
      user: req.user.userId,
      _id: req.params.blogId,
    });

    if (req.user.userId.toString() === existingBlog.user.toString()) {
      const updatedBlogReturned = await Blog.findByIdAndUpdate(
        req.params.blogId,
        updatedBlog,
        { new: true }
      );
      return res.status(200).json({
        status: 'success',
        data: {
          message: 'Blog updated successfully',
          user: {
            title: req.body.title,
            description: req.body.description,
          },
        },
      });
    } else {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to update this blog',
        },
      });
    }
  }),
];
