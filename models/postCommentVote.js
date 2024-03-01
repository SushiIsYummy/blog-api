const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const validateNumberRange = (value) => {
  return value === 1 || value === 0 || value === -1;
};

const PostCommentVoteSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'PostComment',
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vote_value: {
      type: Number,
      validate: {
        validator: validateNumberRange,
        message: (props) =>
          `${props.value} is not a valid value. It must be 1, 0, or -1.`,
      },
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

module.exports = mongoose.model('PostCommentVote', PostCommentVoteSchema);
