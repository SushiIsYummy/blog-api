const Post = require('../models/post');
const Blog = require('../models/blog');
const PostVote = require('../models/postVote');
const asyncHandler = require('express-async-handler');
const { body, query, validationResult } = require('express-validator');
const validator = require('validator');
const ROLES = require('../config/roles');
const { ObjectId } = require('mongoose').Types;

// Get all published posts on GET.
exports.getPosts = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
  // so far the only option is 'newest'
  query('sort_by')
    .optional()
    .custom((value) => {
      if (value !== 'newest') {
        throw new Error('sort_by parameter must be "newest"');
      }
      return true;
    }),
  query('author_id')
    .optional()
    .custom((value) => {
      if (!ObjectId.isValid(value)) {
        throw new Error('author_id must be of type ObjectId');
      }
      return true;
    }),
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
    let findQuery = { published: true };

    if (req.query.author_id) {
      findQuery.author = req.query.author_id;
    }

    let postQuery = Post.find(findQuery)
      .limit(req.query.limit)
      .populate('author', 'first_name last_name profile_photo')
      .populate('blog');

    if (req.query.sort_by === 'newest') {
      postQuery = postQuery.sort({ created_at: -1 });
    }

    const posts = await postQuery.exec();
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
  const posts = await Post.find({ blog: req.params.blogId }).exec();
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
exports.getPostById = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.postId)
    .populate('author', 'username first_name last_name profile_photo')
    .populate('blog')
    .populate('comments')
    .exec();
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

// Get votes by post on GET.
exports.getVotesByPost = asyncHandler(async (req, res, next) => {
  const { upvotes, downvotes } = await getPostUpvotesAndDownvotes(
    req.params.postId
  );

  let userVote = await PostVote.findOne({
    post: req.params.postId,
    user: req.user.userId,
  });

  let userVoteValue = null;
  if (userVote) {
    userVoteValue = userVote.vote_value;
  }

  return res.status(200).json({
    status: 'success',
    data: {
      upvotes: upvotes,
      downvotes: downvotes,
      user_vote: userVoteValue ? userVoteValue : undefined,
    },
  });
});

async function getPostUpvotesAndDownvotes(postId) {
  try {
    const convertedPostId = new ObjectId(postId);
    const aggregationPipeline = [
      { $match: { post: convertedPostId } },
      {
        $group: {
          _id: '$vote_value',
          count: { $sum: 1 },
        },
      },
    ];

    const result = await PostVote.aggregate(aggregationPipeline);

    let upvotes = 0;
    let downvotes = 0;

    result.forEach((item) => {
      if (item._id === 'UPVOTE') {
        upvotes = item.count;
      } else if (item._id === 'DOWNVOTE') {
        downvotes = item.count;
      }
    });

    return { upvotes, downvotes };
  } catch (error) {
    console.error('Error fetching upvotes and downvotes:', error);
    throw error;
  }
}

// update vote on post on POST.
exports.updateVoteOnPost = [
  body('vote_value')
    .isIn(['UPVOTE', 'DOWNVOTE'])
    .withMessage('Vote value must be "UPVOTE" or "DOWNVOTE"'),
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

    // prevent logged out users from creating a post
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to vote on a post',
        },
      });
    }

    const updatedPostVote = await PostVote.findOneAndUpdate(
      {
        post: req.params.postId,
        user: req.user.userId,
      },
      {
        $set: {
          post: req.params.postId,
          user: req.user.userId,
          vote_value: req.body.vote_value,
        },
      },
      {
        upsert: true,
        new: true,
      }
    ).exec();

    return res.status(200).json({
      status: 'success',
      data: {
        updated_post_vote: updatedPostVote,
      },
    });
  }),
];

// delete vote on post on DELETE
exports.deleteVoteOnPost = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.GUEST) {
    return res.status(403).json({
      status: 'fail',
      data: {
        message: 'You are unauthorized to delete a vote on this post',
      },
    });
  }

  const deletedVote = await PostVote.findOneAndDelete({
    post: req.params.postId,
    user: req.user.userId,
  });

  // if no vote is found, it means the user neither upvoted or downvoted
  if (!deletedVote) {
    return res.status(200).json({
      status: 'success',
      data: {
        message: 'Vote not found',
      },
    });
  }

  return res.status(200).json({
    status: 'success',
    data: {
      message: 'Vote on post deleted successfully',
      deleted_vote: deletedVote,
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
  body('subheading').escape().optional(),
  body('content').optional(),
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

    // prevent logged out users from creating a post
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to create a post',
        },
      });
    }

    const blog = await Blog.findById(req.params.blogId)
      .populate('author')
      .exec();
    if (!blog || !(blog.author._id.toString() === req.user.userId)) {
      return res.status(400).json({
        status: 'fail',
        data: {
          message:
            'Blog does not exist or you are trying to create a post on a blog you do not own',
        },
      });
    }

    const post = new Post({
      title: req.body.title,
      subheading: req.body.subheading,
      content: req.body.content,
      published: req.body.published,
      cover_image: req.body.cover_image,
      blog: req.params.blogId,
      author: req.user.userId,
    });

    const createdPost = await post.save();

    await Blog.findByIdAndUpdate(req.params.blogId, {
      $push: { posts: createdPost._id },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        post: createdPost,
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
    .withMessage('Title of post must be specified.'),
  body('subheading').escape().optional(),
  body('content').optional(),
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
      subheading: req.body.subheading,
      content: req.body.content,
      published: req.body.published,
      cover_image: req.body.cover_image,
      blog: req.params.blogId,
      author: req.user.userId,
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
  if (req.user.userId !== post.author._id.toString()) {
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
