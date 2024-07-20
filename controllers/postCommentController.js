const Post = require('../models/post');
const Blog = require('../models/blog');
const PostComment = require('../models/postComment');
const PostCommentLog = require('../models/postCommentLog');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const ROLES = require('../config/roles');
const { isValidObjectId, mongoose } = require('mongoose');
const {
  getCommentsAndCursorByCategory,
  addUserVoteToComments,
  deleteCommentCascade,
} = require('../services/postCommentService');
const { ObjectId } = require('mongoose').Types;

const COMMENTS_PER_PAGE = 50;

exports.getSingleCommentOnPost = [
  asyncHandler(async (req, res, next) => {
    const { postId, commentId } = req.params;

    const postExists = await Post.findById(postId);
    if (!postExists) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Post not found.', data: null });
    }

    const comment = await PostComment.findOne({ post: postId, _id: commentId })
      .populate('author', 'first_name last_name profile_photo username')
      .exec();
    if (!comment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment on post not found.',
        data: null,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        comment: comment,
      },
    });
  }),
];

exports.getCommentsOnPost = [
  asyncHandler(async (req, res, next) => {
    const { postId } = req.params;

    const postExists = await Post.findById(postId);
    if (!postExists) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Post not found.', data: null });
    }

    let { cursor, limit, sort_by, max_created_at, excluded_ids } = req.query;

    limit = parseInt(limit, 10) || 20;

    const excludedIdsArray = excluded_ids
      ? excluded_ids.split(',').map((id) => new ObjectId(id))
      : [];

    let { comments, nextCursor } = await getCommentsAndCursorByCategory(
      postId,
      sort_by,
      limit,
      cursor,
      max_created_at,
      excludedIdsArray
    );

    const userId = req?.user?.userId;
    const userRole = req?.user?.role;
    if (userRole !== ROLES.GUEST) {
      comments = await addUserVoteToComments(comments, postId, userId);
    }

    return res.status(200).json({
      status: 'success',
      data: {
        comments: comments,
      },
      paging: {
        cursors: {
          next: nextCursor,
        },
      },
    });
  }),
];

exports.getRepliesOnPostComment = [
  asyncHandler(async (req, res, next) => {
    const { postId, commentId } = req.params;

    const postExists = await Post.findById(postId);
    if (!postExists) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Post not found.', data: null });
    }

    const commentExists = await PostComment.findOne({
      post: postId,
      _id: commentId,
    });
    if (!commentExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found on post.',
        data: null,
      });
    }

    let { cursor, limit, max_created_at } = req.query;
    limit = parseInt(limit, 10) || 20;

    let commentReplies = [];
    let maxCreatedAtDate =
      max_created_at && !isNaN(new Date(max_created_at).getTime())
        ? new Date(max_created_at)
        : new Date();

    if (!cursor) {
      commentReplies = await PostComment.find({
        post: postId,
        parent: commentId,
        created_at: { $lte: maxCreatedAtDate },
      })
        .sort({ created_at: 1, _id: -1 })
        .limit(limit + 1)
        .populate('author', 'first_name last_name profile_photo username')
        .exec();
    }

    if (cursor) {
      const [cursorId, cursorCreatedAt, cursorMaxCreatedAtDate] =
        cursor.split('_');
      commentReplies = await PostComment.find({
        post: postId,
        parent: commentId,
        created_at: { $lte: new Date(cursorMaxCreatedAtDate) },
        $or: [
          {
            created_at: { $eq: new Date(cursorCreatedAt) },
            _id: { $lt: new ObjectId(cursorId) },
          },
          {
            created_at: { $gt: new Date(cursorCreatedAt) },
          },
        ],
      })
        .sort({ created_at: 1, _id: -1 })
        .limit(limit + 1)
        .populate('author', 'first_name last_name profile_photo username')
        .exec();
    }

    let hasMore = false;
    if (commentReplies.length > limit) {
      hasMore = true;
      commentReplies.pop();
    }

    let nextCursor = null;
    if (commentReplies.length > 0 && hasMore) {
      const lastComment = commentReplies[commentReplies.length - 1];
      let createdAtString = new Date(lastComment['created_at']).toISOString();
      nextCursor = `${
        lastComment._id
      }_${createdAtString}_${maxCreatedAtDate.toISOString()}`;
    }

    const userId = req?.user?.userId;
    const userRole = req?.user?.role;
    if (userRole !== ROLES.GUEST) {
      commentReplies = await addUserVoteToComments(
        commentReplies,
        postId,
        userId
      );
    }

    return res.status(200).json({
      status: 'success',
      data: {
        replies: commentReplies,
      },
      paging: {
        cursors: {
          next: nextCursor,
        },
      },
    });
  }),
];

