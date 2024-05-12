const PostVote = require('../models/postVote');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const ROLES = require('../config/roles');
const { ObjectId } = require('mongoose').Types;

const voteOptions = {
  UPVOTE: 1,
  NEUTRAL: 0,
  DOWNVOTE: -1,
};

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
      if (item._id === voteOptions.UPVOTE) {
        upvotes = item.count;
      } else if (item._id === voteOptions.DOWNVOTE) {
        downvotes = item.count;
      }
    });

    return { upvotes, downvotes };
  } catch (error) {
    console.error('Error fetching upvotes and downvotes:', error);
    throw error;
  }
}

exports.updateVoteOnPost = [
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

exports.deleteVoteOnPost = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.GUEST) {
    return res.status(403).json({
      status: 'fail',
      message: 'You are unauthorized to delete a vote on this post.',
      data: null,
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
      message: 'Vote not found.',
      data: null,
    });
  }

  return res.status(200).json({
    status: 'success',
    message: 'Vote on post deleted successfully.',
    data: {
      deleted_vote: deletedVote,
    },
  });
});
