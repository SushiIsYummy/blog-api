const Post = require('../models/post');
const asyncHandler = require('express-async-handler');

const authorizePostOwner = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;
  const userId = req.user.userId;

  // Check if the post exists
  const post = await Post.findOne({ _id: postId }).exec();

  if (!post) {
    return res.status(404).json({
      status: 'fail',
      data: {
        message: 'No post found',
      },
    });
  }

  // Check if the current user is the author of the post
  if (post.author.toString() !== userId) {
    return res.status(403).json({
      status: 'fail',
      message: 'You are unauthorized to perform this action on this post',
    });
  }

  req.foundPost = post;

  next();
});

module.exports = authorizePostOwner;
