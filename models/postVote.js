const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostVoteSchema = new Schema({
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  vote_value: {
    type: String,
    enum: ['UPVOTE', 'DOWNVOTE'],
    required: true,
  },
});

module.exports = mongoose.model('PostVote', PostVoteSchema);
