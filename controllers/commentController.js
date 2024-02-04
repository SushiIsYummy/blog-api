const Comment = require('../models/comment');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

// Get comment on GET.
exports.getComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.find(req.body.commentId);
  if (!comment) {
  }
  return res.status(200).json({
    status: 'success',
    data: {
      comment: comment,
    },
  });
});

// Get all comments on post on GET
exports.getAllCommentsByPost = asyncHandler(async (req, res, next) => {
  const comments = await Comment.find({ post: req.body.postId });
  if (!comments) {
  }
  return res.status(200).json({
    status: 'success',
    data: {
      comments: comments,
    },
  });
});

// Handle comment create on POST.
exports.createComment = asyncHandler(async (req, res, next) => {
  return res.send('NOT IMPLEMENTED: comment create POST');
});

// Delete comment on POST.
exports.deleteComment = asyncHandler(async (req, res, next) => {
  return res.send('NOT IMPLEMENTED: delete comment POST');
});

// Update comment on PUT.
exports.updateComment = asyncHandler(async (req, res, next) => {
  return res.send('NOT IMPLEMENTED: update comment PUT');
});
