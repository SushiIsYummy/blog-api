const Post = require('../models/post');
const PostComment = require('../models/postComment');
const PostCommentVote = require('../models/postCommentVote');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const ROLES = require('../config/roles');
const { isValidObjectId } = require('mongoose');

const COMMENTS_PER_PAGE = 50;

exports.getCommentsOnPost = [
  asyncHandler(async (req, res, next) => {
    const { postId } = req.params;

    const postExists = await Post.findById(postId);
    if (!postExists) {
      return res
        .status(404)
        .json({ status: 'fail', data: { message: 'Post not found' } });
    }

    const page = parseInt(req.query.page) || 1;
    const skipCount = (page - 1) * COMMENTS_PER_PAGE;

    let totalComments = await PostComment.countDocuments({
      post: postId,
    }).exec();

    let comments = await PostComment.find({ post: postId, parent: null })
      .skip(skipCount)
      .limit(COMMENTS_PER_PAGE)
      .populate('author', 'first_name last_name profile_photo username')
      .exec();

    const totalPages = Math.ceil(totalComments / COMMENTS_PER_PAGE);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 && page <= totalPages ? page - 1 : null;

    let commentIds = comments.map((comment) => comment._id);

    let userVotesOnComments = await PostCommentVote.find({
      post: postId,
      comment: { $in: commentIds },
      user: req.user.userId,
    });

    const commentVotesObj = {};
    userVotesOnComments.forEach((obj) => {
      commentVotesObj[obj.comment.toString()] = obj.vote_value;
    });

    // add user vote value on comments if user is logged in
    const userRole = req?.user?.role;
    if (userRole !== ROLES.GUEST) {
      comments = comments.map((comment) => {
        const userVote = commentVotesObj[comment._id.toString()];
        if (userVote !== undefined) {
        }
        return { ...comment.toObject(), user_vote: userVote };
      });
    }

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

const REPLIES_PER_PAGE = 10;

exports.getRepliesOnPostComment = [
  asyncHandler(async (req, res, next) => {
    const { postId, commentId } = req.params;

    const postExists = await Post.findById(postId);
    if (!postExists) {
      return res
        .status(404)
        .json({ status: 'fail', data: { message: 'Post not found' } });
    }

    const commentExists = await PostComment.findOne({
      post: postId,
      _id: commentId,
    });
    if (!commentExists) {
      return res.status(404).json({
        status: 'fail',
        data: { message: 'Comment not found on post.' },
      });
    }

    const page = parseInt(req.query.page) || 1;
    const skipCount = (page - 1) * REPLIES_PER_PAGE;

    let totalReplies = commentExists.replies;

    let commentReplies = await PostComment.find({
      post: postId,
      parent: commentId,
    })
      .skip(skipCount)
      .limit(REPLIES_PER_PAGE)
      .populate('author', 'first_name last_name profile_photo username')
      .exec();

    const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 && page <= totalPages ? page - 1 : null;

    let commentIds = commentReplies.map((comment) => comment._id);

    let userVotesOnComments = await PostCommentVote.find({
      post: postId,
      comment: { $in: commentIds },
      user: req.user.userId,
    });

    const commentVotesObj = {};
    userVotesOnComments.forEach((obj) => {
      commentVotesObj[obj.comment.toString()] = obj.vote_value;
    });

    // add user vote value on comments if user is logged in
    const userRole = req?.user?.role;
    if (userRole !== ROLES.GUEST) {
      commentReplies = commentReplies.map((comment) => {
        const userVote = commentVotesObj[comment._id.toString()];
        if (userVote !== undefined) {
        }
        return { ...comment.toObject(), user_vote: userVote };
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        replies: commentReplies,
      },
      pagination: {
        total_comments: totalReplies,
        per_page: REPLIES_PER_PAGE,
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
    .optional()
    .trim()
    .custom((value) => isValidObjectId(value))
    .withMessage('"parent" must be a valid ObjectId'),
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

    const { comment: commentId, parent: parentId } = req.body;
    const { postId } = req.params;

    // prevent logged out users from creating a post
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to create a comment',
        },
      });
    }

    if (parentId) {
      const parent = await PostComment.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          status: 'fail',
          data: {
            message: 'Parent comment does not exist',
          },
        });
      }
    }

    const post = await Post.findById(postId).populate('author').exec();
    if (!post || !(post.author._id.toString() === req.user.userId)) {
      return res.status(400).json({
        status: 'fail',
        data: {
          message: 'Cannot create comment on a post that does not exist',
        },
      });
    }

    const postComment = new PostComment({
      author: req.user.userId,
      post: req.params.postId,
      content: req.body.content,
      parent: req.body.parent,
    });

    let createdPostComment = await postComment.save();
    createdPostComment = await createdPostComment.populate(
      'author',
      'first_name last_name profile_photo username'
    );

    if (parentId) {
      await updatePostCommentRepliesCount(postId, parentId);
    }

    return res.status(201).json({
      status: 'success',
      data: {
        postComment: createdPostComment,
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
        data: {
          error: 'You must be logged in to update a comment',
        },
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
        data: {
          message: 'Comment not found',
        },
      });
    }

    let oldContent = existingComment.content;
    if (oldContent === newContent) {
      return res.status(400).json({
        status: 'fail',
        data: {
          message: 'New comment content must be different than old comment',
        },
      });
    }

    if (req.user.userId.toString() === existingComment.author.toString()) {
      const updatedComment = await PostComment.findByIdAndUpdate(
        commentId,
        { content: newContent },
        { new: true }
      );
      return res.status(200).json({
        status: 'success',
        data: {
          message: 'Comment updated successfully',
          comment: updatedComment,
        },
      });
    } else {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to update this comment',
        },
      });
    }
  }),
];

exports.deleteComment = [
  asyncHandler(async (req, res, next) => {
    if (req.user.role === ROLES.GUEST) {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You must be logged in to delete a comment',
        },
      });
    }

    const { commentId } = req.params;
    const comment = await Comment.findById(commentId).exec();
    if (!comment) {
      return res.status(404).json({
        status: 'fail',
        data: {
          message: 'Comment not found',
        },
      });
    }

    if (req.user.userId.toString() === comment.user.toString()) {
      const deletedComment = await Comment.findByIdAndDelete(comment._id);
      return res.status(200).json({
        status: 'success',
        data: {
          message: 'Comment deleted successfully',
          comment: deletedComment,
        },
      });
      // FUTURE TODO: remove all child comments under the deleted comment
    } else {
      return res.status(403).json({
        status: 'fail',
        data: {
          message: 'You are unauthorized to delete this comment',
        },
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
