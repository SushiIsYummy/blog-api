const PostComment = require('../models/postComment');
const PostCommentLog = require('../models/postCommentLog');
const PostCommentVote = require('../models/postCommentVote');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const ROLES = require('../config/roles');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

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
        message: 'You are unauthorized to vote on a post.',
        data: null,
      });
    }

    const { postId, commentId } = req.params;
    const { vote_value: voteValue } = req.body;

    let existingComment = await PostComment.findOne({
      _id: commentId,
      post: postId,
    });

    if (!existingComment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment does not exist.',
        data: null,
      });
    }

    let voteResponse = await voteOnPostComment(
      req.user.userId,
      postId,
      commentId,
      voteValue,
      existingComment
    );

    if (!voteResponse.success) {
      return res.status(500).json({
        status: 'fail',
        message: 'Failed to update vote on post comment.',
        data: null,
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
      message: 'You are unauthorized to delete a vote on this post comment.',
      data: null,
    });
  }

  const { postId, commentId } = req.params;
  const { userId } = req.user;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      let existingComment = await PostComment.findOne({
        _id: commentId,
        post: postId,
      })
        .populate('author', '_id')
        .session(session);

      if (!existingComment) {
        return res.status(400).json({
          status: 'fail',
          message: 'Comment does not exist.',
          data: null,
        });
      }
      const deletedVote = await PostCommentVote.findOneAndDelete(
        {
          post: postId,
          comment: commentId,
          user: userId,
        },
        { session }
      ).exec();

      // if no vote is found, it means the user neither upvoted or downvoted
      if (!deletedVote) {
        return res.status(404).json({
          status: 'fail',
          message: 'Vote not found.',
          data: null,
        });
      }

      let commentLog = await PostCommentLog.findOne({
        comment: commentId,
        post: postId,
        expires_at: { $exists: false },
      })
        .session(session)
        .exec();
      commentLog.update_required = true;
      await commentLog.save({ session });

      let oldVote = deletedVote.vote_value;
      await updatePostCommentVotesCount(commentId, oldVote, 0, session);

      return res.status(200).json({
        status: 'success',
        message: 'Vote on post comment deleted successfully.',
        data: {
          deleted_vote: deletedVote,
        },
      });
    });
  } catch (error) {
    console.log('Transaction aborted due to an error: ', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete vote on post comment.',
    });
  }
});

async function voteOnPostComment(userId, postId, commentId, voteValue) {
  const session = await mongoose.startSession();

  let existingVote = null;
  try {
    await session.withTransaction(async () => {
      existingVote = await PostCommentVote.findOne({
        user: userId,
        post: postId,
        comment: commentId,
      }).session(session);

      let oldVote = null;
      if (existingVote) {
        oldVote = existingVote.vote_value;
        existingVote.vote_value = voteValue;

        await existingVote.save({ session });
      } else {
        await PostCommentVote.create(
          [
            {
              user: userId,
              post: postId,
              comment: commentId,
              vote_value: voteValue,
            },
          ],
          { session }
        );
      }

      let commentLog = await PostCommentLog.findOne({
        comment: commentId,
        post: postId,
        expires_at: { $exists: false },
      }).session(session);
      commentLog.update_required = true;
      await commentLog.save({ session });

      await updatePostCommentVotesCount(commentId, oldVote, voteValue, session);
    });
    return { success: true, vote: existingVote };
  } catch (error) {
    console.log('Transaction aborted due to an error: ', error.message);
    console.error('Error occured while voting on comment:', error);
    return { success: false, error };
  }
}

// TODO: use $inc instead of countDocuments()
async function updatePostCommentVotesCount(
  commentId,
  oldVote,
  newVote,
  session
) {
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
      }).session(session);
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
      ]).session(session);
      upvotesCount =
        votes.find((vote) => vote._id === voteOptions.UPVOTE)?.count || 0;
      downvotesCount =
        votes.find((vote) => vote._id === voteOptions.DOWNVOTE)?.count || 0;
    } else if (voteSum === 1) {
      upvotesCount = await PostCommentVote.countDocuments({
        comment: commentId,
        vote_value: voteOptions.UPVOTE,
      }).session(session);
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