exports.getAllPostCommentsByBlog = [
  asyncHandler(async (req, res, next) => {
    const { blogId } = req.params;

    const blogExists = await Blog.findById(blogId);
    if (!blogExists) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Blog not found.', data: null });
    }
    // const postExists = await Post.findById(postId);
    // if (!postExists) {
    //   return res
    //     .status(404)
    //     .json({ status: 'fail', data: { message: 'Post not found.' } });
    // }

    // const page = req.query.order_by || 1;

    const page = parseInt(req.query.page) || 1;
    const skipCount = (page - 1) * COMMENTS_PER_PAGE;

    let totalComments = await PostComment.countDocuments({
      blog: blogId,
    }).exec();

    let comments = await PostComment.find({ blog: blogId })
      .skip(skipCount)
      .limit(COMMENTS_PER_PAGE)
      .sort({ created_at: -1 })
      .populate('author', 'first_name last_name profile_photo username')
      .populate('post')
      .exec();

    const totalPages = Math.ceil(totalComments / COMMENTS_PER_PAGE);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 && page <= totalPages ? page - 1 : null;

    // let commentIds = comments.map((comment) => comment._id);

    // let userVotesOnComments = await PostCommentVote.find({
    //   post: postId,
    //   comment: { $in: commentIds },
    //   user: req.user.userId,
    // });

    // const commentVotesObj = {};
    // userVotesOnComments.forEach((obj) => {
    //   commentVotesObj[obj.comment.toString()] = obj.vote_value;
    // });

    // add user vote value on comments if user is logged in
    // const userRole = req?.user?.role;
    // if (userRole !== ROLES.GUEST) {
    //   comments = comments.map((comment) => {
    //     const userVote = commentVotesObj[comment._id.toString()];
    //     if (userVote !== undefined) {
    //     }
    //     return { ...comment.toObject(), user_vote: userVote };
    //   });
    // }

    return res.status(200).json({
      status: 'success',
      data: {
        comments: comments,
      },
      pagination: {
        total_comments: totalComments,
        per_page: COMMENTS_PER_PAGE,
        current_page: page,
        total_pages: totalPages,
        next_page: nextPage,
        prev_page: prevPage,
      },
    });
  }),
];

exports.createCommentOnPost = [
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Comment must be at least 1 character long'),
  body('parent')
    .optional({ nullable: true })
    .trim()
    .custom((value) => isValidObjectId(value))
    .withMessage('"parent" must be a valid ObjectId'),
  body('blog')
    .trim()
    .custom((value) => isValidObjectId(value))
    .withMessage('"blog" must be a valid ObjectId'),
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

    const { content, parent: parentId, blog: blogId } = req.body;
    const { postId } = req.params;

    // prevent logged out users from creating a post
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are unauthorized to create a comment.',
        data: null,
      });
    }

    if (parentId) {
      const parent = await PostComment.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          status: 'fail',
          message: 'Parent comment does not exist.',
          data: null,
        });
      }
    }

    const post = await Post.findById(postId).exec();
    if (!post) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot create comment on a post that does not exist.',
        data: null,
      });
    }

    const postComment = new PostComment({
      author: req.user.userId,
      post: postId,
      blog: blogId,
      content: content,
      parent: parentId,
    });

    let createdPostComment = await postComment.save();
    createdPostComment = await createdPostComment.populate(
      'author',
      'first_name last_name profile_photo username'
    );

    let createdPostCommentLog = new PostCommentLog({
      post: createdPostComment.post,
      comment: createdPostComment,
      parent: createdPostComment.parent,
      upvotes: createdPostComment.upvotes,
      downvotes: createdPostComment.downvotes,
    });
    await createdPostCommentLog.save();

    if (parentId) {
      await updatePostCommentRepliesCount(postId, parentId);
    }

    return res.status(201).json({
      status: 'success',
      data: {
        comment: createdPostComment,
      },
    });
  }),
];

exports.updatePostComment = [
  body('content')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage('Content must be at least 1 character long.'),
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

    // only allow updating comment if user is logged in
    const userRole = req?.user?.role;
    if (userRole === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        message: 'You must be logged in to update a comment.',
        data: null,
      });
    }

    const { postId, commentId } = req.params;
    const { content: newContent } = req.body;

    const existingComment = await PostComment.findOne({
      post: postId,
      _id: commentId,
    }).exec();

    if (!existingComment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found.',
        data: null,
      });
    }

    let oldContent = existingComment.content;
    if (oldContent === newContent) {
      return res.status(400).json({
        status: 'fail',
        message: 'New comment content must be different than old comment.',
        data: null,
      });
    }

    if (req.user.userId.toString() === existingComment.author.toString()) {
      const updatedComment = await PostComment.findByIdAndUpdate(
        commentId,
        { content: newContent, last_edited_at: new Date() },
        { new: true }
      ).populate('author', 'first_name last_name profile_photo username');
      return res.status(200).json({
        status: 'success',
        message: 'Comment updated successfully.',
        data: {
          comment: updatedComment,
        },
      });
    } else {
      return res.status(403).json({
        status: 'fail',
        message: 'You are unauthorized to update this comment.',
        data: null,
      });
    }
  }),
];

exports.deletePostComment = [
  asyncHandler(async (req, res, next) => {
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        message: 'You must be logged in to delete a comment.',
        data: null,
      });
    }

    const { postId, commentId } = req.params;

    const existingComment = await PostComment.findOne({
      post: postId,
      _id: commentId,
    }).exec();

    if (!existingComment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found.',
        data: null,
      });
    }

    if (req.user.userId.toString() !== existingComment.author.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are unauthorized to delete this comment.',
        data: null,
      });
    }

    try {
      const deletedComment = await deleteCommentCascade(postId, commentId);
      return res.status(200).json({
        status: 'success',
        message: 'Comment deleted successfully.',
        data: {
          comment: deletedComment,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete comment on post.',
      });
    }
  }),
];

async function updatePostCommentRepliesCount(postId, parentId) {
  try {
    const repliesCount = await PostComment.countDocuments({
      parent: parentId,
      post: postId,
    });

    await PostComment.findOneAndUpdate(
      { post: postId, _id: parentId },
      { replies: repliesCount }
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating comment replies count:', error);
    return { success: false, error };
  }
}
