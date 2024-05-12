const Post = require('../models/post');
const Blog = require('../models/blog');
const PostComment = require('../models/postComment');
const PostVote = require('../models/postVote');
const asyncHandler = require('express-async-handler');
const { body, query, validationResult } = require('express-validator');
const validator = require('validator');
const ROLES = require('../config/roles');
const { ObjectId } = require('mongoose').Types;
const mongoose = require('mongoose');

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
        .json({ status: 'fail', message: 'Posts not found.', data: null });
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
  // const { trashed, published } = req.query;
  const { selected_option } = req.query;

  let sortOptions = {};
  const query = {};
  query.blog = req.params.blogId;
  query.trashed_at = null;
  // query.published = false;

  if (selected_option === 'all') {
    sortOptions = { updated_at: -1, created_at: -1 };
  } else if (selected_option === 'published') {
    query.published = true;
    sortOptions = { updated_at: -1, created_at: -1 };
  } else if (selected_option === 'draft') {
    query.published = false;
    sortOptions = { updated_at: -1, created_at: -1 };
  } else if (selected_option === 'trash') {
    query.trashed_at = { $ne: null };
    sortOptions = { trashed_at: -1 };
  }

  // if (selected_option === 'trash') {
  //   query.trashed_at = { $ne: null };
  //   sortOptions = { trashed_at: -1 };
  // } else if (trashed === 'false') {
  //   query.trashed_at = null;
  //   sortOptions = { content_updated_at: -1, created_at: -1 };
  // }

  // if (published === 'true') {
  //   query.published = true;
  //   sortOptions = { published_at: -1 };
  // } else if (published === 'false') {
  //   query.published = false;
  // }

  const posts = await Post.find(query)
    .sort(sortOptions)
    .populate('author', 'username first_name last_name profile_photo')
    .exec();

  if (!posts) {
    return res
      .status(404)
      .json({ status: 'fail', message: 'Posts not found.' });
  }
  return res.status(200).json({
    status: 'success',
    data: {
      posts: posts,
    },
  });
});

exports.getPostById = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.postId)
    .populate('author', 'username first_name last_name profile_photo')
    .populate('blog')
    .exec();
  if (!post) {
    return res.status(404).json({ status: 'fail', message: 'Post not found.' });
  }
  return res.status(200).json({
    status: 'success',
    data: {
      post: post,
    },
  });
});

exports.createPost = [
  body('title').trim().escape().optional(),
  body('subheading').escape().optional(),
  body('content').optional(),
  body('published').isBoolean().optional(),
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
        message: 'You are unauthorized to create a post.',
        data: null,
      });
    }

    const blog = await Blog.findById(req.params.blogId)
      .populate('author', 'username first_name last_name profile_photo')
      .exec();
    if (!blog || !(blog.author._id.toString() === req.user.userId)) {
      return res.status(400).json({
        status: 'fail',
        message:
          'Blog does not exist or you are trying to create a post on a blog you do not own.',
        data: null,
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

exports.updatePostContent = [
  body('title').trim().optional(),
  body('subheading').optional(),
  body('content').optional(),
  body('cover_image').optional(),
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

    const updatedPost = req.foundPost;

    if (req.body.title !== undefined) {
      updatedPost.title = req.body.title;
    }
    if (req.body.subheading !== undefined) {
      updatedPost.subheading = req.body.subheading;
    }
    if (req.body.content !== undefined) {
      updatedPost.content = req.body.content;
    }
    if (req.body.cover_image !== undefined) {
      updatedPost.cover_image = req.body.cover_image;
    }
    updatedPost.content_updated_at = new Date();

    await updatedPost.save();

    return res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
      },
    });
  }),
];

exports.updatePostPublishStatus = [
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

    const updatedPost = req.foundPost;

    if (req.body.published !== undefined) {
      updatedPost.published = req.body.published;
    }

    // published_at is only set the first time a post is published
    if (updatedPost.published_at === null) {
      updatedPost.published_at = new Date();
    }

    await updatedPost.save();

    return res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
      },
    });
  }),
];

exports.deletePost = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;
  const post = req.foundPost;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // delete all comments on post
    const commentsDeletionResult = await PostComment.deleteMany({
      post: postId,
    });
    console.log(`${commentsDeletionResult.deletedCount} comments deleted.`);

    // delete post
    const deletedPost = await Post.deleteOne({ _id: postId })
      .session(session)
      .exec();

    if (!deletedPost) {
      throw new Error();
    }
    throw Error();
    // await session.commitTransaction();

    // return res.status(200).json({
    //   status: 'success',
    // });
  } catch (error) {
    console.log('Transaction aborted due to an error: ', error.message);
    await session.abortTransaction();
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete the post and/or comments..',
    });
  } finally {
    session.endSession();
  }
});

exports.movePostToTrash = asyncHandler(async (req, res, next) => {
  const trashedPost = req.foundPost;

  try {
    trashedPost.trashed_at = new Date();
    // trashedPost.published = false;
    await trashedPost.save();

    return res.status(200).json({
      status: 'success',
      data: {
        post: trashedPost,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: 'fail',
      message: 'Failed to move post to trash.',
    });
  }
});

exports.restorePostFromTrash = asyncHandler(async (req, res, next) => {
  const restoredPost = req.foundPost;

  try {
    restoredPost.trashed_at = null;

    const action = req.body.action;
    // console.log(req.query);
    // console.log(`poo: ${req.query.poo}`);
    // console.log(`action: ${req.query.action}`);
    if (action === 'draft') {
      restoredPost.published = false;
    } else if (action === 'publish') {
      restoredPost.published = true;
    }

    await restoredPost.save();

    return res.status(200).json({
      status: 'success',
      data: {
        post: restoredPost,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: 'fail',
      message: 'Failed to restore post.',
    });
  }
});
