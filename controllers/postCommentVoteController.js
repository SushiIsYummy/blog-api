const PostComment = require('../models/postComment');
const PostCommentVote = require('../models/postCommentVote');
const asyncHandler = require('express-async-handler');
const { body, query, validationResult } = require('express-validator');
const validator = require('validator');
const ROLES = require('../config/roles');
const { ObjectId } = require('mongoose').Types;

const voteOptions = {
  UPVOTE: 1,
  NEUTRAL: 0,
  DOWNVOTE: -1,
};

exports.getVotesOnPostComment = asyncHandler(async (req, res, next) => {
  const { postId, commentId } = req.params;

  const votes = await PostComment.findOne({
    _id: commentId,
    post: postId,
  }).exec();

  return res.status(200).json({
    status: 'success',
    data: {
      votes: {
        upvotes: votes.upvotes,
        downvotes: votes.downvotes,
      },
    },
  });
});

exports.updateVoteOnPostComment = [
  body('vote_value')
    .optional()
    .isIn([-1, 1])
    .withMessage('Vote value must be -1 or 1'),
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

    const { postId, commentId } = req.params;

    let existingComment = await PostComment.findOne({
      _id: commentId,
      post: postId,
    });
    if (!existingComment) {
      return res.status(404).json({
        status: 'fail',
        data: {
          message: 'Comment does not exist.',
        },
      });
    }

    let voteResponse = await voteOnPostComment(
      req.user.userId,
      postId,
      commentId,
      req.body.vote_value
    );

    if (!voteResponse.success) {
      return res.status(500).json({
        status: 'fail',
        data: {
          message: 'Failed to update vote on post comment.',
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        vote: voteResponse.vote,
      },
    });
  }),
];

exports.deleteVoteOnPostComment = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.GUEST) {
    return res.status(403).json({
      status: 'fail',
      data: {
        message: 'You are unauthorized to delete a vote on this post comment',
      },
    });
  }

  const { postId, commentId } = req.params;

  let existingComment = await PostComment.findOne({
    _id: commentId,
    post: postId,
  });
  if (!existingComment) {
    return res.status(400).json({
      status: 'fail',
      data: {
        message: 'Comment does not exist.',
      },
    });
  }

  const deletedVote = await PostCommentVote.findOneAndDelete({
    post: postId,
    comment: commentId,
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

  let oldVote = deletedVote.vote_value;
  await updatePostCommentVotesCount(commentId, oldVote, 0);

  return res.status(200).json({
    status: 'success',
    data: {
      message: 'Vote on post comment deleted successfully',
      deleted_vote: deletedVote,
    },
  });
});

async function voteOnPostComment(userId, postId, commentId, voteValue) {
  try {
    let existingVote = await PostCommentVote.findOne({
      user: userId,
      post: postId,
      comment: commentId,
    });

    let oldVote = null;
    if (existingVote) {
      oldVote = existingVote.vote_value;
      existingVote.vote_value = voteValue;
      await existingVote.save();
    } else {
      console.log('creating post comment vote');
      await PostCommentVote.create({
        user: userId,
        post: postId,
        comment: commentId,
        vote_value: voteValue,
      });
    }

    await updatePostCommentVotesCount(commentId, oldVote, voteValue);

    return { success: true, vote: existingVote };
  } catch (error) {
    console.error('Error voting on comment:', error);
    return { success: false, error };
  }
}

async function updatePostCommentVotesCount(commentId, oldVote, newVote) {
  try {
    if (oldVote === newVote) {
      return;
    }

    let upvotesCount = null;
    let downvotesCount = null;
    oldVote = oldVote === null ? 0 : oldVote;

    const voteSum = oldVote + newVote;
    if (voteSum === -1) {
      downvotesCount = await PostCommentVote.countDocuments({
        comment: commentId,
        vote_value: voteOptions.DOWNVOTE,
      });
    } else if (voteSum === 0) {
      const convertedCommentId = new ObjectId(commentId);
      const votes = await PostCommentVote.aggregate([
        { $match: { comment: convertedCommentId } },
        {
          $group: {
            _id: '$vote_value',
            count: { $sum: 1 },
          },
        },
      ]);
      upvotesCount =
        votes.find((vote) => vote._id === voteOptions.UPVOTE)?.count || 0;
      downvotesCount =
        votes.find((vote) => vote._id === voteOptions.DOWNVOTE)?.count || 0;
    } else if (voteSum === 1) {
      upvotesCount = await PostCommentVote.countDocuments({
        comment: commentId,
        vote_value: voteOptions.UPVOTE,
      });
    }

    const updateObject = {};
    if (upvotesCount !== null) {
      updateObject.upvotes = upvotesCount;
    }
    if (downvotesCount !== null) {
      updateObject.downvotes = downvotesCount;
    }

    await PostComment.findByIdAndUpdate(commentId, updateObject);

    return { success: true };
  } catch (error) {
    console.error('Error updating comment votes count:', error);
    return { success: false, error };
  }
}
