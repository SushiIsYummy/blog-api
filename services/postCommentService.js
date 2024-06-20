const PostComment = require('../models/postComment');
const PostCommentVote = require('../models/postCommentVote');
const PostCommentLog = require('../models/postCommentLog');
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types;

async function getCommentsAndCursorByCategory(
  postId,
  category,
  limit,
  cursor,
  maxCreatedAt,
  excludedIds
) {
  let maxCreatedAtDate =
    maxCreatedAt && !isNaN(new Date(maxCreatedAt).getTime())
      ? new Date(maxCreatedAt)
      : new Date();

  let baseQuery = {
    post: new ObjectId(postId),
    parent: null,
    created_at: { $lte: new Date(maxCreatedAtDate) },
  };

  let comments;
  let commentsLogs;
  if (!cursor) {
    if (category === 'newest') {
      comments = await PostComment.find({
        ...baseQuery,
        _id: { $nin: excludedIds },
      })
        .sort({ created_at: -1, _id: -1 })
        .limit(limit + 1)
        .populate('author', 'first_name last_name profile_photo username')
        .exec();
    } else if (category === 'top') {
      commentsLogs = await PostCommentLog.aggregate([
        {
          $match: { ...baseQuery, comment: { $nin: excludedIds } },
        },
        {
          $sort: {
            created_at: -1,
          },
        },
        {
          $group: {
            _id: '$comment',
            doc: { $first: '$$ROOT' },
          },
        },
        {
          $replaceRoot: { newRoot: '$doc' },
        },
        {
          $sort: {
            score: -1,
            comment: -1,
          },
        },
        {
          $lookup: {
            from: 'postcomments',
            localField: 'comment',
            foreignField: '_id',
            as: 'comment',
          },
        },
        {
          $unwind: '$comment',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'comment.author',
            foreignField: '_id',
            as: 'comment.author',
          },
        },
        {
          $unwind: '$comment.author',
        },
        {
          $limit: limit + 1,
        },
      ]);

      comments = commentsLogs.map((commentLog) => {
        return commentLog.comment;
      });
    }
  }

  if (cursor) {
    if (category === 'newest') {
      const [cursorId, cursorCreatedAt] = cursor.split('_');
      comments = await PostComment.find({
        ...baseQuery,
        _id: { $lt: new ObjectId(cursorId), $nin: excludedIds },
        created_at: { $lte: new Date(cursorCreatedAt) },
      })
        .sort({ created_at: -1, _id: -1 })
        .limit(limit + 1)
        .populate('author', 'first_name last_name profile_photo username')
        .exec();
    } else if (category === 'top') {
      const [cursorId, maxCreatedAt, maxUpvotes] = cursor.split('_');
      commentsLogs = await PostCommentLog.aggregate([
        // Filter documents based on `created_at` and `upvotes`
        {
          $match: {
            ...baseQuery,
            comment: { $nin: excludedIds },
            $or: [
              {
                score: { $eq: parseInt(maxUpvotes) },
                comment: { $lt: new ObjectId(cursorId) },
              },
              {
                score: { $lt: parseInt(maxUpvotes) },
              },
            ],
          },
        },
        {
          $group: {
            _id: '$comment',
            comment: { $first: '$$ROOT' },
          },
        },
        {
          $unwind: '$comment',
        },
        {
          $replaceRoot: { newRoot: '$comment' },
        },
        {
          $lookup: {
            from: 'postcommentlogs',
            let: {
              commentId: '$comment',
              createdAt: '$created_at',
              logId: '$_id',
            },
            // Check if there is log with the same comment id as the matched comment
            // that was already fetched before
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $ne: ['$_id', '$$logId'] },
                      { $eq: ['$comment', '$$commentId'] },
                      { $gte: ['$created_at', '$$createdAt'] },
                      { $lte: ['$created_at', new Date(maxCreatedAt)] },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: 'conflictingDocs',
          },
        },
        // Remove comments that have already been fetched before
        {
          $match: { 'conflictingDocs.0': { $exists: false } },
        },
        {
          $sort: {
            score: -1,
            comment: -1,
          },
        },
        {
          $lookup: {
            from: 'postcomments',
            localField: 'comment',
            foreignField: '_id',
            as: 'comment',
          },
        },
        {
          $unwind: '$comment',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'comment.author',
            foreignField: '_id',
            as: 'comment.author',
          },
        },
        {
          $unwind: '$comment.author',
        },
        {
          $limit: limit + 1,
        },
      ]);

      if (commentsLogs.length > 0) {
        rankNextCursorUpvotes = commentsLogs[commentsLogs.length - 1].score;
      }
      comments = commentsLogs.map((commentLog) => commentLog.comment);
    }
  }

  let hasMore = false;
  if (comments.length > limit) {
    hasMore = true;
    comments.pop();
  }

  if (commentsLogs && commentsLogs.length > limit) {
    commentsLogs.pop();
  }

  let nextCursor = null;

  if (!(comments.length > 0 && hasMore)) {
    return { comments, nextCursor };
  }

  const lastComment = comments[comments.length - 1];
  if (category === 'newest') {
    let createdAtString = new Date(lastComment['created_at']).toISOString();
    nextCursor = `${lastComment._id}_${createdAtString}`;
  } else if (category === 'top') {
    let rankNextCursorUpvotes = 0;
    if (commentsLogs.length > 0) {
      rankNextCursorUpvotes = commentsLogs[commentsLogs.length - 1].score;
    }
    if (cursor) {
      const [cursorId, maxCreatedAt, maxUpvotes] = cursor.split('_');
      nextCursor = `${lastComment._id}_${maxCreatedAt}_${rankNextCursorUpvotes}`;
    } else {
      nextCursor = `${
        lastComment._id
      }_${maxCreatedAtDate.toISOString()}_${rankNextCursorUpvotes}`;
    }
  }

  return { comments, nextCursor };
}

async function addUserVoteToComments(comments, postId, userId) {
  let commentIds = comments.map((comment) => comment._id);

  let userVotesOnComments = await PostCommentVote.find({
    post: postId,
    comment: { $in: commentIds },
    user: userId,
  });

  const commentVotesObj = {};
  userVotesOnComments.forEach((obj) => {
    commentVotesObj[obj.comment.toString()] = obj.vote_value;
  });

  comments = comments.map((comment) => {
    const userVote = commentVotesObj[comment._id.toString()];

    let commentWithUserVote;

    if (comment instanceof mongoose.Model) {
      commentWithUserVote = comment.toObject();
    } else {
      commentWithUserVote = comment;
    }
    commentWithUserVote.user_vote = userVote;
    return commentWithUserVote;
  });
  return comments;
}

module.exports = {
  getCommentsAndCursorByCategory,
  addUserVoteToComments,
};
