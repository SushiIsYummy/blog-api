const cron = require('node-cron');
const PostCommentLog = require('../models/postCommentLog');

const updateCommentLogs = cron.schedule('0 */4 * * *', async () => {
  try {
    let updateStartDate = new Date();

    let hasMore = true;
    while (hasMore) {
      let commentLogsToUpdate = await PostCommentLog.find({
        update_required: true,
        created_at: { $lte: updateStartDate },
      })
        .populate('comment')
        .exec();

      if (commentLogsToUpdate.length === 0) {
        hasMore = false;
      }

      // Set previous comment log to expire in a day
      // The old log is kept for another day because it may still
      // be needed by some users (a new log is created while a user
      // is still scrolling and some comments are yet to be loaded)
      // Since the old log expires, it is expected that users don't
      // scroll on the same post for over a day or else some comments
      // may not be loaded.
      let expireAfterSeconds = 60 * 60 * 24; // 1 day
      for (const commentLog of commentLogsToUpdate) {
        commentLog.update_required = false;
        commentLog.expires_at = new Date(
          Date.now() + expireAfterSeconds * 1000
        );
        await commentLog.save();

        let newPostCommentLog = new PostCommentLog({
          post: commentLog.post,
          comment: commentLog.comment,
          upvotes: commentLog.comment.upvotes,
          downvotes: commentLog.comment.downvotes,
        });
        await newPostCommentLog.save();
      }
    }
  } catch (error) {
    console.error('Error updating upvote logs:', error);
  }
});

module.exports = { updateCommentLogs };
